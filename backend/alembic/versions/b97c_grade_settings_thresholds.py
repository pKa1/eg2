"""
add grade settings thresholds table

Revision ID: b97c_grade_settings
Revises: 9c2a_add_groups
Create Date: 2025-12-06
"""

from alembic import op
import sqlalchemy as sa


revision = 'b97c_grade_settings'
down_revision = '9c2a_add_groups'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'grade_settings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('grade3_min', sa.Float(), nullable=False, server_default='33'),
        sa.Column('grade4_min', sa.Float(), nullable=False, server_default='66'),
        sa.Column('grade5_min', sa.Float(), nullable=False, server_default='85'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )

    # ensure a single default row exists
    op.execute(
        "INSERT INTO grade_settings (id, grade3_min, grade4_min, grade5_min) VALUES (1, 33, 66, 85) ON CONFLICT DO NOTHING"
    )


def downgrade() -> None:
    op.drop_table('grade_settings')


