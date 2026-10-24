"""Read-only PostgreSQL schema contract and aggregate data checks.

Never loads .env, prints URLs, records, SQL errors, or credentials. Importing this
module does not import application configuration or open a connection.
"""
import argparse
import json
import os
from pathlib import Path
import sys

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

BASELINE = '0001_legacy_baseline'
INDEXED = '0002_owner_index'
PROTECTED = '0003_owner_foreign_key'
VALIDATED = '0004_validate_owner_fk'
FK = 'fk_internships_user_id_users'
INDEX = 'ix_internships_user_id'
STAGES = {'legacy': BASELINE, 'indexed': INDEXED, 'protected': PROTECTED, 'validated': VALIDATED}
COLUMNS = {
    'users': {'id': ('INTEGER', False), 'username': ('VARCHAR', False), 'password': ('VARCHAR', False)},
    'internships': {
        'id': ('INTEGER', False), 'company': ('VARCHAR', False), 'role': ('VARCHAR', False),
        'status': ('VARCHAR', False), 'application_date': ('DATE', False),
        'user_id': ('INTEGER', False), 'location': ('VARCHAR', True),
        'job_url': ('VARCHAR', True), 'notes': ('TEXT', True),
    },
}


def operator_engine():
    raw = os.environ.get('MIGRATION_DATABASE_URL')
    if not raw:
        raise RuntimeError('MIGRATION_DATABASE_URL must be explicitly supplied; .env is never loaded')
    if any(value for key, value in os.environ.items() if key.startswith('PG')):
        raise RuntimeError('Clear libpq PG* overrides before selecting a migration target')
    url = make_url(raw)
    if not url.host or not url.database or not url.username:
        raise RuntimeError('An explicit host, database, and username are required')
    if url.drivername not in {'postgresql', 'postgresql+psycopg2'}:
        raise RuntimeError('Migration tools require PostgreSQL using psycopg2')
    # Reject query options that could override the intended host/database/user.
    if set(url.query) - {'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'channel_binding'}:
        raise RuntimeError('Unsupported database URL options; review the explicit target')
    timeout = int(os.environ.get('MIGRATION_STATEMENT_TIMEOUT_SECONDS', '60'))
    if not 1 <= timeout <= 3600:
        raise RuntimeError('Migration statement timeout must be between 1 and 3600 seconds')
    return create_engine(url, poolclass=NullPool, hide_parameters=True, connect_args={
        'connect_timeout': 5,
        'options': f'-c search_path=public -c lock_timeout=3s -c statement_timeout={timeout}s',
    })


def inspect_schema(connection, stage='legacy', require_unversioned=False):
    """Return only fixed diagnostic codes and aggregate counts. Never alter data."""
    if stage not in STAGES:
        raise ValueError('Unknown schema stage')
    inspector = inspect(connection)
    issues = []
    if connection.exec_driver_sql('SHOW session_replication_role').scalar_one() != 'origin':
        issues.append('nonstandard_session_replication_role')
    tables = set(inspector.get_table_names(schema='public'))
    if tables - {'users', 'internships', 'alembic_version'}:
        issues.append('unexpected_public_tables')
    if not {'users', 'internships'} <= tables:
        return {'ok': False, 'issues': issues + ['missing_application_tables']}
    if inspector.get_view_names(schema='public') or inspector.get_materialized_view_names(schema='public'):
        issues.append('unexpected_public_views')
    revision = None
    if 'alembic_version' in tables:
        versions = connection.execute(text('SELECT version_num FROM public.alembic_version')).scalars().all()
        if require_unversioned or len(versions) != 1 or versions[0] not in STAGES.values():
            issues.append('unexpected_migration_version')
        else:
            revision = versions[0]
    elif not require_unversioned:
        issues.append('missing_migration_version')
    # Revision changes are made after each migration body, so schema stage and
    # version agreement is checked by callers outside revision bodies.
    counts = {}
    for table, expected in COLUMNS.items():
        columns = inspector.get_columns(table, schema='public')
        actual = {c['name']: (str(c['type']), c['nullable']) for c in columns}
        if actual != expected:
            issues.append(f'{table}_columns_drift')
        for column in columns:
            if column['name'] == 'id':
                if (column.get('identity') or column.get('computed')
                        or not (column.get('default') or '').startswith('nextval(')):
                    issues.append(f'{table}_id_default_drift')
            elif column.get('default') is not None or column.get('identity') or column.get('computed'):
                issues.append(f'{table}_column_default_drift')
        if inspector.get_pk_constraint(table, schema='public')['constrained_columns'] != ['id']:
            issues.append(f'{table}_primary_key_drift')
        uniques = inspector.get_unique_constraints(table, schema='public')
        if [u['column_names'] for u in uniques] != ([['username']] if table == 'users' else []):
            issues.append(f'{table}_unique_constraint_drift')
        if inspector.get_check_constraints(table, schema='public'):
            issues.append(f'{table}_unexpected_check_constraints')
        indexes = inspector.get_indexes(table, schema='public')
        indexes = [i for i in indexes if not i.get('duplicates_constraint')]
        wanted = {f'ix_{table}_id': ['id']}
        if table == 'internships' and stage != 'legacy':
            wanted[INDEX] = ['user_id']
        if {i['name']: i['column_names'] for i in indexes} != wanted:
            issues.append(f'{table}_index_definition_drift')
        for index in indexes:
            options = index.get('dialect_options', {})
            if index['unique'] or any(options.get(key) for key in (
                'postgresql_where', 'postgresql_include', 'postgresql_ops',
            )) or options.get('postgresql_using', 'btree') != 'btree' or index.get('column_sorting'):
                issues.append(f'{table}_index_options_drift')
        valid_indexes = connection.execute(text('''
            SELECT bool_and(i.indisvalid AND i.indisready)
            FROM pg_index i WHERE i.indrelid = to_regclass(:table)
        '''), {'table': f'public.{table}'}).scalar()
        if valid_indexes is not True:
            issues.append(f'{table}_invalid_index')
        counts[table] = connection.execute(text(f'SELECT count(*) FROM public.{table}')).scalar_one()
        # Read sequence state without calling nextval or advancing anything.
        seq = connection.execute(text('SELECT pg_get_serial_sequence(:table, :column)'),
                                 {'table': f'public.{table}', 'column': 'id'}).scalar()
        if seq is None:
            issues.append(f'{table}_missing_owned_sequence')
        else:
            seq_info = connection.execute(text('''SELECT c.relname, n.nspname, s.seqincrement, s.seqcycle
                FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_sequence s ON s.seqrelid = c.oid
                WHERE c.oid = to_regclass(:seq)'''), {'seq': seq}).one()
            if seq_info.nspname != 'public' or seq_info.seqcycle:
                issues.append(f'{table}_nonstandard_sequence')
            quoted_schema = connection.dialect.identifier_preparer.quote(seq_info.nspname)
            quoted = connection.dialect.identifier_preparer.quote(seq_info.relname)
            state = connection.execute(text(f'SELECT last_value, is_called FROM {quoted_schema}.{quoted}')).one()
            increment = seq_info.seqincrement
            maximum = connection.execute(text(f'SELECT max(id) FROM public.{table}')).scalar()
            candidate = state.last_value + increment if state.is_called else state.last_value
            if increment != 1 or (maximum is not None and candidate <= maximum):
                issues.append(f'{table}_sequence_behind_or_nonstandard')
        fks = inspector.get_foreign_keys(table, schema='public')
        if table == 'internships' and stage in {'protected', 'validated'}:
            if len(fks) != 1:
                issues.append('owner_foreign_key_missing_or_extra')
            else:
                fk = fks[0]
                if (fk['name'] != FK or fk['constrained_columns'] != ['user_id']
                        or fk['referred_table'] != 'users' or fk['referred_columns'] != ['id']
                        or fk.get('referred_schema') not in {None, 'public'}
                        or fk['options'].get('ondelete') != 'RESTRICT'
                        or fk['options'].get('onupdate', 'NO ACTION') != 'NO ACTION'
                        or fk['options'].get('deferrable', False)):
                    issues.append('owner_foreign_key_definition_drift')
                valid = connection.execute(text('''SELECT convalidated FROM pg_constraint
                    WHERE conrelid = 'public.internships'::regclass AND conname = :name'''), {'name': FK}).scalar()
                if valid != (stage == 'validated'):
                    issues.append('owner_foreign_key_validation_state_drift')
        elif fks:
            issues.append(f'{table}_unexpected_foreign_key')
    # Skip content queries when columns differ; avoid errors or misleading counts.
    if not any('columns_drift' in issue for issue in issues):
        orphans = connection.execute(text('''SELECT count(*) FROM public.internships i
            WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = i.user_id)''')).scalar_one()
        counts['orphaned_internships'] = orphans
        if stage == 'validated' and orphans:
            issues.append('orphaned_internships_block_validation')
    disabled_internal = connection.execute(text('''SELECT count(*) FROM pg_trigger
        WHERE tgrelid IN ('public.users'::regclass, 'public.internships'::regclass)
        AND tgisinternal AND tgenabled <> 'O' ''')).scalar_one()
    if disabled_internal:
        issues.append('disabled_or_nonstandard_internal_triggers')
    nonordinary = connection.execute(text('''SELECT count(*) FROM pg_class
        WHERE oid IN ('public.users'::regclass, 'public.internships'::regclass)
        AND (relkind <> 'r' OR relispartition)''')).scalar_one()
    if nonordinary:
        issues.append('partitioned_or_nonordinary_tables_require_review')
    triggers = connection.execute(text('''SELECT count(*) FROM pg_trigger
        WHERE tgrelid IN ('public.users'::regclass, 'public.internships'::regclass)
        AND NOT tgisinternal''')).scalar_one()
    rls = connection.execute(text('''SELECT bool_or(relrowsecurity OR relforcerowsecurity)
        FROM pg_class WHERE oid IN ('public.users'::regclass, 'public.internships'::regclass)''')).scalar()
    if triggers or rls:
        issues.append('custom_triggers_or_row_security_require_review')
    return {'ok': not issues, 'stage': stage, 'revision': revision,
            'issues': sorted(set(issues)), 'counts': counts,
            'postgresql_major': connection.dialect.server_version_info[0]}


def require_stage(connection, stage):
    report = inspect_schema(connection, stage)
    if not report['ok']:
        raise RuntimeError('Schema preflight failed: ' + ', '.join(report['issues']))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', choices=STAGES, default='legacy')
    parser.add_argument('--require-unversioned', action='store_true')
    args = parser.parse_args()
    try:
        engine = operator_engine()
        try:
            with engine.connect() as connection, connection.begin():
                connection.exec_driver_sql('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
                report = inspect_schema(connection, args.stage, args.require_unversioned)
                if not args.require_unversioned and report.get('revision') != STAGES[args.stage]:
                    report['issues'].append('revision_does_not_match_stage')
                    report['ok'] = False
        finally:
            engine.dispose()
        print(json.dumps(report, sort_keys=True))
        return 0 if report['ok'] else 1
    except Exception:
        print('Preflight stopped: connection, permissions, timeout, or schema inspection failed. Details suppressed.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    raise SystemExit(main())
