from sqlalchemy import Column, Integer, Float, DateTime, func
from app.core.database import Base


class GradeSettings(Base):
    """Stores percentage thresholds for displaying numeric grades."""

    __tablename__ = "grade_settings"

    id = Column(Integer, primary_key=True, index=True)
    grade3_min = Column(Float, nullable=False, default=33.0)
    grade4_min = Column(Float, nullable=False, default=66.0)
    grade5_min = Column(Float, nullable=False, default=85.0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


