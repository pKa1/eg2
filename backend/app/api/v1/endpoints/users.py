from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole, ParentChild
from app.schemas.user import UserResponse, UserCreate, UserUpdate, ParentChildCreate, ParentChildResponse
from app.api.dependencies import get_current_user, require_admin, require_teacher

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    role: Optional[UserRole] = None,
    is_verified: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all users (admin only)"""
    
    query = select(User)
    
    if role:
        query = query.where(User.role == role)
    if is_verified is not None:
        query = query.where(User.is_verified == is_verified)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()
    
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user by ID"""
    
    # Users can only view themselves unless they're admin/teacher
    if current_user.id != user_id and current_user.role not in [UserRole.ADMIN, UserRole.TEACHER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new user (admin only)"""
    
    # Check if user already exists
    result = await db.execute(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists"
        )
    
    # Create new user
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        phone=user_data.phone,
        is_verified=True,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user"""
    
    # Users can only update themselves unless they're admin
    is_self = current_user.id == user_id
    if not is_self and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)
    # Only admin can change role or verification flag unless editing own record and not admin
    if current_user.role != UserRole.ADMIN:
        update_data.pop("role", None)
        update_data.pop("is_verified", None)
    
    # Hash password if provided
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete user (admin only)"""
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    await db.delete(user)
    await db.commit()


# Parent-Child relationships
@router.post("/parent-child", response_model=ParentChildResponse, status_code=status.HTTP_201_CREATED)
async def create_parent_child_relationship(
    data: ParentChildCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create parent-child relationship (admin only)"""
    
    # Verify both users exist
    parent_result = await db.execute(select(User).where(User.id == data.parent_id))
    parent = parent_result.scalar_one_or_none()
    
    child_result = await db.execute(select(User).where(User.id == data.child_id))
    child = child_result.scalar_one_or_none()
    
    if not parent or not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent or child user not found"
        )
    
    if parent.role != UserRole.PARENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent user must have parent role"
        )
    
    if child.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Child user must have student role"
        )
    
    # Create relationship
    relationship = ParentChild(
        parent_id=data.parent_id,
        child_id=data.child_id
    )
    
    db.add(relationship)
    await db.commit()
    await db.refresh(relationship)
    
    return relationship


@router.get("/parent/{parent_id}/children", response_model=List[UserResponse])
async def get_parent_children(
    parent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all children of a parent"""
    
    # Parents can only view their own children unless they're admin/teacher
    if current_user.id != parent_id and current_user.role not in [UserRole.ADMIN, UserRole.TEACHER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this parent's children"
        )
    
    result = await db.execute(
        select(User)
        .join(ParentChild, User.id == ParentChild.child_id)
        .where(ParentChild.parent_id == parent_id)
    )
    children = result.scalars().all()
    
    return children


@router.get("/students/verified", response_model=List[UserResponse])
async def get_verified_students(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """List verified students (teacher/admin)."""

    result = await db.execute(
        select(User)
        .where(User.role == UserRole.STUDENT, User.is_verified.is_(True))
        .order_by(User.full_name.asc())
    )
    return result.scalars().all()


@router.get("/students/all", response_model=List[UserResponse])
async def list_students(
    is_verified: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """List students (teacher/admin) with optional verification filter."""

    query = select(User).where(User.role == UserRole.STUDENT)
    if is_verified is not None:
        query = query.where(User.is_verified == is_verified)

    result = await db.execute(query.order_by(User.full_name.asc()))
    return result.scalars().all()

