from typing import List

from app.models.test import QuestionType


def normalize_question_options(question_type: QuestionType, options: List) -> List:
    """Normalize options based on question type without strict rejection.

    - SINGLE_CHOICE: ensure exactly one option is marked correct (first if none).
    - MULTIPLE_CHOICE: keep as provided.
    - ORDERING, MATCHING: force is_correct to False for all options.
    - Others: return empty list.
    """
    opts = list(options or [])
    normalized = []
    if question_type in [QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE, QuestionType.ORDERING, QuestionType.MATCHING]:
        normalized = opts.copy()
        if question_type == QuestionType.SINGLE_CHOICE and normalized:
            first_correct_idx = next((i for i, o in enumerate(normalized) if getattr(o, "is_correct", False)), -1)
            if first_correct_idx == -1:
                first_correct_idx = 0
            for i, o in enumerate(normalized):
                setattr(o, "is_correct", i == first_correct_idx)
        elif question_type in [QuestionType.ORDERING, QuestionType.MATCHING]:
            for o in normalized:
                setattr(o, "is_correct", False)
    else:
        normalized = []
    return normalized


