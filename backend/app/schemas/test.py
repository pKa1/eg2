from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime
from app.models.test import QuestionType, TestStatus


# Question Option schemas
class QuestionOptionBase(BaseModel):
    option_text: str
    is_correct: bool
    order: int
    matching_pair: Optional[str] = None


class QuestionOptionCreate(QuestionOptionBase):
    pass


class QuestionOptionResponse(QuestionOptionBase):
    id: int
    question_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Question schemas
class QuestionBase(BaseModel):
    question_text: str
    question_type: QuestionType
    points: float = Field(default=1.0, ge=0)
    order: int
    correct_answer_text: Optional[str] = None
    explanation: Optional[str] = None


class QuestionCreate(QuestionBase):
    options: List[QuestionOptionCreate] = []


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[QuestionType] = None
    points: Optional[float] = Field(None, ge=0)
    order: Optional[int] = None
    correct_answer_text: Optional[str] = None
    explanation: Optional[str] = None
    options: Optional[List[QuestionOptionCreate]] = None


class QuestionResponse(QuestionBase):
    id: int
    test_id: int
    created_at: datetime
    options: List[QuestionOptionResponse] = []

    class Config:
        from_attributes = True


# Test schemas
class TestBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    passing_score: float = Field(default=60.0, ge=0, le=100)
    max_attempts: Optional[int] = Field(None, ge=1)
    show_results: bool = True
    shuffle_questions: bool = False
    shuffle_options: bool = False
    status: TestStatus = TestStatus.DRAFT


class TestCreate(TestBase):
    questions: List[QuestionCreate] = []


class TestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    passing_score: Optional[float] = Field(None, ge=0, le=100)
    max_attempts: Optional[int] = Field(None, ge=1)
    show_results: Optional[bool] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    status: Optional[TestStatus] = None


class TestResponse(TestBase):
    id: int
    creator_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    questions: List[QuestionResponse] = []

    class Config:
        from_attributes = True


class TestListResponse(BaseModel):
    """Simplified test response for list views"""
    id: int
    title: str
    description: Optional[str] = None
    status: TestStatus
    creator_id: int
    created_at: datetime
    questions_count: int = 0

    class Config:
        from_attributes = True


# Test Assignment schemas
class TestAssignmentBase(BaseModel):
    test_id: int
    student_id: int
    due_date: Optional[datetime] = None


class TestAssignmentCreate(TestAssignmentBase):
    pass


class TestAssignmentResponse(TestAssignmentBase):
    id: int
    assigned_by_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TestAssignmentBulkRequest(BaseModel):
    student_ids: List[int] = []
    group_ids: List[int] = []
    assign_all_students: bool = False
    due_date: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_target(self):
        if not self.assign_all_students and not self.student_ids and not self.group_ids:
            raise ValueError("Не выбрана ни одна аудитория для назначения")
        return self


# Auto create/append schema
class TestAutoWithQuestionCreate(BaseModel):
    """Payload to create a new test (if test_id is not provided) and add a question,
    or append a question to an existing test by id.

    Notes:
    - If test_id is provided, test settings below are ignored (existing test is used).
    - If test_id is not provided, a new test will be created using provided settings
      or sensible defaults.
    """

    # When provided, question will be attached to this test
    test_id: Optional[int] = None

    # Optional test fields (used only when creating a new test)
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    passing_score: Optional[float] = Field(None, ge=0, le=100)
    max_attempts: Optional[int] = Field(None, ge=1)
    show_results: Optional[bool] = True
    shuffle_questions: Optional[bool] = False
    shuffle_options: Optional[bool] = False
    status: Optional[TestStatus] = TestStatus.DRAFT

    # Question to add
    question: QuestionCreate
