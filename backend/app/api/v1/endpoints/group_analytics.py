from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_teacher
from app.core.database import get_db
from app.models.group import Group, GroupMembership
from app.models.result import TestResult
from app.models.test import Test
from app.models.user import User, UserRole

router = APIRouter()


@router.get("/groups/{group_id}/analytics")
async def group_analytics(
    group_id: int,
    test_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
) -> Dict[str, Any]:
    """Aggregate group performance optionally filtered by a specific test."""

    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    if current_user.role == UserRole.TEACHER and group.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view analytics for this group",
        )

    base_query = (
        select(TestResult)
        .join(GroupMembership, TestResult.student_id == GroupMembership.student_id)
        .where(GroupMembership.group_id == group_id)
        .where(TestResult.status != "pending_manual")
    )

    if test_id is not None:
        base_query = base_query.where(TestResult.test_id == test_id)

    result_rows = await db.execute(base_query)
    results = result_rows.scalars().all()

    if not results:
        return {"count": 0, "avg_score": 0.0, "pass_rate": 0.0, "test_title": None}

    count = len(results)
    avg_score = sum(r.score for r in results) / count
    pass_rate = sum(1 for r in results if r.is_passed) / count * 100

    test_title: Optional[str] = None
    if test_id is not None:
        test_name_result = await db.execute(select(Test.title).where(Test.id == test_id))
        test_title = test_name_result.scalar_one_or_none()

    return {
        "count": count,
        "avg_score": avg_score,
        "pass_rate": pass_rate,
        "test_title": test_title,
    }


