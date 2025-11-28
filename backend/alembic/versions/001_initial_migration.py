"""Initial migration

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enum types will be created automatically by SQLAlchemy when creating tables
    # No need to create them manually to avoid conflicts
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('role', postgresql.ENUM('admin', 'teacher', 'student', 'parent', name='userrole'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    
    # Create parent_child table
    op.create_table(
        'parent_child',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['parent_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['child_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_parent_child_id', 'parent_child', ['id'])
    
    # Create tests table
    op.create_table(
        'tests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('passing_score', sa.Float(), nullable=False, server_default='60.0'),
        sa.Column('max_attempts', sa.Integer(), nullable=True),
        sa.Column('show_results', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('shuffle_questions', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('shuffle_options', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('status', postgresql.ENUM('draft', 'published', 'archived', name='teststatus'), nullable=False, server_default='draft'),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tests_id', 'tests', ['id'])
    
    # Create questions table
    op.create_table(
        'questions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('test_id', sa.Integer(), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('question_type', postgresql.ENUM('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay', name='questiontype'), nullable=False),
        sa.Column('points', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('correct_answer_text', sa.Text(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['test_id'], ['tests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_questions_id', 'questions', ['id'])
    
    # Create question_options table
    op.create_table(
        'question_options',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('option_text', sa.Text(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_question_options_id', 'question_options', ['id'])
    
    # Create test_assignments table
    op.create_table(
        'test_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('test_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('assigned_by_id', sa.Integer(), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['test_id'], ['tests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_test_assignments_id', 'test_assignments', ['id'])
    
    # Create test_results table
    op.create_table(
        'test_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('test_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('points_earned', sa.Float(), nullable=False),
        sa.Column('points_total', sa.Float(), nullable=False),
        sa.Column('is_passed', sa.Boolean(), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('time_spent_minutes', sa.Integer(), nullable=True),
        sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['test_id'], ['tests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_test_results_id', 'test_results', ['id'])
    
    # Create answers table
    op.create_table(
        'answers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('test_result_id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('answer_data', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('points_earned', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('teacher_comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['test_result_id'], ['test_results.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_answers_id', 'answers', ['id'])


def downgrade() -> None:
    # Drop tables
    op.drop_index('ix_answers_id', table_name='answers')
    op.drop_table('answers')
    
    op.drop_index('ix_test_results_id', table_name='test_results')
    op.drop_table('test_results')
    
    op.drop_index('ix_test_assignments_id', table_name='test_assignments')
    op.drop_table('test_assignments')
    
    op.drop_index('ix_question_options_id', table_name='question_options')
    op.drop_table('question_options')
    
    op.drop_index('ix_questions_id', table_name='questions')
    op.drop_table('questions')
    
    op.drop_index('ix_tests_id', table_name='tests')
    op.drop_table('tests')
    
    op.drop_index('ix_parent_child_id', table_name='parent_child')
    op.drop_table('parent_child')
    
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    op.drop_table('users')
    
    # Enum types will be dropped automatically by SQLAlchemy CASCADE

