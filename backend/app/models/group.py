from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    creator = relationship("User", foreign_keys=[creator_id])
    members = relationship("GroupMembership", back_populates="group", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Group(id={self.id}, name={self.name})>"


class GroupMembership(Base):
    __tablename__ = "group_memberships"
    __table_args__ = (
        UniqueConstraint("group_id", "student_id", name="uix_group_student"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    added_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    group = relationship("Group", back_populates="members")
    student = relationship("User", foreign_keys=[student_id])

    def __repr__(self) -> str:
        return f"<GroupMembership(group_id={self.group_id}, student_id={self.student_id})>"


