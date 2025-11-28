from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.group import Group, GroupMembership
from app.schemas.group import (
    GroupCreate, GroupUpdate, GroupResponse,
    GroupMembershipCreate, GroupMembershipResponse,
)
from app.api.dependencies import get_current_user, require_teacher, require_admin


router = APIRouter()


@router.get("/", response_model=List[GroupResponse])
async def list_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Group)
    if current_user.role == UserRole.TEACHER:
        query = query.where(Group.creator_id == current_user.id)
    result = await db.execute(query.offset(skip).limit(limit).order_by(Group.created_at.desc()))
    return result.scalars().all()


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gres = await db.execute(select(Group).where(Group.id == group_id))
    group = gres.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if current_user.role == UserRole.TEACHER and group.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this group")
    if current_user.role not in [UserRole.ADMIN, UserRole.TEACHER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view groups")
    return group


@router.post("/", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    group = Group(name=data.name.strip(), description=data.description, creator_id=current_user.id)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    data: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    res = await db.execute(select(Group).where(Group.id == group_id))
    group = res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if current_user.role == UserRole.TEACHER and group.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this group")
    upd = data.model_dump(exclude_unset=True)
    for k, v in upd.items():
        setattr(group, k, v)
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    res = await db.execute(select(Group).where(Group.id == group_id))
    group = res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if current_user.role == UserRole.TEACHER and group.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this group")
    await db.delete(group)
    await db.commit()


@router.get("/{group_id}/members", response_model=List[GroupMembershipResponse])
async def list_members(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    gres = await db.execute(select(Group).where(Group.id == group_id))
    group = gres.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if current_user.role == UserRole.TEACHER and group.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this group")
    res = await db.execute(select(GroupMembership).where(GroupMembership.group_id == group_id))
    return res.scalars().all()


@router.post("/{group_id}/members", response_model=GroupMembershipResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: int,
    data: GroupMembershipCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    gres = await db.execute(select(Group).where(Group.id == group_id))
    group = gres.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if current_user.role == UserRole.TEACHER and group.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this group")
    # Only students as members
    sres = await db.execute(select(User).where(User.id == data.student_id, User.role == UserRole.STUDENT))
    student = sres.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    # Check existing
    exist = await db.execute(select(GroupMembership).where(GroupMembership.group_id == group_id, GroupMembership.student_id == data.student_id))
    if exist.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student already in group")
    membership = GroupMembership(group_id=group_id, student_id=data.student_id, added_by_id=current_user.id)
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


@router.delete("/{group_id}/members/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    gres = await db.execute(select(Group).where(Group.id == group_id))
    group = gres.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if current_user.role == UserRole.TEACHER and group.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this group")
    res = await db.execute(select(GroupMembership).where(GroupMembership.group_id == group_id, GroupMembership.student_id == student_id))
    membership = res.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    await db.delete(membership)
    await db.commit()


