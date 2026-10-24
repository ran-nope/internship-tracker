"""Disposable PostgreSQL-backed API for browser tests. Never uses .env credentials."""
import os
from pathlib import Path
import signal
import sys

from disposable_postgres import disposable_postgres


def main():
    frontend_port = int(os.environ.get('TEST_FRONTEND_PORT', '5174'))
    if not 1024 <= frontend_port <= 65535:
        raise ValueError('TEST_FRONTEND_PORT must be between 1024 and 65535')
    # libpq environment settings must never redirect disposable test connections.
    for name in list(os.environ):
        if name.startswith('PG'):
            os.environ.pop(name)
    with disposable_postgres() as url:
        os.environ['PYTHON_DOTENV_DISABLED'] = '1'
        os.environ['MAINTENANCE_MODE'] = 'false'
        os.environ['DATABASE_URL'] = url
        os.environ['MIGRATION_DATABASE_URL'] = url
        os.environ['SECRET_KEY'] = 'isolated-browser-test-secret-not-for-production'
        os.environ['CORS_ORIGINS'] = f'http://127.0.0.1:{frontend_port}'
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from scripts.migrate import run
        from scripts.schema_preflight import VALIDATED
        run('upgrade', VALIDATED)
        import uvicorn
        uvicorn.run('main:app', host='127.0.0.1', port=8001, log_level='warning', access_log=False)


if __name__ == '__main__':
    def stop(*_):
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, stop)
    main()
