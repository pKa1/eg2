from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class QuestionType(str, enum.Enum):
    """Question type enumeration"""
    SINGLE_CHOICE = "single_choice"  # Один правильный ответ
    MULTIPLE_CHOICE = "multiple_choice"  # Несколько правильных ответов
    TRUE_FALSE = "true_false"  # Правда/Ложь
    SHORT_ANSWER = "short_answer"  # Короткий текстовый ответ
    ESSAY = "essay"  # Развернутый ответ
    MATCHING = "matching"  # Соответствие
    FILL_IN_BLANK = "fill_in_blank"  # Заполнить пропуски
    ORDERING = "ordering"  # Упорядочивание
    NUMERIC = "numeric"  # Числовой ответ
    FILE_UPLOAD = "file_upload"  # Загрузка файла
    CODE = "code"  # Код


class TestStatus(str, enum.Enum):
    """Test status enumeration"""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Test(Base):
    """Test model - contains test information and questions"""
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Test settings
    duration_minutes = Column(Integer, nullable=True)  # NULL = unlimited
    passing_score = Column(Float, nullable=False, default=60.0)  # Percentage to pass
    max_attempts = Column(Integer, nullable=True)  # NULL = unlimited
    show_results = Column(Boolean, default=True)  # Show results to student
    shuffle_questions = Column(Boolean, default=False)
    shuffle_options = Column(Boolean, default=False)
    
    status = Column(SQLEnum(TestStatus, values_callable=lambda x: [e.value for e in x]), default=TestStatus.DRAFT, nullable=False)
    
    # Creator
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    creator = relationship("User", back_populates="created_tests", foreign_keys=[creator_id])
    questions = relationship("Question", back_populates="test", cascade="all, delete-orphan")
    assignments = relationship("TestAssignment", back_populates="test", cascade="all, delete-orphan")
    results = relationship("TestResult", back_populates="test", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Test(id={self.id}, title={self.title}, status={self.status})>"


class Question(Base):
    """Question model - individual question in a test"""
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    
    question_text = Column(Text, nullable=False)
    question_type = Column(SQLEnum(QuestionType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    points = Column(Float, default=1.0, nullable=False)
    order = Column(Integer, nullable=False)  # Order in test
    
    # For short answer/essay questions
    correct_answer_text = Column(Text, nullable=True)
    
    # Explanation (shown after answering)
    explanation = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    test = relationship("Test", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Question(id={self.id}, type={self.question_type})>"


class QuestionOption(Base):
    """Question option model - for multiple choice questions"""
    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)
    order = Column(Integer, nullable=False)  # Order in question
    matching_pair = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    question = relationship("Question", back_populates="options")

    def __repr__(self):
        return f"<QuestionOption(id={self.id}, is_correct={self.is_correct})>"


class TestAssignment(Base):
    """Test assignment - assigns test to specific student(s)"""
    __tablename__ = "test_assignments"
    __table_args__ = (
        UniqueConstraint("test_id", "student_id", name="uix_test_assignments_test_student"),
    )

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Assignment settings
    assigned_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    test = relationship("Test", back_populates="assignments")
    student = relationship("User", back_populates="test_assignments", foreign_keys=[student_id])

    def __repr__(self):
        return f"<TestAssignment(id={self.id}, test_id={self.test_id}, student_id={self.student_id})>"

