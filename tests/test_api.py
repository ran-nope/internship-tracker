"""Run with: venv/bin/python -B -m unittest discover -s tests -v.
Uses an isolated in-memory database; never loads production database credentials.
"""
import asyncio
import base64
import hashlib
import hmac
import importlib
import json
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if 'database' in sys.modules or 'main' in sys.modules:
            raise RuntimeError('Run API tests in a fresh process to isolate database settings')
        cls.environment = patch.dict(os.environ, {
            'DATABASE_URL': 'sqlite://',
            'SECRET_KEY': 'isolated-test-secret-not-for-production',
            'CORS_ORIGINS': 'https://test-frontend.example/',
            'PYTHON_DOTENV_DISABLED': '1',
        })
        cls.environment.start()
        from sqlalchemy import create_engine, event
        from sqlalchemy.pool import StaticPool
        database = importlib.import_module('database')
        database.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        @event.listens_for(database.engine, 'connect')
        def foreign_keys(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')
        database.SessionLocal.configure(bind=database.engine)
        cls.database = database
        cls.main = importlib.import_module('main')

    @classmethod
    def tearDownClass(cls):
        cls.database.engine.dispose()
        cls.environment.stop()

    def setUp(self):
        if str(self.database.engine.url) != 'sqlite://':
            raise RuntimeError('Tests require an in-memory SQLite database')
        self.database.Base.metadata.drop_all(self.database.engine)
        self.database.Base.metadata.create_all(self.database.engine)

    def request(self, method, path, body=None, token=None, origin='https://test-frontend.example', extra_headers=()):
        async def run():
            headers = [(b'host', b'testserver'), (b'origin', origin.encode())]
            if body is not None:
                headers.append((b'content-type', b'application/json'))
            if token:
                headers.append((b'authorization', f'Bearer {token}'.encode()))
            headers.extend(extra_headers)
            scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                     'method': method, 'scheme': 'http', 'path': path, 'raw_path': path.encode(),
                     'query_string': b'', 'root_path': '', 'headers': headers,
                     'client': ('127.0.0.1', 1234), 'server': ('testserver', 80)}
            messages = []
            async def receive():
                return {'type': 'http.request', 'body': json.dumps(body).encode() if body is not None else b'', 'more_body': False}
            async def send(message):
                messages.append(message)
            try:
                await self.main.app(scope, receive, send)
            except RuntimeError:
                if not any(m['type'] == 'http.response.start' for m in messages):
                    raise
            start = next(m for m in messages if m['type'] == 'http.response.start')
            content = b''.join(m.get('body', b'') for m in messages if m['type'] == 'http.response.body')
            try:
                data = json.loads(content)
            except ValueError:
                data = content.decode()
            return start['status'], dict(start['headers']), data
        return asyncio.run(run())

    def account(self, name):
        user = {'username': name, 'password': 'test-password'}
        self.assertEqual(self.request('POST', '/signup', user)[0], 200)
        status, _, data = self.request('POST', '/login', user)
        self.assertEqual(status, 200)
        return data['access_token']

    def test_authentication_and_owned_crud(self):
        token = self.account('alice')
        other = self.account('bob')
        payload = {'company': 'Example', 'role': 'Intern', 'status': 'Applied', 'application_date': '2026-10-23'}
        status, _, created = self.request('POST', '/internships', payload, token)
        self.assertEqual(status, 200)
        path = f"/internships/{created['id']}"
        self.assertEqual(len(self.request('GET', '/internships', token=token)[2]), 1)
        self.assertEqual(self.request('GET', '/internships', token=other)[2], [])
        self.assertEqual(self.request('PUT', path, payload, other)[0], 404)
        self.assertEqual(self.request('DELETE', path, token=other)[0], 404)
        payload['status'] = 'Interview'
        self.assertEqual(self.request('PUT', path, payload, token)[2]['status'], 'Interview')
        self.assertEqual(self.request('DELETE', path, token=token)[0], 200)
        self.assertEqual(self.request('GET', '/internships', token=token)[2], [])

    def test_invalid_auth_and_validation(self):
        self.account('alice')
        self.assertEqual(self.request('POST', '/signup', {'username': 'alice', 'password': 'test-password'})[0], 409)
        self.assertEqual(self.request('POST', '/login', {'username': 'alice', 'password': 'wrong'})[0], 401)
        self.assertEqual(self.request('GET', '/internships')[0], 401)
        self.assertEqual(self.request('GET', '/internships', token='invalid')[0], 401)
        for endpoint in ('/signup', '/login'):
            status, headers, _ = self.request('POST', endpoint, {'username': 'unicode', 'password': 'é' * 37})
            self.assertEqual(status, 422)
            self.assertEqual(headers[b'access-control-allow-origin'], b'https://test-frontend.example')

    def test_preflight(self):
        for path, method, requested in [('/signup', 'POST', 'content-type'), ('/login', 'POST', 'content-type'), ('/internships', 'GET', 'authorization'), ('/internships/1', 'PUT', 'authorization,content-type'), ('/internships/1', 'DELETE', 'authorization')]:
            extra = [(b'access-control-request-method', method.encode()), (b'access-control-request-headers', requested.encode())]
            for origin in (
                'http://localhost:5173',
                'http://localhost:5174',
                'http://127.0.0.1:5173',
                'https://internship-tracker-seven-alpha.vercel.app',
                'https://internship-tracker-git-master-kpc13.vercel.app',
                'https://test-frontend.example',
            ):
                with self.subTest(path=path, origin=origin):
                    status, headers, _ = self.request('OPTIONS', path, origin=origin, extra_headers=extra)
                    self.assertEqual(status, 200)
                    self.assertEqual(headers[b'access-control-allow-origin'], origin.encode())
                    self.assertEqual(headers[b'access-control-allow-credentials'], b'true')
                    self.assertIn(method, headers[b'access-control-allow-methods'].decode().split(', '))
                    allowed_headers = headers[b'access-control-allow-headers'].decode().lower().split(', ')
                    for requested_header in requested.split(','):
                        self.assertIn(requested_header, allowed_headers)
            status, headers, _ = self.request('OPTIONS', path, origin='https://untrusted.example', extra_headers=extra)
            self.assertEqual(status, 400)
            self.assertNotIn(b'access-control-allow-origin', headers)

    def test_unhandled_errors_keep_cors(self):
        # A normal endpoint must raise inside FastAPI's server-error middleware.
        async def failure():
            raise RuntimeError('simulated failure')
        self.main.app.app.add_api_route('/test-failure', failure)
        status, headers, _ = self.request('GET', '/test-failure')
        self.assertEqual(status, 500)
        self.assertEqual(headers[b'access-control-allow-origin'], b'https://test-frontend.example')

    def test_unsafe_job_url(self):
        token = self.account('alice')
        payload = {'company': 'Example', 'role': 'Intern', 'status': 'Applied', 'application_date': '2026-10-23', 'job_url': 'javascript:alert(1)'}
        self.assertEqual(self.request('POST', '/internships', payload, token)[0], 422)

    def test_expired_tampered_and_malformed_claims(self):
        import jwt
        token = self.account('alice')
        user_id = jwt.decode(token, self.main.SECRET_KEY, algorithms=['HS256'])['user_id']
        future = datetime.now(timezone.utc) + timedelta(hours=1)
        payloads = [
            {'user_id': user_id, 'exp': datetime.now(timezone.utc) - timedelta(minutes=1)},
            {'user_id': user_id},
            {'exp': future},
            {'user_id': True, 'exp': future},
            {'user_id': '1', 'exp': future},
            {'user_id': 0, 'exp': future},
        ]
        for payload in payloads:
            invalid = jwt.encode(payload, self.main.SECRET_KEY, algorithm='HS256')
            status, headers, _ = self.request('GET', '/internships', token=invalid)
            self.assertEqual(status, 401)
            self.assertEqual(headers[b'www-authenticate'], b'Bearer')
        forged = jwt.encode({'user_id': user_id, 'exp': future}, 'different-test-signing-key-not-for-production', algorithm='HS256')
        self.assertEqual(self.request('GET', '/internships', token=forged)[0], 401)

    def test_token_contract_and_legacy_compatibility(self):
        import jwt
        before = int(datetime.now(timezone.utc).timestamp())
        token = self.account('alice')
        after = int(datetime.now(timezone.utc).timestamp())
        payload = jwt.decode(token, self.main.SECRET_KEY, algorithms=['HS256'], options={'require': ['exp']})
        self.assertIsInstance(token, str)
        self.assertEqual(jwt.get_unverified_header(token)['alg'], 'HS256')
        self.assertEqual(set(payload), {'user_id', 'exp'})
        self.assertEqual(type(payload['user_id']), int)
        self.assertGreaterEqual(payload['exp'], before + 86400)
        self.assertLessEqual(payload['exp'], after + 86400)

        # Generated with python-jose 3.5.0 and our public test key, not real credentials.
        fixture = json.loads((Path(__file__).parent / 'fixtures/legacy_hs256.json').read_text())
        legacy = fixture['token']
        with self.database.SessionLocal() as db:
            self.assertEqual(self.main.get_current_user(legacy, db), payload['user_id'])
        application = {'company': 'Legacy session', 'role': 'Intern', 'status': 'Applied', 'application_date': '2026-10-23'}
        self.assertEqual(self.request('POST', '/internships', application, legacy)[0], 200)
        self.assertEqual(len(self.request('GET', '/internships', token=token)[2]), 1)
        other = self.account('bob')
        self.assertEqual(self.request('GET', '/internships', token=other)[2], [])

    def test_malformed_tokens_claims_and_disallowed_algorithms(self):
        # Independent signing lets us exercise malformed signed JSON and headers.
        # All keys/tokens here are synthetic; no database account or .env is used.
        def part(value):
            return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).rstrip(b'=')

        def signed(payload, header=None, digest=hashlib.sha256):
            message = part({'alg': 'HS256', 'typ': 'JWT'} if header is None else header) + b'.' + part(payload)
            signature = hmac.new(self.main.SECRET_KEY.encode(), message, digest).digest()
            return (message + b'.' + base64.urlsafe_b64encode(signature).rstrip(b'=')).decode()

        future = int(datetime.now(timezone.utc).timestamp()) + 3600
        valid = {'user_id': 1, 'exp': future}
        tokens = ['invalid', 'a.b.c', 'a.b', 'a.b.c.d', '...']
        for value in (None, True, False, 0, -1, 1.5, '1', [], {}):
            tokens.append(signed({**valid, 'user_id': value}))
        for value in (None, 'not-a-date', [], {}, float('inf'), float('nan'), 0):
            tokens.append(signed({**valid, 'exp': value}))
        tokens.extend([signed({'user_id': 1}), signed({'exp': future}), signed([]), signed(None)])
        for claim in ('nbf', 'iat'):
            for value in (None, [], {}, 'invalid', future):
                tokens.append(signed({**valid, claim: value}))
        for algorithm, digest in [('HS384', hashlib.sha384), ('HS512', hashlib.sha512)]:
            tokens.append(signed(valid, {'alg': algorithm}, digest))
        for header in ({'alg': 'none'}, {'alg': 'RS256'}, {'alg': []}, {'alg': None}, {}, []):
            tokens.append(signed(valid, header))
        tokens.append((part({'alg': 'none'}) + b'.' + part(valid) + b'.').decode())
        header, payload, signature = signed(valid).split('.')
        tokens.append('.'.join([header, part({**valid, 'user_id': 2}).decode(), signature]))
        tokens.append('.'.join([header, payload, ('A' if signature[0] != 'A' else 'B') + signature[1:]]))
        for index, token in enumerate(tokens):
            with self.subTest(case=index):
                status, headers, _ = self.request('GET', '/internships', token=token)
                self.assertEqual(status, 401)
                self.assertEqual(headers[b'www-authenticate'], b'Bearer')
                self.assertEqual(headers[b'access-control-allow-origin'], b'https://test-frontend.example')

    def test_validation_and_persisted_optional_fields(self):
        token = self.account('alice')
        payload = {'company': '  Example  ', 'role': '  Intern  ', 'status': 'Applied',
                   'application_date': '2026-10-23', 'location': 'Bengaluru',
                   'job_url': 'https://example.com/job', 'notes': 'Line one\nLine two', 'user_id': 99999}
        status, _, created = self.request('POST', '/internships', payload, token)
        self.assertEqual(status, 200)
        self.assertEqual(created['company'], 'Example')
        self.assertEqual(created['role'], 'Intern')
        self.assertNotEqual(created['user_id'], 99999)
        persisted = self.request('GET', '/internships', token=token)[2][0]
        for key in ('location', 'job_url', 'notes', 'application_date'):
            self.assertEqual(persisted[key], payload[key])
        invalid_cases = [('company', ' '), ('role', ''), ('company', 'A' * 201),
                         ('status', 'Not a status'), ('application_date', '2026-02-30'),
                         ('job_url', 'https://example.com/a b')]
        for key, value in invalid_cases:
            invalid = dict(payload, **{key: value})
            for method, path in [('POST', '/internships'), ('PUT', f"/internships/{created['id']}")]:
                status, headers, _ = self.request(method, path, invalid, token)
                self.assertEqual(status, 422)
                self.assertIn(b'access-control-allow-origin', headers)
        self.assertEqual(len(self.request('GET', '/internships', token=token)[2]), 1)
        self.assertEqual(self.request('PUT', '/internships/99999', payload, token)[0], 404)
        self.assertEqual(self.request('DELETE', '/internships/99999', token=token)[0], 404)

    def test_signup_race_rolls_back_and_returns_conflict(self):
        from sqlalchemy.exc import IntegrityError
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [None, object()]
        db.commit.side_effect = IntegrityError('simulated duplicate insert', {}, Exception())
        with self.assertRaises(self.main.HTTPException) as error:
            self.main.signup(self.main.User(username='race', password='test-password'), db)
        self.assertEqual(error.exception.status_code, 409)
        db.rollback.assert_called_once()

    def test_missing_user_token_is_rejected_on_every_protected_route(self):
        token = self.main.create_token(987654)
        application = {'company': 'Example', 'role': 'Intern', 'status': 'Applied', 'application_date': '2026-10-23'}
        for method, path, body in [('GET', '/internships', None), ('POST', '/internships', application),
                                   ('PUT', '/internships/1', application), ('DELETE', '/internships/1', None)]:
            status, headers, _ = self.request(method, path, body, token)
            self.assertEqual(status, 401)
            self.assertEqual(headers[b'www-authenticate'], b'Bearer')
            self.assertEqual(headers[b'access-control-allow-origin'], b'https://test-frontend.example')

    def test_database_referential_integrity_and_restrict_delete(self):
        from sqlalchemy.exc import IntegrityError
        self.account('alice')
        with self.database.SessionLocal() as db:
            user = db.query(self.main.UserDB).one()
            application = self.main.InternshipDB(company='Example', role='Intern', status='Applied',
                application_date=datetime(2026, 10, 23).date(), user_id=9999)
            db.add(application)
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
            application.user_id = user.id
            db.add(application)
            db.commit()
            db.delete(user)
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
            self.assertEqual(db.query(self.main.InternshipDB).count(), 1)
            self.assertEqual(db.query(self.main.UserDB).count(), 1)

    def test_owner_fk_failure_rolls_back_without_hiding_other_errors(self):
        from sqlalchemy.exc import IntegrityError
        db = MagicMock()
        original = Exception('synthetic database failure')
        original.pgcode = '23503'
        original.diag = type('Diagnostic', (), {'constraint_name': 'fk_internships_user_id_users'})()
        db.commit.side_effect = IntegrityError('synthetic write', {}, original)
        with self.assertRaises(self.main.HTTPException) as error:
            self.main.commit_internship(db)
        self.assertEqual(error.exception.status_code, 401)
        db.rollback.assert_called_once()
        db.reset_mock()
        original.diag.constraint_name = 'other_constraint'
        with self.assertRaises(IntegrityError):
            self.main.commit_internship(db)
        db.rollback.assert_called_once()
        db.reset_mock()
        db.commit.side_effect = RuntimeError('synthetic connection failure')
        with self.assertRaises(RuntimeError):
            self.main.commit_internship(db)
        db.rollback.assert_called_once()
