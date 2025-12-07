from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.dependencies import require_admin, get_current_user
from app.api.dependencies import get_db
from app.models.grade_settings import GradeSettings
from app.schemas.settings import GradeSettingsResponse, GradeSettingsUpdate

router = APIRouter()


async def _get_or_create_settings(db: AsyncSession) -> GradeSettings:
    result = await db.execute(select(GradeSettings))
    settings = result.scalar_one_or_none()
    if settings:
        return settings
    settings = GradeSettings()
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


@router.get("/grades", response_model=GradeSettingsResponse)
async def get_grade_settings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    settings = await _get_or_create_settings(db)
    return GradeSettingsResponse(
        grade3_min=settings.grade3_min,
        grade4_min=settings.grade4_min,
        grade5_min=settings.grade5_min,
    )


@router.put("/grades", response_model=GradeSettingsResponse)
async def update_grade_settings(
    payload: GradeSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    settings = await _get_or_create_settings(db)

    # Validate monotonicity already handled by schema validator, but enforce logical ordering vs current
    if payload.grade3_min > payload.grade4_min or payload.grade4_min > payload.grade5_min:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пороги должны возрастать: 3 <= 4 <= 5"
        )

    settings.grade3_min = payload.grade3_min
    settings.grade4_min = payload.grade4_min
    settings.grade5_min = payload.grade5_min

    await db.commit()
    await db.refresh(settings)

    return GradeSettingsResponse(
        grade3_min=settings.grade3_min,
        grade4_min=settings.grade4_min,
        grade5_min=settings.grade5_min,
    )


