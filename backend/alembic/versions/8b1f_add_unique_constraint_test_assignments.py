"""
add unique constraint on test_assignments (test_id, student_id)

Revision ID: 8b1f0c9e0d1a
Revises: 8a586b4d6d12
Create Date: 2025-11-06
"""

from typing import Sequence, Union
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '8b1f0c9e0d1a'
down_revision: Union[str, None] = '8a586b4d6d12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uix_test_assignments_test_student',
        'test_assignments',
        ['test_id', 'student_id']
    )


def downgrade() -> None:
    op.drop_constraint(
        'uix_test_assignments_test_student',
        'test_assignments',
        type_='unique'
    )


