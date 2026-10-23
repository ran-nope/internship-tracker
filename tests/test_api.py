"""Run with: venv/bin/python -B -m unittest discover -s tests -v.
Uses an isolated in-memory database; never loads production database credentials.
"""
import asyncio
import importlib
import json
import os
import sys
import unittest
from unittest.mock import patch


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if 'database' in sys.modules or 'main' in sys.modules:
            raise RuntimeError('Run API tests in a fresh process to isolate database settings')
        cls.environment = patch.dict(os.environ, {
            'DATABASE_URL': 'sqlite://',
            'SECRET_KEY': 'isolated-test-secret-not-for-production',
            'CORS_ORIGINS': 'https://test-frontend.example/',
        })
        cls.environment.start()
        from sqlalchemy import create_engine
        from sqlalchemy.pool import StaticPool
        database = importlib.import_module('database')
        database.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
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
            status, headers, _ = self.request('OPTIONS', path, extra_headers=extra)
            self.assertEqual(status, 200)
            self.assertEqual(headers[b'access-control-allow-origin'], b'https://test-frontend.example')
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
