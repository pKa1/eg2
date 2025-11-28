from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TestResult(Base):
    """Test result model - stores completed test attempts"""
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Result data
    score = Column(Float, nullable=False)  # Percentage score (0-100)
    points_earned = Column(Float, nullable=False)
    points_total = Column(Float, nullable=False)
    is_passed = Column(Boolean, nullable=False)
    status = Column(SQLEnum(
        "auto_completed",
        "pending_manual",
        "completed",
        name="testresultstatus"
    ), nullable=False, default="auto_completed")
    pending_answers_count = Column(Integer, nullable=False, default=0)
    
    # Timing
    started_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=False)
    time_spent_minutes = Column(Integer, nullable=True)
    
    # Metadata
    attempt_number = Column(Integer, nullable=False, default=1)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    test = relationship("Test", back_populates="results")
    student = relationship("User", back_populates="test_results", foreign_keys=[student_id])
    answers = relationship("Answer", back_populates="test_result", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<TestResult(id={self.id}, score={self.score}, is_passed={self.is_passed})>"


class Answer(Base):
    """Answer model - stores student's answer to a question"""
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    test_result_id = Column(Integer, ForeignKey("test_results.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    
    # Answer data - flexible storage
    # For multiple choice: JSON array of selected option IDs
    # For text answers: JSON object with text field
    answer_data = Column(JSON, nullable=False)
    
    # Scoring
    is_correct = Column(Boolean, nullable=True)  # NULL for manual grading
    points_earned = Column(Float, nullable=False, default=0.0)
    
    # Teacher feedback (for essay/short answer)
    teacher_comment = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    test_result = relationship("TestResult", back_populates="answers")
    question = relationship("Question", back_populates="answers")

    def __repr__(self):
        return f"<Answer(id={self.id}, is_correct={self.is_correct})>"

