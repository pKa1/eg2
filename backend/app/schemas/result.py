from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime


# Answer schemas
class AnswerBase(BaseModel):
    question_id: int
    answer_data: Dict[str, Any]  # Flexible JSON structure


class AnswerCreate(AnswerBase):
    pass


class AnswerResponse(AnswerBase):
    id: int
    test_result_id: int
    is_correct: Optional[bool] = None
    points_earned: float
    teacher_comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Test Result schemas
class TestResultBase(BaseModel):
    test_id: int
    student_id: int
    score: float = Field(..., ge=0, le=100)
    points_earned: float
    points_total: float
    is_passed: bool
    status: str = "auto_completed"
    pending_answers_count: int = 0
    started_at: datetime
    completed_at: datetime
    time_spent_minutes: Optional[int] = None
    attempt_number: int = 1


class TestResultCreate(TestResultBase):
    answers: List[AnswerCreate] = []


class TestResultResponse(TestResultBase):
    id: int
    created_at: datetime
    student_full_name: Optional[str] = None
    student_username: Optional[str] = None
    answers: List[AnswerResponse] = []

    class Config:
        from_attributes = True


class TestResultListResponse(BaseModel):
    """Simplified result response for list views"""
    id: int
    test_id: int
    test_title: Optional[str] = None
    student_id: int
    student_full_name: Optional[str] = None
    student_username: Optional[str] = None
    score: float
    is_passed: bool
    status: str
    completed_at: datetime
    attempt_number: int
    pending_answers_count: int

    class Config:
        from_attributes = True


# Test attempt schemas (for taking a test)
class TestAttemptStart(BaseModel):
    """Start a test attempt"""
    test_id: int


class TestAttemptSubmit(BaseModel):
    """Submit answers for a test attempt"""
    test_id: int
    started_at: datetime
    answers: List[AnswerCreate]


class GradeAnswerRequest(BaseModel):
    """Manual grading by teacher"""
    answer_id: int
    is_correct: bool
    points_earned: float = Field(..., ge=0)
    teacher_comment: Optional[str] = None

