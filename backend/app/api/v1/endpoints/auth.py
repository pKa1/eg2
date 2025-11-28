from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, LoginRequest, RefreshTokenRequest
from app.api.dependencies import get_current_user
from app.core.config import settings
import redis.asyncio as redis

router = APIRouter()
async def _get_redis():
    return redis.from_url(settings.REDIS_URL, decode_responses=True)



@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    
    # Check if user already exists
    result = await db.execute(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        if existing_user.email == user_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email уже зарегистрирован"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Имя пользователя уже занято"
            )
    
    # Create new user
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        phone=user_data.phone,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Login and get access token - accepts username or email"""
    
    # Find user by username or email
    result = await db.execute(
        select(User).where(
            (User.username == form_data.username) | (User.email == form_data.username)
        )
    )
    user = result.scalar_one_or_none()
    
    # Verify credentials
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь неактивен"
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь не подтвержден администратором"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Store refresh token jti for rotation
    try:
        from app.core.security import decode_token
        payload = decode_token(refresh_token)
        jti = payload.get("jti")
        if jti:
            r = await _get_redis()
            await r.set(f"refresh_jti:{user.id}", jti, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)
    except Exception:
        # Non-fatal
        pass
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    return current_user


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token"""
    
    try:
        # Decode refresh token
        from app.core.security import decode_token
        payload = decode_token(token_data.refresh_token)

        # Check token type
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Невалидный тип токена. Ожидается refresh token",
            )

        user_id = int(payload.get("sub"))
        jti = payload.get("jti")

        # Verify refresh token jti matches stored one
        try:
            r = await _get_redis()
            stored_jti = await r.get(f"refresh_jti:{user_id}")
            if not stored_jti or stored_jti != jti:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")
        except HTTPException:
            raise
        except Exception:
            # If Redis unavailable, proceed without jti check
            pass

        # Get user from database
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден или неактивен",
            )

        # Create new tokens and rotate refresh jti
        access_token = create_access_token(data={"sub": str(user.id)})
        new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
        try:
            new_payload = decode_token(new_refresh_token)
            new_jti = new_payload.get("jti")
            if new_jti:
                r = await _get_redis()
                await r.set(f"refresh_jti:{user.id}", new_jti, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)
        except Exception:
            pass

        return Token(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный refresh token",
        )

