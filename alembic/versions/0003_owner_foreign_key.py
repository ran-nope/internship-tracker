"""Enforce new ownership writes without scanning/deleting legacy orphans."""
from alembic import op
from scripts.schema_preflight import require_stage

revision = '0003_owner_foreign_key'
down_revision = '0002_owner_index'
branch_labels = depends_on = None


def upgrade():
    require_stage(op.get_bind(), 'indexed')
    op.create_foreign_key('fk_internships_user_id_users', 'internships', 'users',
        ['user_id'], ['id'], source_schema='public', referent_schema='public',
        ondelete='RESTRICT', postgresql_not_valid=True)


def downgrade():
    require_stage(op.get_bind(), 'protected')
    op.drop_constraint('fk_internships_user_id_users', 'internships', schema='public', type_='foreignkey')
