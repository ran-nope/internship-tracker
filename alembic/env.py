"""Explicit operator-only migrations. Never load application .env or main.py."""
from alembic import context
from sqlalchemy import text

from schema import Base
import models  # noqa: F401 -- register tables without importing database.py
from scripts.schema_preflight import BASELINE, inspect_schema, operator_engine

config = context.config
operation = config.attributes.get('operator_operation')
if operation not in {'upgrade', 'downgrade', 'baseline', 'current', 'check'}:
    raise RuntimeError('Use scripts/migrate.py; direct Alembic execution is disabled')
if context.is_offline_mode():
    raise RuntimeError('Offline migrations are disabled; inspect revision SQL in source')


def verify_version_step(ctx, step, heads, run_args):
    if step.is_stamp and not (
        operation == 'baseline' and step.up_revision_id == BASELINE
    ):
        raise RuntimeError('Only the verified legacy baseline may be stamped')


engine = operator_engine()
try:
    with engine.connect() as connection:
        # A session-level lock survives commits and the concurrent-index block.
        locked = connection.execute(text('SELECT pg_try_advisory_lock(733126, 26)')).scalar_one()
        connection.commit()
        if not locked:
            raise RuntimeError('Another migration operator holds the database lock')
        try:
            if operation in {'current', 'check'}:
                connection.exec_driver_sql('SET default_transaction_read_only = on')
                connection.commit()
            if operation == 'baseline':
                with connection.begin():
                    report = inspect_schema(connection, 'legacy', require_unversioned=True)
                    if not report['ok']:
                        raise RuntimeError('Baseline schema preflight failed')
            context.configure(
                connection=connection, target_metadata=Base.metadata,
                include_schemas=False,
                compare_type=True, transaction_per_migration=True,
                dont_mutate=operation in {'current', 'check'},
                on_version_apply=verify_version_step,
            )
            with context.begin_transaction():
                context.run_migrations()
        finally:
            connection.rollback()
            connection.execute(text('SELECT pg_advisory_unlock(733126, 26)'))
            connection.commit()
finally:
    engine.dispose()
