"""add_new_question_types

Revision ID: 535ee9e643d2
Revises: 001
Create Date: 2025-11-05 13:57:02.786874

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '535ee9e643d2'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем новые типы вопросов в enum
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'matching'")
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'fill_in_blank'")
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'ordering'")
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'numeric'")
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'file_upload'")
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'code'")


def downgrade() -> None:
    # PostgreSQL не поддерживает удаление значений из enum
    # Если нужно откатить изменения, придется пересоздать enum
    pass

