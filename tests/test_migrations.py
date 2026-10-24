"""Opt-in real PostgreSQL suite; creates and destroys only its own local clusters.

RUN_POSTGRES_TESTS=1 venv/bin/python -B -m unittest discover -s tests -p test_migrations.py -v
"""
from contextlib import contextmanager
import hashlib
import importlib
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError, OperationalError, DBAPIError
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from disposable_postgres import disposable_postgres
from scripts.migrate import run
from scripts.schema_preflight import BASELINE, INDEXED, PROTECTED, VALIDATED, inspect_schema
import test_api

ENABLED = os.environ.get('RUN_POSTGRES_TESTS') == '1'
ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(ENABLED, 'Opt-in disposable PostgreSQL tests')
class MigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cluster = disposable_postgres()
        cls.url = cls.cluster.__enter__()
        cls.environment = patch.dict(os.environ, {**{key: '' for key in os.environ if key.startswith('PG')},
                                                 'MIGRATION_DATABASE_URL': cls.url})
        cls.environment.start()
        cls.engine = create_engine(cls.url, hide_parameters=True)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()
        cls.environment.stop()
        cls.cluster.__exit__(None, None, None)

    def setUp(self):
        # This engine is constructed from a URL returned by our newly created
        # local cluster, never from environment/application settings.
        with self.engine.begin() as connection:
            connection.exec_driver_sql('DROP SCHEMA public CASCADE')
            connection.exec_driver_sql('CREATE SCHEMA public')

    def legacy(self, orphan=False):
        with self.engine.begin() as connection:
            connection.exec_driver_sql((ROOT / 'tests/fixtures/legacy_schema.sql').read_text())
            connection.exec_driver_sql("INSERT INTO users(username,password) VALUES ('demo-one','synthetic-hash-one'),('demo-two','synthetic-hash-two')")
            connection.exec_driver_sql("""INSERT INTO internships(company,role,status,application_date,user_id,location,job_url,notes)
                VALUES ('Example Software','Engineering Intern','Applied','2026-09-01',1,NULL,NULL,NULL),
                ('Example Research','AI Intern','Interview','2026-10-01',2,'Remote','https://example.com/job','Synthetic notes'),
                ('Example Data','Data Science Intern','Offer','2026-10-10',1,'Bengaluru',NULL,'Line one\nLine two')""")
            if orphan:
                connection.exec_driver_sql("INSERT INTO internships(company,role,status,application_date,user_id) VALUES ('Orphan Example','Intern','Applied','2026-10-01',9999)")

    def snapshot(self):
        with self.engine.connect() as connection:
            rows = {table: [list(row) for row in connection.execute(text(f'SELECT * FROM {table} ORDER BY id'))]
                    for table in ('users', 'internships')}
        return hashlib.sha256(json.dumps(rows, default=str).encode()).hexdigest()

    def revision(self):
        with self.engine.connect() as connection:
            return connection.execute(text('SELECT version_num FROM public.alembic_version')).scalar_one()

    def report(self, stage='legacy', unversioned=False):
        with self.engine.connect() as connection, connection.begin():
            connection.exec_driver_sql('SET TRANSACTION READ ONLY')
            return inspect_schema(connection, stage, unversioned)

    def test_fresh_database_all_revisions_and_metadata_match(self):
        run('upgrade', VALIDATED)
        self.assertTrue(self.report('validated')['ok'])
        self.assertEqual(self.revision(), VALIDATED)
        from schema import Base
        import models
        with self.engine.connect() as connection:
            differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
        self.assertEqual(differences, [])
        run('check')

    def test_populated_legacy_baseline_upgrade_preserves_all_records_and_sequences(self):
        self.legacy()
        before = self.snapshot()
        self.assertTrue(self.report(unversioned=True)['ok'])
        run('baseline')
        self.assertEqual(self.revision(), BASELINE)
        self.assertEqual(self.snapshot(), before)
        for revision, stage in [(INDEXED, 'indexed'), (PROTECTED, 'protected'), (VALIDATED, 'validated')]:
            run('upgrade', revision)
            self.assertTrue(self.report(stage)['ok'])
            self.assertEqual(self.snapshot(), before)
        with self.engine.begin() as connection:
            new_id = connection.exec_driver_sql("INSERT INTO users(username,password) VALUES ('demo-three','synthetic-hash-three') RETURNING id").scalar_one()
            self.assertEqual(new_id, 3)
            new_app = connection.exec_driver_sql("INSERT INTO internships(company,role,status,application_date,user_id) VALUES ('Example','Intern','Applied','2026-10-24',3) RETURNING id").scalar_one()
            self.assertEqual(new_app, 4)

    def test_orphans_preserved_new_writes_enforced_validation_stops(self):
        self.legacy(orphan=True)
        before = self.snapshot()
        run('baseline')
        run('upgrade', PROTECTED)
        report = self.report('protected')
        self.assertTrue(report['ok'])
        self.assertEqual(report['counts']['orphaned_internships'], 1)
        with self.assertRaises(RuntimeError):
            run('upgrade', VALIDATED)
        self.assertEqual(self.revision(), PROTECTED)
        self.assertEqual(self.snapshot(), before)
        for sql in [
            "INSERT INTO internships(company,role,status,application_date,user_id) VALUES ('Invalid','Intern','Applied','2026-10-24',9999)",
            'UPDATE internships SET user_id=9999 WHERE id=1',
            'DELETE FROM users WHERE id=1',
        ]:
            with self.assertRaises(IntegrityError), self.engine.begin() as connection:
                connection.exec_driver_sql(sql)
        self.assertEqual(self.snapshot(), before)
        # Synthetic-only remediation demonstrates the separate validation step.
        with self.engine.begin() as connection:
            connection.exec_driver_sql("INSERT INTO users(id,username,password) VALUES (9999,'restored-demo','synthetic-hash')")
            connection.exec_driver_sql("SELECT setval('users_id_seq',9999)")
        run('upgrade', VALIDATED)
        self.assertTrue(self.report('validated')['ok'])

    def test_baseline_refuses_drift_without_changing_rows_or_stamping(self):
        self.legacy()
        before = self.snapshot()
        with self.engine.begin() as connection:
            connection.exec_driver_sql('ALTER TABLE internships ALTER COLUMN notes SET DEFAULT \'unexpected\'')
        self.assertFalse(self.report(unversioned=True)['ok'])
        with self.assertRaises(RuntimeError):
            run('baseline')
        self.assertEqual(self.snapshot(), before)
        with self.engine.connect() as connection:
            self.assertIsNone(connection.exec_driver_sql("SELECT to_regclass('public.alembic_version')").scalar())

    def test_sequence_drift_blocks_baseline(self):
        self.legacy()
        with self.engine.begin() as connection:
            connection.exec_driver_sql("SELECT setval('users_id_seq',1,false)")
        report = self.report(unversioned=True)
        self.assertIn('users_sequence_behind_or_nonstandard', report['issues'])
        with self.assertRaises(RuntimeError):
            run('baseline')

    def test_cycling_sequence_blocks_baseline(self):
        self.legacy()
        with self.engine.begin() as connection:
            connection.exec_driver_sql('ALTER SEQUENCE users_id_seq CYCLE')
        self.assertIn('users_nonstandard_sequence', self.report(unversioned=True)['issues'])
        with self.assertRaises(RuntimeError):
            run('baseline')

    def test_baseline_creation_refuses_existing_tables_and_repeated_stamp(self):
        self.legacy()
        before = self.snapshot()
        with self.assertRaises(RuntimeError):
            run('upgrade', BASELINE)
        self.assertEqual(self.snapshot(), before)
        run('baseline')
        with self.assertRaises(RuntimeError):
            run('baseline')
        self.assertEqual(self.revision(), BASELINE)

    def test_populated_downgrade_upgrade_round_trip_preserves_records(self):
        self.legacy()
        run('baseline')
        run('upgrade', VALIDATED)
        before = self.snapshot()
        for revision, stage in [(PROTECTED,'protected'),(INDEXED,'indexed'),(BASELINE,'legacy')]:
            run('downgrade', revision)
            self.assertTrue(self.report(stage)['ok'])
            self.assertEqual(self.snapshot(), before)
        run('upgrade', VALIDATED)
        self.assertEqual(self.snapshot(), before)
        with self.assertRaises(ValueError):
            run('downgrade', 'base')
        with self.assertRaises(ValueError):
            run('upgrade', 'head')

    def test_index_drift_and_nontransactional_retry_stop_safely(self):
        self.legacy()
        run('baseline')
        before = self.snapshot()
        # Simulate index creation committed but revision recording interrupted.
        with self.engine.begin() as connection:
            connection.exec_driver_sql('CREATE INDEX ix_internships_user_id ON internships(user_id)')
        with self.assertRaises(RuntimeError):
            run('upgrade', INDEXED)
        self.assertEqual(self.revision(), BASELINE)
        self.assertEqual(self.snapshot(), before)
        # Explicit test-only operator recovery: remove verified phase-owned index.
        with self.engine.connect().execution_options(isolation_level='AUTOCOMMIT') as connection:
            connection.exec_driver_sql('DROP INDEX CONCURRENTLY public.ix_internships_user_id')
        run('upgrade', INDEXED)
        self.assertTrue(self.report('indexed')['ok'])

    def test_invalid_index_blocks_upgrade(self):
        self.legacy()
        run('baseline')
        before = self.snapshot()
        # A failed unique build is a deterministic way to leave an invalid index.
        with self.engine.connect().execution_options(isolation_level='AUTOCOMMIT') as connection:
            with self.assertRaises(IntegrityError):
                connection.exec_driver_sql('CREATE UNIQUE INDEX CONCURRENTLY ix_internships_user_id ON internships(user_id)')
        self.assertIn('internships_invalid_index', self.report()['issues'])
        with self.assertRaises(RuntimeError):
            run('upgrade', INDEXED)
        self.assertEqual(self.snapshot(), before)
        with self.engine.connect().execution_options(isolation_level='AUTOCOMMIT') as connection:
            connection.exec_driver_sql('DROP INDEX CONCURRENTLY public.ix_internships_user_id')
        run('upgrade', INDEXED)

    def test_lock_timeout_does_not_advance_revision_or_change_data(self):
        self.legacy()
        run('baseline')
        run('upgrade', INDEXED)
        before = self.snapshot()
        with self.engine.connect() as blocker, blocker.begin():
            blocker.exec_driver_sql('LOCK TABLE public.internships IN ROW EXCLUSIVE MODE')
            with self.assertRaises(OperationalError) as error:
                run('upgrade', PROTECTED)
            self.assertEqual(error.exception.orig.pgcode, '55P03')
        self.assertEqual(self.revision(), INDEXED)
        self.assertEqual(self.snapshot(), before)
        run('upgrade', PROTECTED)

    def test_operator_advisory_lock_stops_second_runner(self):
        self.legacy()
        with self.engine.connect() as blocker:
            blocker.exec_driver_sql('SELECT pg_advisory_lock(733126,26)')
            blocker.commit()
            try:
                with self.assertRaises(RuntimeError):
                    run('baseline')
            finally:
                blocker.exec_driver_sql('SELECT pg_advisory_unlock(733126,26)')
                blocker.commit()
        self.assertTrue(self.report(unversioned=True)['ok'])

    def test_preflight_cli_is_read_only_redacted_and_counts_only(self):
        self.legacy(orphan=True)
        before = self.snapshot()
        result = subprocess.run([sys.executable,'-B','scripts/schema_preflight.py','--require-unversioned'],
                                cwd=ROOT, capture_output=True, text=True, check=True)
        report = json.loads(result.stdout)
        self.assertTrue(report['ok'])
        self.assertEqual(report['counts'], {'users':2,'internships':4,'orphaned_internships':1})
        self.assertNotIn('demo-one', result.stdout)
        self.assertNotIn('synthetic-hash', result.stdout)
        self.assertNotIn(self.url, result.stdout + result.stderr)
        self.assertEqual(self.snapshot(), before)

    def test_current_and_check_never_create_bookkeeping_on_legacy_database(self):
        self.legacy()
        before = self.snapshot()
        run('current')
        with self.assertRaises(Exception):
            run('check')
        with self.engine.connect() as connection:
            self.assertIsNone(connection.exec_driver_sql("SELECT to_regclass('public.alembic_version')").scalar())
        self.assertEqual(self.snapshot(), before)

    def test_libpq_target_overrides_are_rejected_before_connecting(self):
        from scripts.schema_preflight import operator_engine
        with patch.dict(os.environ, {'PGHOSTADDR': '127.0.0.2'}):
            with self.assertRaises(RuntimeError):
                operator_engine()
        self.assertFalse(self.report(unversioned=True)['ok'])

    def test_schema_change_and_stamp_shortcuts_are_disabled(self):
        self.legacy()
        before = self.snapshot()
        from alembic import command
        from alembic.config import Config
        with self.assertRaises(RuntimeError):
            command.stamp(Config(str(ROOT / 'alembic.ini')), 'head')
        self.assertEqual(self.snapshot(), before)
        self.assertTrue(self.report(unversioned=True)['ok'])

    def test_disabled_foreign_key_triggers_are_rejected(self):
        run('upgrade', VALIDATED)
        with self.engine.begin() as connection:
            connection.exec_driver_sql('ALTER TABLE internships DISABLE TRIGGER ALL')
        self.assertIn('disabled_or_nonstandard_internal_triggers', self.report('validated')['issues'])

    def test_application_import_does_not_connect_or_create_schema(self):
        environment = dict(os.environ)
        environment['DATABASE_URL'] = 'postgresql://unused@127.0.0.1:1/unused'
        environment['SECRET_KEY'] = 'synthetic-' + 'import-only-key'
        environment['PYTHONDONTWRITEBYTECODE'] = '1'
        environment['PYTHON_DOTENV_DISABLED'] = '1'
        result = subprocess.run([sys.executable, '-B', '-c', 'import main'], cwd=ROOT,
                                env=environment, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, 'Application import must not connect to the unreachable database')

    def test_tools_never_fall_back_to_application_database_or_leak_errors(self):
        environment = dict(os.environ)
        environment.pop('MIGRATION_DATABASE_URL', None)
        environment['DATABASE_URL'] = 'postgresql://unused@127.0.0.1:1/unused'
        for script, arguments in [('scripts/schema_preflight.py', []), ('scripts/migrate.py', ['baseline'])]:
            result = subprocess.run([sys.executable,'-B',script,*arguments], cwd=ROOT,
                                    env=environment, capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertNotIn('postgresql://', result.stdout + result.stderr)
            self.assertNotIn('Traceback', result.stderr)
        self.assertTrue(self.report(unversioned=True)['ok'] is False)  # Empty schema.


@unittest.skipUnless(ENABLED, 'Opt-in disposable PostgreSQL API regressions')
class PostgresApiTests(test_api.ApiTests):
    @classmethod
    def setUpClass(cls):
        if 'database' in sys.modules or 'main' in sys.modules:
            raise RuntimeError('Run PostgreSQL tests in a fresh process')
        cls.cluster = disposable_postgres()
        url = cls.cluster.__enter__()
        cls.environment = patch.dict(os.environ, {
            **{key: '' for key in os.environ if key.startswith('PG')},
            'DATABASE_URL': url, 'MIGRATION_DATABASE_URL': url,
            'SECRET_KEY': 'isolated-test-secret-not-for-production',
            'CORS_ORIGINS': 'https://test-frontend.example/',
            'PYTHON_DOTENV_DISABLED': '1',
            'MAINTENANCE_MODE': 'false',
        })
        cls.environment.start()
        run('upgrade', VALIDATED)
        cls.database = importlib.import_module('database')
        cls.main = importlib.import_module('main')

    def setUp(self):
        with self.database.engine.begin() as connection:
            connection.exec_driver_sql('TRUNCATE public.internships, public.users RESTART IDENTITY')

    @classmethod
    def tearDownClass(cls):
        cls.database.engine.dispose()
        cls.environment.stop()
        cls.cluster.__exit__(None, None, None)

    def test_real_owner_deletion_race_returns_401_and_rolls_back(self):
        token = self.account('alice')
        bob = self.account('bob')
        original = self.main.commit_internship
        def delete_owner_then_commit(db):
            with self.database.engine.begin() as connection:
                connection.exec_driver_sql("DELETE FROM users WHERE username='alice'")
            original(db)
        with patch.object(self.main, 'commit_internship', side_effect=delete_owner_then_commit):
            status, headers, _ = self.request('POST', '/internships',
                {'company': 'Example', 'role': 'Intern', 'status': 'Applied', 'application_date': '2026-10-23'}, token)
        self.assertEqual(status, 401)
        self.assertEqual(headers[b'www-authenticate'], b'Bearer')
        self.assertEqual(headers[b'access-control-allow-origin'], b'https://test-frontend.example')
        self.assertEqual(self.request('GET', '/internships', token=bob)[2], [])
        with self.database.SessionLocal() as db:
            self.assertEqual(db.query(self.main.InternshipDB).count(), 0)


    @contextmanager
    def maintenance(self):
        from db_runtime import build_session_factory
        from maintenance import MaintenanceMiddleware, RuntimeSettings
        from starlette.middleware.cors import CORSMiddleware
        factory = build_session_factory(self.database.engine, maintenance_mode=True)
        original = self.main.app
        gated = CORSMiddleware(MaintenanceMiddleware(original.app, enabled=True),
            allow_origins=['https://test-frontend.example'], allow_credentials=True,
            allow_methods=['GET','HEAD','POST','PUT','DELETE','OPTIONS'], allow_headers=['Authorization','Content-Type'])
        with patch.object(self.main, 'SessionLocal', factory), patch.object(self.main, 'app', gated), \
             patch.object(self.main, 'RUNTIME', RuntimeSettings(maintenance_mode=True)):
            yield

    def test_maintenance_existing_sessions_login_reads_isolation_and_restoration(self):
        token = self.account('alice')
        other = self.account('bob')
        application = {'company':'Example', 'role':'Intern', 'status':'Applied', 'application_date':'2026-10-23'}
        created = self.request('POST', '/internships', application, token)[2]
        path = f"/internships/{created['id']}"
        with self.maintenance():
            self.assertEqual(self.request('POST','/login',{'username':'alice','password':'test-password'})[0], 200)
            self.assertEqual(self.request('GET','/internships',token=token)[2], [created])
            self.assertEqual(self.request('GET','/internships',token=other)[2], [])
            self.assertEqual(self.request('GET','/internships')[0], 401)
            self.assertEqual(self.request('GET','/internships',token='invalid')[0], 401)
            for method, endpoint, body in [('POST','/signup',{'username':'charlie','password':'test-password'}),
                    ('POST','/internships',application),('PUT',path,application),('DELETE',path,None)]:
                status, headers, data = self.request(method, endpoint, body, token)
                self.assertEqual(status, 503)
                self.assertEqual(headers[b'cache-control'], b'no-store')
                self.assertEqual(headers[b'access-control-allow-origin'], b'https://test-frontend.example')
            self.assertEqual(self.request('GET','/internships',token=token)[2], [created])
            self.assertTrue(self.request('GET','/status')[2]['maintenance_mode'])
        application['status'] = 'Interview'
        self.assertEqual(self.request('PUT',path,application,token)[0], 200)
        self.assertEqual(self.request('DELETE',path,token=token)[0], 200)
        self.assertEqual(self.request('POST','/signup',{'username':'charlie','password':'test-password'})[0], 200)


@unittest.skipUnless(ENABLED, 'Opt-in disposable PostgreSQL connection/maintenance tests')
class MaintenanceDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cluster = disposable_postgres()
        cls.url = cls.cluster.__enter__()
        cls.environment = patch.dict(os.environ, {**{key: '' for key in os.environ if key.startswith('PG')},
                                                 'MIGRATION_DATABASE_URL': cls.url})
        cls.environment.start()
        run('upgrade', VALIDATED)

    @classmethod
    def tearDownClass(cls):
        cls.environment.stop()
        cls.cluster.__exit__(None, None, None)

    def setUp(self):
        from maintenance import RuntimeSettings
        from db_runtime import build_engine, build_session_factory
        self.runtime = RuntimeSettings(maintenance_mode=True)
        self.engine = build_engine(self.url, self.runtime)
        self.readonly = build_session_factory(self.engine, True)
        self.normal = build_session_factory(self.engine, False)
        with self.engine.begin() as connection:
            connection.exec_driver_sql('TRUNCATE internships, users RESTART IDENTITY')

    def tearDown(self):
        self.engine.dispose()

    def test_read_only_every_transaction_and_no_leak_after_pool_reuse(self):
        with self.readonly() as db:
            pid = db.execute(text('SELECT pg_backend_pid()')).scalar_one()
            self.assertEqual(db.execute(text('SHOW transaction_read_only')).scalar_one(), 'on')
            self.assertEqual(db.execute(text('SHOW default_transaction_read_only')).scalar_one(), 'off')
            db.commit()
            self.assertEqual(db.execute(text('SHOW transaction_read_only')).scalar_one(), 'on')
            with db.begin_nested():
                self.assertEqual(db.execute(text('SHOW transaction_read_only')).scalar_one(), 'on')
            db.rollback()
            with self.assertRaises(DBAPIError) as error:
                db.execute(text("INSERT INTO users(username,password) VALUES ('blocked','synthetic-hash')"))
            self.assertEqual(error.exception.orig.pgcode, '25006')
            db.rollback()
            self.assertEqual(db.execute(text('SHOW transaction_read_only')).scalar_one(), 'on')
        with self.normal() as db:
            self.assertEqual(db.execute(text('SELECT pg_backend_pid()')).scalar_one(), pid)
            self.assertEqual(db.execute(text('SHOW transaction_read_only')).scalar_one(), 'off')
            db.execute(text("INSERT INTO users(username,password) VALUES ('allowed','synthetic-hash')"))
            db.commit()
        with self.readonly() as db:
            self.assertEqual(db.execute(text('SELECT count(*) FROM users')).scalar_one(), 1)
            db.rollback()
            self.assertEqual(db.execute(text('SHOW transaction_read_only')).scalar_one(), 'on')

    def test_pre_ping_replaces_a_terminated_idle_connection(self):
        with self.engine.connect() as connection:
            old_pid = connection.exec_driver_sql('SELECT pg_backend_pid()').scalar_one()
            app_name = connection.exec_driver_sql('SHOW application_name').scalar_one()
            self.assertIn(self.runtime.instance_id, app_name)
            self.assertLessEqual(len(app_name), 63)
        controller = create_engine(self.url, hide_parameters=True)
        try:
            with controller.connect().execution_options(isolation_level='AUTOCOMMIT') as connection:
                self.assertTrue(connection.execute(text('SELECT pg_terminate_backend(:pid)'), {'pid':old_pid}).scalar_one())
            with self.engine.connect() as connection:
                self.assertNotEqual(connection.exec_driver_sql('SELECT pg_backend_pid()').scalar_one(), old_pid)
                self.assertEqual(connection.exec_driver_sql('SELECT 1').scalar_one(), 1)
        finally:
            controller.dispose()

    def test_disconnect_during_a_transaction_is_not_replayed(self):
        controller = create_engine(self.url, hide_parameters=True)
        try:
            with self.normal() as db:
                pid = db.execute(text('SELECT pg_backend_pid()')).scalar_one()
                db.execute(text("INSERT INTO users(username,password) VALUES ('interrupted','synthetic-hash')"))
                with controller.connect().execution_options(isolation_level='AUTOCOMMIT') as connection:
                    connection.execute(text('SELECT pg_terminate_backend(:pid)'), {'pid':pid})
                with self.assertRaises(DBAPIError):
                    db.commit()
                db.rollback()
            with self.normal() as db:
                self.assertEqual(db.execute(text('SELECT count(*) FROM users')).scalar_one(), 0)
        finally:
            controller.dispose()

    def test_old_admitted_write_may_finish_after_new_generation_is_gated(self):
        # Separate sessions model a legacy instance's admitted transaction and
        # a newly started maintenance instance. The latter cannot stop the former.
        from asgi_helpers import request
        from maintenance import MaintenanceMiddleware
        from starlette.responses import JSONResponse
        async def downstream(scope, receive, send):
            await JSONResponse({'maintenance_mode':True})(scope, receive, send)
        gate = MaintenanceMiddleware(downstream, enabled=True)
        with self.normal() as old:
            old.execute(text("INSERT INTO users(username,password) VALUES ('late-old-write','synthetic-hash')"))
            self.assertEqual(request(gate, 'POST','/signup',forbid_receive=True)[0], 503)
            with self.readonly() as observer:
                self.assertEqual(observer.execute(text('SELECT count(*) FROM users')).scalar_one(), 0)
            old.commit()
            with self.readonly() as observer:
                self.assertEqual(observer.execute(text('SELECT count(*) FROM users')).scalar_one(), 1)
        # A later comparison must include this old-generation commit.

    def test_startup_engine_creation_is_lazy_and_connection_arguments_are_bounded(self):
        from db_runtime import build_engine
        from maintenance import RuntimeSettings
        from unittest.mock import patch
        with patch('db_runtime.create_engine') as constructor:
            build_engine(self.url, RuntimeSettings())
        arguments = constructor.call_args.kwargs
        self.assertTrue(arguments['pool_pre_ping'])
        self.assertTrue(arguments['hide_parameters'])
        self.assertEqual(arguments['connect_args']['connect_timeout'], 10)
        self.assertNotIn('options', arguments['connect_args'])
