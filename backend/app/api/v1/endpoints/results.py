from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Any
from datetime import datetime, timezone
import re
import string

from app.core.database import get_db
from app.core.config import settings
import redis.asyncio as redis
from app.models.user import User, UserRole
from app.models.test import Test, Question, QuestionOption, TestAssignment, QuestionType, TestStatus
from app.models.result import TestResult, Answer
from app.schemas.result import (
    TestResultResponse, TestResultListResponse,
    TestAttemptStart, TestAttemptSubmit, GradeAnswerRequest,
    AnswerResponse
)
from app.api.dependencies import get_current_user, require_teacher

router = APIRouter()
async def _get_redis():
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


_SHORT_ANSWER_SPLIT_PATTERN = re.compile(r"[|;\n,]+")
_MANUAL_GRADING_TYPES = {
    QuestionType.ESSAY,
    QuestionType.FILE_UPLOAD,
    QuestionType.CODE,
}


def _parse_float_value(value: Optional[Any]) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip().replace(",", ".")
        if not normalized:
            return None
        value = normalized
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_short_answer(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    normalized = normalized.replace("ё", "е")
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = normalized.strip(string.punctuation + " ")
    return normalized or None


def _get_short_answer_variants(answer_text: Optional[str]) -> List[str]:
    if not answer_text:
        return []
    raw_variants = _SHORT_ANSWER_SPLIT_PATTERN.split(answer_text)
    normalized_variants = []
    for variant in raw_variants:
        normalized = _normalize_short_answer(variant)
        if normalized:
            normalized_variants.append(normalized)
    # fallback: if splitting removed everything, try whole text
    if not normalized_variants:
        normalized = _normalize_short_answer(answer_text)
        if normalized:
            normalized_variants.append(normalized)
    return normalized_variants



@router.post("/start", response_model=dict)
async def start_test_attempt(
    data: TestAttemptStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start a test attempt (student only)"""
    
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can take tests"
        )
    
    # Verify test exists and is assigned
    test_result = await db.execute(
        select(Test).where(Test.id == data.test_id)
    )
    test = test_result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )
    
    assignment_result = await db.execute(
        select(TestAssignment).where(
            TestAssignment.test_id == data.test_id,
            TestAssignment.student_id == current_user.id
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test not assigned to you"
        )
    
    # Ensure test is published for students
    if test.status != TestStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test is not published"
        )

    # Check max attempts
    if test.max_attempts:
        attempts_result = await db.execute(
            select(func.count()).select_from(TestResult).where(
                TestResult.test_id == data.test_id,
                TestResult.student_id == current_user.id
            )
        )
        attempts_count = attempts_result.scalar()
        
        if attempts_count >= test.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum attempts ({test.max_attempts}) reached"
            )
    
    # Record attempt start on server (Redis)
    started_at = datetime.now(timezone.utc)
    try:
        r = await _get_redis()
        key = f"attempt:{test.id}:{current_user.id}"
        await r.set(key, started_at.isoformat())
        # TTL: test duration * 2 or 24h fallback
        ttl_seconds = (test.duration_minutes or 60) * 120
        await r.expire(key, ttl_seconds)
    except Exception:
        # Non-fatal: continue without blocking if Redis unavailable
        pass

    return {
        "message": "Test attempt started",
        "test_id": test.id,
        "started_at": started_at.isoformat()
    }


@router.post("/submit", response_model=TestResultResponse)
async def submit_test_attempt(
    data: TestAttemptSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit test answers and get result (student only)"""
    
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can submit tests"
        )
    
    # Get test with questions
    test_result = await db.execute(
        select(Test)
        .options(
            selectinload(Test.questions).selectinload(Question.options)
        )
        .where(Test.id == data.test_id)
    )
    test = test_result.scalar_one_or_none()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )

    # Ensure test is published
    if test.status != TestStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test is not published"
        )

    assignment_result = await db.execute(
        select(TestAssignment).where(
            TestAssignment.test_id == data.test_id,
            TestAssignment.student_id == current_user.id
        )
    )
    if not assignment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test not assigned to you"
        )

    # Re-check max attempts to prevent bypassing start
    if test.max_attempts:
        attempts_result = await db.execute(
            select(func.count()).select_from(TestResult).where(
                TestResult.test_id == data.test_id,
                TestResult.student_id == current_user.id
            )
        )
        attempts_count = attempts_result.scalar()
        if attempts_count >= test.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum attempts ({test.max_attempts}) reached"
            )
    
    # Calculate attempt number
    attempts_result = await db.execute(
        select(func.count()).select_from(TestResult).where(
            TestResult.test_id == data.test_id,
            TestResult.student_id == current_user.id
        )
    )
    attempt_number = attempts_result.scalar() + 1
    
    # Calculate time spent using server-tracked start if available
    completed_at = datetime.now(timezone.utc)
    server_started_at = data.started_at
    try:
        r = await _get_redis()
        key = f"attempt:{test.id}:{current_user.id}"
        stored = await r.get(key)
        if stored:
            server_started_at = datetime.fromisoformat(stored)
    except Exception:
        pass
    # Normalize timezone-aware
    if server_started_at.tzinfo is None:
        server_started_at = server_started_at.replace(tzinfo=timezone.utc)
    time_spent = int((completed_at - server_started_at).total_seconds() / 60)
    
    # Total points is the sum of all questions in the test (answered or not)
    points_total = sum(q.points for q in test.questions)
    points_earned = 0.0
    
    # Create answer records
    answer_records = []
    pending_answers_count = 0
    
    # Index answers by question_id for quick lookup
    answers_by_qid = {a.question_id: a for a in data.answers}

    for question in test.questions:
        answer_data = answers_by_qid.get(question.id)
        if not answer_data:
            # No answer provided: count as incorrect / zero points
            answer_payload = {}
        else:
            # Ensure dict-like payload
            answer_payload = answer_data.answer_data if isinstance(answer_data.answer_data, dict) else {}

        # Grade based on question type
        is_correct: Optional[bool] = False
        points = 0.0

        if question.question_type == QuestionType.SINGLE_CHOICE:
            selected_option_id = answer_payload.get("selected_option_id")
            try:
                selected_option_id = int(selected_option_id)
            except (TypeError, ValueError):
                selected_option_id = None

            if selected_option_id is not None:
                correct_option = next(
                    (o for o in question.options if o.id == selected_option_id and o.is_correct),
                    None,
                )
                if correct_option:
                    is_correct = True
                    points = question.points

        elif question.question_type == QuestionType.MULTIPLE_CHOICE:
            raw_selected = answer_payload.get("selected_option_ids", [])
            if not isinstance(raw_selected, (list, tuple, set)):
                raw_selected = []

            selected_option_ids = {
                int(option_id)
                for option_id in raw_selected
                if isinstance(option_id, (int, str)) and str(option_id).strip() != ""
            }
            correct_option_ids = {o.id for o in question.options if o.is_correct}

            if selected_option_ids == correct_option_ids and correct_option_ids:
                is_correct = True
                points = question.points

        elif question.question_type == QuestionType.TRUE_FALSE:
            selected_value = answer_payload.get("value")

            def _normalize_tf(value: Optional[str]) -> Optional[bool]:
                if value is None:
                    return None
                value_str = str(value).strip().lower()
                if value_str in {"true", "истина", "правда", "yes", "1"}:
                    return True
                if value_str in {"false", "ложь", "no", "0"}:
                    return False
                return None

            student_bool = _normalize_tf(selected_value)
            correct_bool = _normalize_tf(question.correct_answer_text)

            if student_bool is not None and correct_bool is not None and student_bool == correct_bool:
                is_correct = True
                points = question.points

        elif question.question_type == QuestionType.FILL_IN_BLANK:
            correct_text = question.correct_answer_text or ""
            correct_answers = [part.strip().lower() for part in correct_text.split(",") if part.strip()]

            blanks = answer_payload.get("blanks", [])
            if isinstance(blanks, dict):
                blanks = [blanks[key] for key in sorted(blanks, key=lambda x: int(x))]
            if not isinstance(blanks, list):
                blanks = []

            student_answers = [str(value).strip().lower() for value in blanks if str(value).strip()]

            if correct_answers and len(correct_answers) == len(student_answers):
                if all(student_answers[idx] == correct_answers[idx] for idx in range(len(correct_answers))):
                    is_correct = True
                    points = question.points

        elif question.question_type == QuestionType.NUMERIC:
            correct_value = _parse_float_value(question.correct_answer_text)

            student_value = answer_payload.get("number_value")
            if student_value is None:
                student_value = answer_payload.get("value")
            student_value = _parse_float_value(student_value)

            if correct_value is not None and student_value is not None:
                if abs(student_value - correct_value) <= 1e-4:
                    is_correct = True
                    points = question.points

        elif question.question_type == QuestionType.MATCHING:
            matches = answer_payload.get("matches", {})
            if not isinstance(matches, dict):
                matches = {}

            prepared_matches = {}
            for key, value in matches.items():
                try:
                    prepared_matches[int(key)] = int(value)
                except (TypeError, ValueError):
                    continue

            expected_matches = {option.id: option.id for option in question.options}

            if expected_matches:
                is_correct_flag = True
                for option_id, expected_id in expected_matches.items():
                    if prepared_matches.get(option_id) != expected_id:
                        is_correct_flag = False
                        break
                if is_correct_flag and len(prepared_matches) == len(expected_matches):
                    is_correct = True
                    points = question.points

        elif question.question_type == QuestionType.ORDERING:
            order_map = answer_payload.get("order", {})
            if not isinstance(order_map, dict):
                order_map = {}

            prepared_order: dict[int, int] = {}
            for key, value in order_map.items():
                try:
                    option_id = int(key)
                    position = int(value)
                    prepared_order[option_id] = position
                except (TypeError, ValueError):
                    continue

            expected_sequence = [option.id for option in sorted(question.options, key=lambda o: o.order)]

            if expected_sequence and len(prepared_order) == len(expected_sequence):
                student_pairs = sorted(prepared_order.items(), key=lambda item: item[1])
                student_positions = [pair[1] for pair in student_pairs]

                if len(set(student_positions)) == len(student_positions) and set(prepared_order.keys()) == set(expected_sequence):
                    student_sequence = [pair[0] for pair in student_pairs]
                    if student_sequence == expected_sequence:
                        is_correct = True
                        points = question.points
        elif question.question_type == QuestionType.SHORT_ANSWER:
            expected_answers = _get_short_answer_variants(question.correct_answer_text)
            student_answer = _normalize_short_answer(
                answer_payload.get("text") or answer_payload.get("value")
            )

            if expected_answers:
                if student_answer and student_answer in expected_answers:
                    is_correct = True
                    points = question.points
                else:
                    is_correct = False
            else:
                # No configured correct answers -> requires manual grading
                is_correct = None
                pending_answers_count += 1
        elif question.question_type in _MANUAL_GRADING_TYPES:
            is_correct = None  # Will require manual grading
            points = 0.0
            pending_answers_count += 1

        points_earned += points

        answer_record = Answer(
            question_id=question.id,
            answer_data=answer_payload,
            is_correct=is_correct,
            points_earned=points
        )
        answer_records.append(answer_record)
    
    # Calculate score and status
    score = (points_earned / points_total * 100) if points_total > 0 else 0
    status_value = "pending_manual" if pending_answers_count > 0 else "auto_completed"
    is_passed = score >= test.passing_score if status_value != "pending_manual" else False
    
    # Create test result
    result = TestResult(
        test_id=test.id,
        student_id=current_user.id,
        score=score,
        points_earned=points_earned,
        points_total=points_total,
        is_passed=is_passed,
        status=status_value,
        pending_answers_count=pending_answers_count,
        started_at=server_started_at,
        completed_at=completed_at,
        time_spent_minutes=time_spent,
        attempt_number=attempt_number
    )
    
    db.add(result)
    await db.flush()
    
    # Add answers
    for answer_record in answer_records:
        answer_record.test_result_id = result.id
        db.add(answer_record)
    
    await db.commit()
    
    # Reload with relationships
    final_result = await db.execute(
        select(TestResult)
        .options(selectinload(TestResult.answers))
        .where(TestResult.id == result.id)
    )
    
    return final_result.scalar_one()


@router.get("/", response_model=List[TestResultListResponse])
async def get_results(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    test_id: int = None,
    student_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get test results"""
    
    user_alias = User
    test_alias = Test
    query = (
        select(
            TestResult,
            user_alias.full_name.label("student_full_name"),
            user_alias.username.label("student_username"),
            test_alias.title.label("test_title"),
        )
        .join(user_alias, TestResult.student_id == user_alias.id)
        .join(test_alias, TestResult.test_id == test_alias.id)
    )
    
    # Filter by role
    if current_user.role == UserRole.STUDENT:
        # Students see only their own results
        query = query.where(TestResult.student_id == current_user.id)
    elif current_user.role == UserRole.TEACHER:
        # Teachers see results for their tests
        query = query.where(test_alias.creator_id == current_user.id)
    elif current_user.role == UserRole.PARENT:
        # Parents see their children's results
        from app.models.user import ParentChild
        query = query.join(ParentChild, TestResult.student_id == ParentChild.child_id).where(
            ParentChild.parent_id == current_user.id
        )
    
    # Additional filters
    if test_id:
        query = query.where(TestResult.test_id == test_id)
    
    if student_id:
        # Only teachers and admins can filter by student
        if current_user.role in [UserRole.TEACHER, UserRole.ADMIN]:
            query = query.where(TestResult.student_id == student_id)
    
    query = query.order_by(TestResult.completed_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()
    
    responses: List[TestResultListResponse] = []
    for test_result, full_name, username, test_title in rows:
        responses.append(
            TestResultListResponse(
                id=test_result.id,
                test_id=test_result.test_id,
                test_title=test_title,
                student_id=test_result.student_id,
                student_full_name=full_name,
                student_username=username,
                score=test_result.score,
                is_passed=test_result.is_passed,
                status=test_result.status,
                completed_at=test_result.completed_at,
                attempt_number=test_result.attempt_number,
                pending_answers_count=test_result.pending_answers_count,
            )
        )
    
    return responses


@router.get("/{result_id}", response_model=TestResultResponse)
async def get_result(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed test result"""
    
    result = await db.execute(
        select(TestResult)
        .options(
            selectinload(TestResult.answers),
            selectinload(TestResult.student),
        )
        .where(TestResult.id == result_id)
    )
    test_result = result.scalar_one_or_none()
    
    if not test_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )
    
    # Check permissions
    if current_user.role == UserRole.STUDENT:
        if test_result.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this result"
            )
    elif current_user.role == UserRole.TEACHER:
        # Teachers can view results for their tests
        test_check = await db.execute(
            select(Test).where(
                Test.id == test_result.test_id,
                Test.creator_id == current_user.id
            )
        )
        if not test_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this result"
            )
    elif current_user.role == UserRole.PARENT:
        # Parents can view their children's results
        from app.models.user import ParentChild
        child_check = await db.execute(
            select(ParentChild).where(
                ParentChild.parent_id == current_user.id,
                ParentChild.child_id == test_result.student_id
            )
        )
        if not child_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this result"
            )
    student_full_name = getattr(test_result.student, "full_name", None)
    student_username = getattr(test_result.student, "username", None)

    response = TestResultResponse.model_validate(test_result, from_attributes=True)
    return response.model_copy(
        update={
            "student_full_name": student_full_name,
            "student_username": student_username,
        }
    )


@router.post("/grade-answer", response_model=AnswerResponse)
async def grade_answer(
    data: GradeAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """Manually grade an answer (teacher/admin only)"""
    
    result = await db.execute(select(Answer).where(Answer.id == data.answer_id))
    answer = result.scalar_one_or_none()
    
    if not answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer not found"
        )

    test_result_query = await db.execute(
        select(TestResult)
        .options(selectinload(TestResult.answers))
        .where(TestResult.id == answer.test_result_id)
    )
    test_result = test_result_query.scalar_one_or_none()
    if not test_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test result not found"
        )

    test_query = await db.execute(select(Test).where(Test.id == test_result.test_id))
    test = test_query.scalar_one_or_none()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )

    if current_user.role == UserRole.TEACHER and test.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to grade answers for this test"
        )
    
    # Update answer
    answer.is_correct = data.is_correct
    answer.points_earned = data.points_earned
    answer.teacher_comment = data.teacher_comment
    
    # Recalculate score and status
    points_earned = sum(a.points_earned for a in test_result.answers)
    test_result.points_earned = points_earned
    test_result.score = (points_earned / test_result.points_total * 100) if test_result.points_total > 0 else 0

    pending_answers = sum(1 for a in test_result.answers if a.is_correct is None)
    test_result.pending_answers_count = pending_answers

    if pending_answers == 0:
        if test_result.status == "pending_manual":
            test_result.status = "completed"
        test_result.is_passed = test_result.score >= test.passing_score
    else:
        test_result.status = "pending_manual"
        test_result.is_passed = False
    
    await db.commit()
    await db.refresh(answer)
    
    return answer

