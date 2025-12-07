from pydantic import BaseModel, Field, model_validator


class GradeSettingsResponse(BaseModel):
    grade3_min: float = Field(..., description="Минимальный % для оценки 3")
    grade4_min: float = Field(..., description="Минимальный % для оценки 4")
    grade5_min: float = Field(..., description="Минимальный % для оценки 5")


class GradeSettingsUpdate(BaseModel):
    grade3_min: float = Field(..., description="Минимальный % для оценки 3")
    grade4_min: float = Field(..., description="Минимальный % для оценки 4")
    grade5_min: float = Field(..., description="Минимальный % для оценки 5")

    @model_validator(mode="after")
    def validate_thresholds(self):
        if not (0 <= self.grade3_min <= 100 and 0 <= self.grade4_min <= 100 and 0 <= self.grade5_min <= 100):
            raise ValueError("Пороговые значения должны быть в диапазоне 0-100")
        if not (self.grade3_min <= self.grade4_min <= self.grade5_min):
            raise ValueError("Пороги должны возрастать: 3 <= 4 <= 5")
        return self


