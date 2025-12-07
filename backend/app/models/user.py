from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    """User role enumeration"""
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"


class StudentGender(str, enum.Enum):
    """Student gender enumeration"""
    MALE = "male"
    FEMALE = "female"


class User(Base):
    """User model for all platform users"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    
    role = Column(SQLEnum(UserRole, values_callable=lambda x: [e.value for e in x]), nullable=False, default=UserRole.STUDENT)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Additional fields
    avatar_url = Column(String(500), nullable=True)
    phone = Column(String(20), nullable=True)
    gender = Column(SQLEnum(StudentGender, values_callable=lambda x: [e.value for e in x]), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    school_name = Column(String(255), nullable=True)
    class_number = Column(Integer, nullable=True)
    class_letter = Column(String(10), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    # For teachers - created tests
    created_tests = relationship("Test", back_populates="creator", foreign_keys="Test.creator_id")
    
    # For students - test assignments and results
    test_assignments = relationship("TestAssignment", back_populates="student", foreign_keys="TestAssignment.student_id")
    test_results = relationship("TestResult", back_populates="student", foreign_keys="TestResult.student_id")
    
    # For parents - children relationships
    children = relationship("ParentChild", back_populates="parent", foreign_keys="ParentChild.parent_id")
    parents = relationship("ParentChild", back_populates="child", foreign_keys="ParentChild.child_id")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, role={self.role})>"


class ParentChild(Base):
    """Many-to-many relationship between parents and children"""
    __tablename__ = "parent_child"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    child_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    parent = relationship("User", foreign_keys=[parent_id], back_populates="children")
    child = relationship("User", foreign_keys=[child_id], back_populates="parents")

    def __repr__(self):
        return f"<ParentChild(parent_id={self.parent_id}, child_id={self.child_id})>"

