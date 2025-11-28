from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class GroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class GroupResponse(GroupBase):
    id: int
    creator_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class GroupMembershipBase(BaseModel):
    group_id: int
    student_id: int


class GroupMembershipCreate(GroupMembershipBase):
    pass


class GroupMembershipResponse(GroupMembershipBase):
    id: int
    added_by_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


