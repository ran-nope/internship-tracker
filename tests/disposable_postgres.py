"""New local cluster only. Never reads .env or reuses a configured database."""
from contextlib import contextmanager
import os
from pathlib import Path
import socket
import subprocess
import tempfile


@contextmanager
def disposable_postgres():
    environment = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    bindir = Path(subprocess.check_output(['pg_config', '--bindir'], text=True, env=environment).strip())
    if not all((bindir / name).is_file() for name in ('initdb', 'pg_ctl')):
        raise RuntimeError('PostgreSQL server tools are required')
    with tempfile.TemporaryDirectory(prefix='internship-disposable-') as temporary:
        root = Path(temporary)
        data = root / 'data'
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1', 0))
            port = reservation.getsockname()[1]
        subprocess.run([str(bindir / 'initdb'), '-D', str(data), '-U', 'phase1_test_admin',
                        '--no-locale', '--encoding=UTF8', '--auth=trust'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=environment)
        started = False
        try:
            subprocess.run([str(bindir / 'pg_ctl'), '-D', str(data), '-l', str(root / 'postgres.log'),
                            '-w', 'start', '-o', f'-h 127.0.0.1 -p {port} -k {root}'],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=environment)
            started = True
            import psycopg2
            connection = psycopg2.connect(host='127.0.0.1', hostaddr='127.0.0.1', port=port,
                                          user='phase1_test_admin', dbname='postgres', connect_timeout=5)
            connection.autocommit = True
            with connection.cursor() as cursor:
                cursor.execute('CREATE DATABASE internship_tracker_test')
            connection.close()
            yield f'postgresql://phase1_test_admin@127.0.0.1:{port}/internship_tracker_test'
        finally:
            if started:
                subprocess.run([str(bindir / 'pg_ctl'), '-D', str(data), '-m', 'fast', '-w', 'stop'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=environment, check=True)
