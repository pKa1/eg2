from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, date
from app.models.user import UserRole, StudentGender


# Token schemas
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# User base schema
class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole
    phone: Optional[str] = None
    gender: Optional[StudentGender] = None
    date_of_birth: Optional[date] = None
    school_name: Optional[str] = Field(None, max_length=255)
    class_number: Optional[int] = Field(None, ge=1, le=11)
    class_letter: Optional[str] = Field(None, max_length=10)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    role: Optional[UserRole] = None
    phone: Optional[str] = None
    gender: Optional[StudentGender] = None
    date_of_birth: Optional[date] = None
    school_name: Optional[str] = Field(None, max_length=255)
    class_number: Optional[int] = Field(None, ge=1, le=11)
    class_letter: Optional[str] = Field(None, max_length=10)
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


# Parent-Child relationship
class ParentChildCreate(BaseModel):
    parent_id: int
    child_id: int


class ParentChildResponse(BaseModel):
    id: int
    parent_id: int
    child_id: int
    created_at: datetime

    class Config:
        from_attributes = True

