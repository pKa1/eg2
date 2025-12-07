"""extend student profile fields

Revision ID: 2ac_student_profile
Revises: 1aa_add_test_result_status
Create Date: 2025-03-01 12:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '2ac_student_profile'
down_revision = '1aa_add_test_result_status'
branch_labels = None
depends_on = None


GENDERS = ('male', 'female')


def upgrade():
    gender_enum = sa.Enum(*GENDERS, name='studentgender')
    gender_enum.create(op.get_bind())

    op.add_column('users', sa.Column('gender', gender_enum, nullable=True))
    op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('school_name', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('class_number', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('class_letter', sa.String(length=10), nullable=True))


def downgrade():
    op.drop_column('users', 'class_letter')
    op.drop_column('users', 'class_number')
    op.drop_column('users', 'school_name')
    op.drop_column('users', 'date_of_birth')
    op.drop_column('users', 'gender')

    sa.Enum(name='studentgender').drop(op.get_bind())


