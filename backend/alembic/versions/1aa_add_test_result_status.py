"""add test result status columns

Revision ID: 1aa_add_test_result_status
Revises: 9c2a_add_groups
Create Date: 2025-02-15 12:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '1aa_add_test_result_status'
down_revision = '9c2a_add_groups'
branch_labels = None
depends_on = None


STATUSES = ('auto_completed', 'pending_manual', 'completed')


def upgrade():
    status_enum = sa.Enum(*STATUSES, name='testresultstatus')
    status_enum.create(op.get_bind())

    op.add_column('test_results', sa.Column('status', status_enum, nullable=False, server_default='auto_completed'))
    op.add_column('test_results', sa.Column('pending_answers_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('test_results', 'pending_answers_count')
    op.drop_column('test_results', 'status')
    sa.Enum(name='testresultstatus').drop(op.get_bind())


