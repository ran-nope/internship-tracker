"""Disposable PostgreSQL-backed API for browser tests. Never uses .env credentials."""
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile


def main():
    frontend_port = int(os.environ.get('TEST_FRONTEND_PORT', '5174'))
    if not 1024 <= frontend_port <= 65535:
        raise ValueError('TEST_FRONTEND_PORT must be between 1024 and 65535')
    # libpq environment settings must never redirect disposable test connections.
    for name in list(os.environ):
        if name.startswith('PG'):
            os.environ.pop(name)
    bindir = Path(subprocess.check_output(['pg_config', '--bindir'], text=True).strip())
    required = ['initdb', 'pg_ctl']
    if not all((bindir / name).is_file() for name in required):
        raise RuntimeError('Install PostgreSQL server tools to run browser tests')
    with tempfile.TemporaryDirectory(prefix='internship-phase1-') as temporary:
        root = Path(temporary)
        data = root / 'data'
        log = root / 'postgres.log'
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1', 0))
            port = reservation.getsockname()[1]
        subprocess.run([str(bindir / 'initdb'), '-D', str(data), '-U', 'phase1_test_admin', '--no-locale', '--encoding=UTF8', '--auth=trust'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        started = False
        try:
            subprocess.run([str(bindir / 'pg_ctl'), '-D', str(data), '-l', str(log), '-w', 'start', '-o', f'-h 127.0.0.1 -p {port} -k {root}'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            started = True
            import psycopg2
            connection = psycopg2.connect(host='127.0.0.1', hostaddr='127.0.0.1', port=port,
                                          user='phase1_test_admin', dbname='postgres', connect_timeout=5)
            connection.autocommit = True
            with connection.cursor() as cursor:
                cursor.execute('CREATE DATABASE internship_tracker_test')
            connection.close()
            os.environ['DATABASE_URL'] = f'postgresql://phase1_test_admin@127.0.0.1:{port}/internship_tracker_test?hostaddr=127.0.0.1'
            os.environ['SECRET_KEY'] = 'isolated-browser-test-secret-not-for-production'
            os.environ['CORS_ORIGINS'] = f'http://127.0.0.1:{frontend_port}'
            sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
            import uvicorn
            uvicorn.run('main:app', host='127.0.0.1', port=8001, log_level='warning', access_log=False)
        finally:
            if started:
                subprocess.run([str(bindir / 'pg_ctl'), '-D', str(data), '-m', 'fast', '-w', 'stop'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    def stop(*_):
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, stop)
    main()
