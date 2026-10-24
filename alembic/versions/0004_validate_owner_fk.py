"""Validate historical ownership only after a clean orphan audit."""
from alembic import op
from scripts.schema_preflight import require_stage

revision = '0004_validate_owner_fk'
down_revision = '0003_owner_foreign_key'
branch_labels = depends_on = None


def upgrade():
    report = require_stage(op.get_bind(), 'protected')
    if report['counts']['orphaned_internships']:
        raise RuntimeError('Orphans remain; validation stopped without changing application records')
    op.execute('ALTER TABLE public.internships VALIDATE CONSTRAINT fk_internships_user_id_users')


def downgrade():
    # PostgreSQL cannot unvalidate an existing FK. Reinstall NOT VALID in one
    # transaction; no window is exposed to other transactions without the FK.
    require_stage(op.get_bind(), 'validated')
    op.drop_constraint('fk_internships_user_id_users', 'internships', schema='public', type_='foreignkey')
    op.create_foreign_key('fk_internships_user_id_users', 'internships', 'users',
        ['user_id'], ['id'], source_schema='public', referent_schema='public',
        ondelete='RESTRICT', postgresql_not_valid=True)
