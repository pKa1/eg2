"""
add groups and memberships

Revision ID: 9c2a_add_groups
Revises: 8b1f0c9e0d1a
Create Date: 2025-11-06
"""

from alembic import op
import sqlalchemy as sa


revision = '9c2a_add_groups'
down_revision = '8b1f0c9e0d1a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('creator_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )

    op.create_table(
        'group_memberships',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('added_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('group_id', 'student_id', name='uix_group_student')
    )


def downgrade() -> None:
    op.drop_table('group_memberships')
    op.drop_table('groups')


