from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.test import Test, Question, QuestionOption, TestStatus, TestAssignment
from app.models.group import Group, GroupMembership
from app.schemas.test import (
    TestCreate, TestUpdate, TestResponse, TestListResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse,
    TestAssignmentCreate, TestAssignmentResponse,
    TestAutoWithQuestionCreate, TestAssignmentBulkRequest
)
from app.api.dependencies import get_current_user, require_teacher
from app.services.tests_service import normalize_question_options
from app.core.config import settings

router = APIRouter()


def _ensure_can_manage_test(test: Test, user: User, detail: str = "Not authorized to manage this test") -> None:
    """Ensure teacher users can only manage their own tests."""
    if user.role == UserRole.TEACHER and test.creator_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


@router.get("/", response_model=List[TestListResponse])
async def get_tests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: Optional[TestStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all tests available to current user"""
    
    query = select(Test)
    
    # Filter by role
    if current_user.role == UserRole.TEACHER:
        # Teachers see their own tests
        query = query.where(Test.creator_id == current_user.id)
    elif current_user.role == UserRole.STUDENT:
        query = (
            query.join(TestAssignment, TestAssignment.test_id == Test.id)
            .where(
                TestAssignment.student_id == current_user.id,
                Test.status == TestStatus.PUBLISHED,
            )
            .distinct()
        )
    elif current_user.role == UserRole.ADMIN:
        # Admins see all tests
        pass
    else:
        # Parents should use different endpoint
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Parents should access tests through child's results"
        )
    
    if status:
        query = query.where(Test.status == status)
    
    query = query.offset(skip).limit(limit).order_by(Test.created_at.desc())
    result = await db.execute(query)
    tests = result.scalars().all()

    if not tests:
        return []

    # Aggregate question counts in a single query
    test_ids = [t.id for t in tests]
    counts_result = await db.execute(
        select(Question.test_id, func.count().label("cnt"))
        .where(Question.test_id.in_(test_ids))
        .group_by(Question.test_id)
    )
    counts_map = {row[0]: row[1] for row in counts_result.all()}

    response_tests = []
    for test in tests:
        test_dict = {
            "id": test.id,
            "title": test.title,
            "description": test.description,
            "status": test.status,
            "creator_id": test.creator_id,
            "created_at": test.created_at,
            "questions_count": counts_map.get(test.id, 0),
        }
        response_tests.append(TestListResponse(**test_dict))

    return response_tests


@router.get("/{test_id}", response_model=TestResponse)
async def get_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get test by ID with all questions"""
    
    result = await db.execute(
        select(Test)
        .options(
            selectinload(Test.questions).selectinload(Question.options)
        )
        .where(Test.id == test_id)
    )
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )
    
    # Check permissions
    if current_user.role == UserRole.TEACHER:
        if test.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this test"
            )
    elif current_user.role == UserRole.STUDENT:
        if test.status != TestStatus.PUBLISHED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Test is not published"
            )
        assignment_result = await db.execute(
            select(TestAssignment).where(
                TestAssignment.test_id == test_id,
                TestAssignment.student_id == current_user.id
            )
        )
        if not assignment_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Test not assigned to you"
            )
    
    # Hide correct answers for students
    if current_user.role == UserRole.STUDENT:
        # Build sanitized response dict without revealing correct answers
        sanitized_questions = []
        for q in test.questions:
            sanitized_options = [
                {
                    "id": o.id,
                    "question_id": o.question_id,
                    "option_text": o.option_text,
                    "is_correct": False,  # never reveal
                    "order": o.order,
                    "matching_pair": o.matching_pair,
                    "created_at": o.created_at,
                }
                for o in q.options
            ]

            sanitized_questions.append(
                {
                    "id": q.id,
                    "test_id": q.test_id,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "points": q.points,
                    "order": q.order,
                    "correct_answer_text": None,  # never reveal
                    "explanation": q.explanation,
                    "created_at": q.created_at,
                    "options": sanitized_options,
                }
            )

        return {
            "id": test.id,
            "title": test.title,
            "description": test.description,
            "duration_minutes": test.duration_minutes,
            "passing_score": test.passing_score,
            "max_attempts": test.max_attempts,
            "show_results": test.show_results,
            "shuffle_questions": test.shuffle_questions,
            "shuffle_options": test.shuffle_options,
            "status": test.status,
            "creator_id": test.creator_id,
            "created_at": test.created_at,
            "updated_at": test.updated_at,
            "questions": sanitized_questions,
        }

    return test


@router.post("/", response_model=TestResponse, status_code=status.HTTP_201_CREATED)
async def create_test(
    test_data: TestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Create a new test (teacher/admin only)"""
    
    # Create test
    new_test = Test(
        title=test_data.title,
        description=test_data.description,
        duration_minutes=test_data.duration_minutes,
        passing_score=test_data.passing_score,
        max_attempts=test_data.max_attempts,
        show_results=test_data.show_results,
        shuffle_questions=test_data.shuffle_questions,
        shuffle_options=test_data.shuffle_options,
        status=test_data.status,
        creator_id=current_user.id
    )
    
    db.add(new_test)
    await db.flush()  # Get test ID
    
    # Create questions
    for idx, question_data in enumerate(test_data.questions):
        # Relaxed validation: normalize instead of rejecting
        qtype = question_data.question_type
        options = list(question_data.options or [])

        normalized_options = normalize_question_options(qtype, options)

        # Sanitize/compute order
        safe_order = question_data.order if isinstance(question_data.order, int) and question_data.order >= 0 else idx

        new_question = Question(
            test_id=new_test.id,
            question_text=question_data.question_text,
            question_type=question_data.question_type,
            points=question_data.points,
            order=safe_order,
            correct_answer_text=question_data.correct_answer_text,
            explanation=question_data.explanation
        )
        
        db.add(new_question)
        await db.flush()  # Get question ID
        
        # Create question options
        for option_data in normalized_options:
            new_option = QuestionOption(
                question_id=new_question.id,
                option_text=option_data.option_text,
                is_correct=option_data.is_correct,
                order=option_data.order,
                matching_pair=option_data.matching_pair
            )
            db.add(new_option)
    
    await db.commit()
    
    # Reload with relationships
    result = await db.execute(
        select(Test)
        .options(
            selectinload(Test.questions).selectinload(Question.options)
        )
        .where(Test.id == new_test.id)
    )
    created_test = result.scalar_one()
    
    return created_test


@router.patch("/{test_id}", response_model=TestResponse)
async def update_test(
    test_id: int,
    test_data: TestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Update test (teacher/admin only)"""
    
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )
    
    # Check ownership (admins can edit any test)
    if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this test"
        )
    
    # Update fields with safe coercion (handle enums/nullable ints)
    update_data = test_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and isinstance(value, str):
            try:
                value = TestStatus(value)
            except Exception:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status value")
        if field in ("duration_minutes", "max_attempts") and value is None:
            setattr(test, field, None)
            continue
        setattr(test, field, value)
    
    await db.commit()
    # Reload with relationships to avoid async lazy-load during response serialization
    refreshed = await db.execute(
        select(Test)
        .options(
            selectinload(Test.questions).selectinload(Question.options)
        )
        .where(Test.id == test_id)
    )
    test_obj = refreshed.scalar_one()
    # Explicitly coerce to response schema to surface validation issues early
    return TestResponse.model_validate(test_obj, from_attributes=True)


@router.delete("/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Delete test (teacher/admin only)"""
    
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )
    
    # Check ownership (admins can delete any test)
    if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this test"
        )
    
    await db.delete(test)
    await db.commit()


# Test Assignments
@router.post("/{test_id}/assign", response_model=TestAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_test(
    test_id: int,
    assignment_data: TestAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Assign test to student (teacher/admin only)"""
    
    # Verify test exists
    test_result = await db.execute(select(Test).where(Test.id == test_id))
    test = test_result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )
    
    # Check ownership (admins can assign any test)
    if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to assign this test"
        )
    
    # Verify student exists
    student_result = await db.execute(
        select(User).where(
            User.id == assignment_data.student_id,
            User.role == UserRole.STUDENT
        )
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Check if already assigned
    existing_result = await db.execute(
        select(TestAssignment).where(
            TestAssignment.test_id == test_id,
            TestAssignment.student_id == assignment_data.student_id
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test already assigned to this student"
        )
    
    # Create assignment
    assignment = TestAssignment(
        test_id=test_id,
        student_id=assignment_data.student_id,
        assigned_by_id=current_user.id,
        due_date=assignment_data.due_date
    )
    
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    
    return assignment


@router.get("/{test_id}/assignments", response_model=List[TestAssignmentResponse])
async def get_test_assignments(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Get all assignments for a test (teacher/admin only)"""
    
    test_result = await db.execute(select(Test).where(Test.id == test_id))
    test = test_result.scalar_one_or_none()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )

    _ensure_can_manage_test(test, current_user, detail="Not authorized to view assignments for this test")

    result = await db.execute(
        select(TestAssignment)
        .where(TestAssignment.test_id == test_id)
    )
    assignments = result.scalars().all()
    
    return assignments


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Delete test assignment (teacher/admin only)"""
    
    result = await db.execute(
        select(TestAssignment, Test)
        .join(Test, Test.id == TestAssignment.test_id)
        .where(TestAssignment.id == assignment_id)
    )
    row = result.one_or_none()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    assignment, test = row
    _ensure_can_manage_test(test, current_user, detail="Not authorized to delete this assignment")
    
    await db.delete(assignment)
    await db.commit()


# Question management
@router.post("/{test_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    test_id: int,
    question_data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Create a question for a test (teacher/admin only)"""

    # Verify test and ownership
    test_result = await db.execute(select(Test).where(Test.id == test_id))
    test = test_result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found")
    if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this test")

    # Relaxed normalization instead of strict validation
    qtype = question_data.question_type
    options = list(question_data.options or [])
    normalized_options = normalize_question_options(qtype, options)

    # Determine next order if provided value is invalid
    default_order_result = await db.execute(
        select(func.max(Question.order)).where(Question.test_id == test_id)
    )
    current_max_order = default_order_result.scalar() or -1
    next_order = current_max_order + 1
    safe_order = question_data.order if isinstance(question_data.order, int) and question_data.order >= 0 else next_order

    # Create question
    new_question = Question(
        test_id=test_id,
        question_text=question_data.question_text,
        question_type=question_data.question_type,
        points=question_data.points,
        order=safe_order,
        correct_answer_text=question_data.correct_answer_text,
        explanation=question_data.explanation
    )
    db.add(new_question)
    await db.flush()

    for option_data in normalized_options:
        db.add(QuestionOption(
            question_id=new_question.id,
            option_text=option_data.option_text,
            is_correct=option_data.is_correct,
            order=option_data.order,
            matching_pair=option_data.matching_pair
        ))

    await db.commit()

    # Reload with options
    q = await db.execute(
        select(Question).options(selectinload(Question.options)).where(Question.id == new_question.id)
    )
    return q.scalar_one()


# Assign test to group
@router.post("/{test_id}/assign-group", response_model=List[TestAssignmentResponse], status_code=status.HTTP_201_CREATED)
async def assign_test_to_group(
    test_id: int,
    group_id: int,
    due_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    # Verify test
    tres = await db.execute(select(Test).where(Test.id == test_id))
    test = tres.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found")
    if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to assign this test")

    # Verify group and ownership
    gres = await db.execute(select(Group).where(Group.id == group_id))
    group = gres.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if current_user.role == UserRole.TEACHER and group.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to assign to this group")

    # Fetch members
    mres = await db.execute(select(GroupMembership).where(GroupMembership.group_id == group_id))
    members = mres.scalars().all()
    if not members:
        return []

    created: list[TestAssignment] = []
    for m in members:
        existing = await db.execute(select(TestAssignment).where(TestAssignment.test_id == test_id, TestAssignment.student_id == m.student_id))
        if existing.scalar_one_or_none():
            continue
        a = TestAssignment(test_id=test_id, student_id=m.student_id, assigned_by_id=current_user.id, due_date=due_date)
        db.add(a)
        created.append(a)

    await db.commit()
    # refresh assignments
    for a in created:
        await db.refresh(a)
    return created


@router.post("/{test_id}/assign-bulk", response_model=List[TestAssignmentResponse], status_code=status.HTTP_201_CREATED)
async def assign_test_bulk(
    test_id: int,
    payload: TestAssignmentBulkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    tres = await db.execute(select(Test).where(Test.id == test_id))
    test = tres.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found")
    if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to assign this test")

    student_ids: set[int] = set()

    if payload.student_ids:
        result = await db.execute(
            select(User.id).where(
                User.id.in_(payload.student_ids),
                User.role == UserRole.STUDENT,
            )
        )
        fetched_ids = set(result.scalars().all())
        if len(fetched_ids) != len(set(payload.student_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more students not found")
        student_ids.update(fetched_ids)

    if payload.group_ids:
        group_ids_set = set(payload.group_ids)
        gres = await db.execute(select(Group).where(Group.id.in_(group_ids_set)))
        groups = gres.scalars().all()
        if len(groups) != len(group_ids_set):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more groups not found")
        for group in groups:
            if current_user.role == UserRole.TEACHER and group.creator_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Not authorized to assign group {group.id}")
        mres = await db.execute(
            select(GroupMembership.student_id).where(GroupMembership.group_id.in_(group_ids_set))
        )
        student_ids.update(mres.scalars().all())

    if payload.assign_all_students:
        all_students_res = await db.execute(
            select(User.id).where(
                User.role == UserRole.STUDENT,
                User.is_active.is_(True),
                User.is_verified.is_(True),
            )
        )
        student_ids.update(all_students_res.scalars().all())

    if not student_ids:
        return []

    created: list[TestAssignment] = []
    for sid in student_ids:
        existing = await db.execute(
            select(TestAssignment).where(
                TestAssignment.test_id == test_id,
                TestAssignment.student_id == sid,
            )
        )
        if existing.scalar_one_or_none():
            continue
        assignment = TestAssignment(
            test_id=test_id,
            student_id=sid,
            assigned_by_id=current_user.id,
            due_date=payload.due_date,
        )
        db.add(assignment)
        created.append(assignment)

    if not created:
        return []

    await db.commit()
    for assignment in created:
        await db.refresh(assignment)

    return created


@router.post("/auto-with-question", response_model=TestResponse, status_code=status.HTTP_201_CREATED)
async def create_or_append_with_question(
    payload: TestAutoWithQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Create a new test (if test_id not supplied) and add a question, or
    append a question to an existing test. Returns the full test with questions.
    """

    # Resolve or create test
    test: Optional[Test] = None
    if payload.test_id:
        result = await db.execute(select(Test).where(Test.id == payload.test_id))
        test = result.scalar_one_or_none()
        if not test:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found")
        if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this test")
    else:
        # Create new test with sensible defaults
        new_test = Test(
            title=(payload.title or "Новый тест").strip(),
            description=(payload.description or None),
            duration_minutes=payload.duration_minutes,
            passing_score=payload.passing_score if payload.passing_score is not None else 60.0,
            max_attempts=payload.max_attempts,
            show_results=True if payload.show_results is None else bool(payload.show_results),
            shuffle_questions=False if payload.shuffle_questions is None else bool(payload.shuffle_questions),
            shuffle_options=False if payload.shuffle_options is None else bool(payload.shuffle_options),
            status=payload.status or TestStatus.DRAFT,
            creator_id=current_user.id,
        )
        db.add(new_test)
        await db.flush()
        test = new_test

    # Normalize options for the provided question
    qdata = payload.question
    qtype = qdata.question_type
    options = list(qdata.options or [])
    normalized_options = normalize_question_options(qtype, options)

    # Compute safe order
    default_order_result = await db.execute(
        select(func.max(Question.order)).where(Question.test_id == test.id)
    )
    current_max_order = default_order_result.scalar() or -1
    next_order = current_max_order + 1
    safe_order = qdata.order if isinstance(qdata.order, int) and qdata.order >= 0 else next_order

    # Create question
    new_question = Question(
        test_id=test.id,
        question_text=qdata.question_text,
        question_type=qdata.question_type,
        points=qdata.points,
        order=safe_order,
        correct_answer_text=qdata.correct_answer_text,
        explanation=qdata.explanation,
    )
    db.add(new_question)
    await db.flush()

    for option_data in normalized_options:
        db.add(QuestionOption(
            question_id=new_question.id,
            option_text=option_data.option_text,
            is_correct=option_data.is_correct,
            order=option_data.order,
            matching_pair=option_data.matching_pair,
        ))

    await db.commit()

    # Return full test with questions
    result = await db.execute(
        select(Test)
        .options(
            selectinload(Test.questions).selectinload(Question.options)
        )
        .where(Test.id == test.id)
    )
    return result.scalar_one()


@router.patch("/{test_id}/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    test_id: int,
    question_id: int,
    question_data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Update a question and optionally replace options (teacher/admin only)."""

    qres = await db.execute(select(Question).where(Question.id == question_id))
    question = qres.scalar_one_or_none()
    if not question or question.test_id != test_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    tres = await db.execute(select(Test).where(Test.id == test_id))
    test = tres.scalar_one()
    if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this test")

    update_data = question_data.model_dump(exclude_unset=True)
    options_payload = update_data.pop("options", None)
    for field, value in update_data.items():
        setattr(question, field, value)

    if options_payload is not None:
        normalized_options = normalize_question_options(question.question_type, list(options_payload))
        existing = await db.execute(select(QuestionOption).where(QuestionOption.question_id == question.id))
        for opt in existing.scalars().all():
            await db.delete(opt)
        for option_data in normalized_options:
            db.add(QuestionOption(
                question_id=question.id,
                option_text=option_data.option_text,
                is_correct=option_data.is_correct,
                order=option_data.order,
                matching_pair=option_data.matching_pair
            ))

    await db.commit()

    q = await db.execute(select(Question).options(selectinload(Question.options)).where(Question.id == question.id))
    return q.scalar_one()


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Delete a question (teacher/admin only)."""

    qres = await db.execute(select(Question).where(Question.id == question_id))
    question = qres.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    tres = await db.execute(select(Test).where(Test.id == question.test_id))
    test = tres.scalar_one()
    if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this test")

    await db.delete(question)
    await db.commit()