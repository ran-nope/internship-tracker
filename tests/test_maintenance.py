"""Maintenance middleware/configuration tests; no existing database access."""
from dataclasses import FrozenInstanceError
import os
from pathlib import Path
import subprocess
import sys
import unittest

from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from asgi_helpers import request
from maintenance import MaintenanceMiddleware, MESSAGE, RuntimeSettings

ROOT = Path(__file__).resolve().parents[1]


class MaintenanceTests(unittest.TestCase):
    def test_strict_configuration_defaults_and_nonsecret_identifiers(self):
        settings = RuntimeSettings.from_environment({})
        self.assertFalse(settings.maintenance_mode)
        self.assertEqual(settings.release, 'local')
        self.assertRegex(settings.instance_id, r'^[0-9a-f]{32}$')
        self.assertNotEqual(settings.instance_id, RuntimeSettings().instance_id)
        for value in ['true', 'TRUE', ' true ']:
            self.assertTrue(RuntimeSettings.from_environment({'MAINTENANCE_MODE': value}).maintenance_mode)
        self.assertFalse(RuntimeSettings.from_environment({'MAINTENANCE_MODE': 'false'}).maintenance_mode)
        for value in ['', '0', '1', 'yes', 'no', 'enabled', 'synthetic-invalid-value']:
            with self.assertRaises(RuntimeError) as error:
                RuntimeSettings.from_environment({'MAINTENANCE_MODE': value})
            if value:
                self.assertNotIn(value, str(error.exception))
        self.assertEqual(RuntimeSettings.from_environment({'RENDER_GIT_COMMIT': 'A' * 40}).release, 'a' * 40)
        self.assertEqual(RuntimeSettings.from_environment({'RENDER_GIT_COMMIT': 'not-a-commit-or-public-value'}).release, 'local')
        with self.assertRaises(FrozenInstanceError):
            settings.maintenance_mode = True

    def test_mutations_stop_before_downstream_auth_validation_or_body_access(self):
        async def forbidden(scope, receive, send):
            raise AssertionError('Blocked request reached downstream application')
        gate = MaintenanceMiddleware(forbidden, enabled=True)
        for method, path in [('POST','/signup'),('POST','/signup/'),('POST','/internships'),
                             ('PUT','/internships/1'),('DELETE','/internships/1'),
                             ('PATCH','/internships/1'),('POST','/unknown'),('TRACE','/'),
                             ('POST','/login/extra')]:
            for headers in [(), ((b'authorization',b'Bearer synthetic-session'),)]:
                with self.subTest(method=method, path=path, authenticated=bool(headers)):
                    status, response_headers, data = request(gate, method, path, body=b'not json',
                        headers=headers, forbid_receive=True)
                    self.assertEqual(status, 503)
                    self.assertEqual(data, {'detail': MESSAGE})
                    self.assertEqual(response_headers[b'cache-control'], b'no-store')

    def test_reads_login_and_disabled_mode_are_transparent(self):
        calls = []
        async def downstream(scope, receive, send):
            calls.append((scope['method'], scope['path']))
            await JSONResponse({'original': True}, status_code=202)(scope, receive, send)
        gate = MaintenanceMiddleware(downstream, enabled=True)
        for method, path in [('GET','/internships'),('HEAD','/status'),('OPTIONS','/signup'),
                             ('POST','/login'),('POST','/login/')]:
            self.assertEqual(request(gate, method, path)[0], 202)
        self.assertEqual(len(calls), 5)
        normal = MaintenanceMiddleware(downstream, enabled=False)
        self.assertEqual(request(normal, 'DELETE', '/internships/1')[0], 202)

    def test_cors_preflights_and_maintenance_responses_preserve_origin_policy(self):
        async def downstream(scope, receive, send):
            await JSONResponse({'original': True})(scope, receive, send)
        app = CORSMiddleware(MaintenanceMiddleware(downstream, enabled=True),
            allow_origins=['https://test-frontend.example'], allow_credentials=True,
            allow_methods=['GET','HEAD','POST','PUT','DELETE','OPTIONS'], allow_headers=['Authorization','Content-Type'])
        origin = (b'origin', b'https://test-frontend.example')
        for method, path in [('POST','/signup'),('POST','/internships'),('PUT','/internships/1'),('DELETE','/internships/1')]:
            status, headers, _ = request(app, method, path, headers=[origin], forbid_receive=True)
            self.assertEqual(status, 503)
            self.assertEqual(headers[b'access-control-allow-origin'], origin[1])
            self.assertEqual(headers[b'access-control-allow-credentials'], b'true')
        status, headers, _ = request(app, 'OPTIONS', '/internships', headers=[origin,
            (b'access-control-request-method',b'POST'), (b'access-control-request-headers',b'authorization,content-type')])
        self.assertEqual(status, 200)
        self.assertEqual(headers[b'access-control-allow-origin'], origin[1])
        status, headers, _ = request(app, 'POST', '/signup', headers=[(b'origin',b'https://untrusted.example')])
        self.assertEqual(status, 503)
        self.assertNotIn(b'access-control-allow-origin', headers)

    def test_real_application_status_and_blocking_need_no_database(self):
        environment = dict(os.environ)
        environment.update({'PYTHON_DOTENV_DISABLED':'1','MAINTENANCE_MODE':'true',
                            'DATABASE_URL':'postgresql://unused@127.0.0.1:1/unused',
                            'RENDER_GIT_COMMIT':'a' * 40})
        environment['SECRET_KEY'] = 'synthetic-' + 'maintenance-import-key'
        code = '''
import json
from unittest.mock import patch
import main
from asgi_helpers import request
with patch.object(main, 'SessionLocal', side_effect=AssertionError('Database accessed')):
    for method, path in [('POST','/signup'),('POST','/internships'),('PUT','/internships/0'),('DELETE','/internships/0')]:
        status, headers, data = request(main.app, method, path, body=b'invalid', forbid_receive=True)
        assert status == 503 and headers[b'cache-control'] == b'no-store'
    status, headers, data = request(main.app, 'GET', '/status')
    assert status == 200 and headers[b'cache-control'] == b'no-store'
    assert set(data) == {'maintenance_mode','release','instance_id'}
    assert data['maintenance_mode'] is True and data['release'] == 'a' * 40
    first = data
    assert request(main.app, 'GET', '/status')[2] == first
    assert request(main.app, 'HEAD', '/status')[2] == b''
    assert request(main.app, 'GET', '/')[2] == {'message':'Internship Tracker is running'}
    # Changing the environment alone cannot toggle an already running process.
    import os
    os.environ['MAINTENANCE_MODE'] = 'false'
    assert request(main.app, 'GET', '/status')[2]['maintenance_mode'] is True
print('Application maintenance status and early gate passed without database access.')
'''
        environment['PYTHONPATH'] = str(ROOT / 'tests')
        result = subprocess.run([sys.executable,'-B','-c',code], cwd=ROOT,
                                env=environment, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(environment['SECRET_KEY'], result.stdout + result.stderr)
        environment['MAINTENANCE_MODE'] = 'not-a-valid-value'
        result = subprocess.run([sys.executable,'-B','-c','import main'], cwd=ROOT,
                                env=environment, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('MAINTENANCE_MODE must be true or false', result.stderr)
        self.assertNotIn('not-a-valid-value', result.stderr)
