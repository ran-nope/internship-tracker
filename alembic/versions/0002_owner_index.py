"""Add owner index separately; a failed concurrent build requires manual recovery."""
from alembic import op
from scripts.schema_preflight import require_stage

revision = '0002_owner_index'
down_revision = '0001_legacy_baseline'
branch_labels = depends_on = None


def upgrade():
    require_stage(op.get_bind(), 'legacy')
    with op.get_context().autocommit_block():
        op.create_index('ix_internships_user_id', 'internships', ['user_id'],
                        schema='public', postgresql_concurrently=True)


def downgrade():
    require_stage(op.get_bind(), 'indexed')
    with op.get_context().autocommit_block():
        op.drop_index('ix_internships_user_id', table_name='internships',
                      schema='public', postgresql_concurrently=True)
