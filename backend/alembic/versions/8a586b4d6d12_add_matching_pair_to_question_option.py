"""add matching_pair column to question_options"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8a586b4d6d12"
down_revision: Union[str, None] = "535ee9e643d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("question_options", sa.Column("matching_pair", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("question_options", "matching_pair")

