"""Legacy schema only. Existing matching databases are baselined without DDL."""
from alembic import op
import sqlalchemy as sa

revision = '0001_legacy_baseline'
down_revision = None
branch_labels = depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if set(inspector.get_table_names(schema='public')) - {'alembic_version'}:
        raise RuntimeError('Baseline creation requires an empty public schema; use verified baseline for existing tables')
    if inspector.get_view_names(schema='public') or inspector.get_materialized_view_names(schema='public'):
        raise RuntimeError('Unexpected public views require manual review')
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(), nullable=False, unique=True),
        sa.Column('password', sa.String(), nullable=False), schema='public')
    op.create_index('ix_users_id', 'users', ['id'], schema='public')
    op.create_table('internships',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('company', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('application_date', sa.Date(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('job_url', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True), schema='public')
    op.create_index('ix_internships_id', 'internships', ['id'], schema='public')


def downgrade():
    raise RuntimeError('Baseline downgrade is prohibited: it would destroy application tables')
