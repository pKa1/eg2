import pytest
from httpx import AsyncClient
from datetime import datetime, timezone


async def ensure_user(client: AsyncClient, email: str, username: str, full_name: str, password: str, role: str):
    r = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": username,
            "full_name": full_name,
            "password": password,
            "role": role,
        },
    )
    # allow already exists (when tests reuse fixture DB)
    if r.status_code not in (200, 201, 400):
        assert r.status_code in (200, 201, 400), r.text


async def login(client: AsyncClient, username: str, password: str) -> str:
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def create_test_with_questions(client: AsyncClient, token: str, questions):
    payload = {
        "title": "QTypes Test",
        "passing_score": 60,
        "show_results": True,
        "shuffle_questions": False,
        "shuffle_options": False,
        "status": "published",
        "questions": questions,
    }
    r = await client.post("/api/v1/tests/", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, r.text
    return r.json()


async def assign_to_student(client: AsyncClient, token: str, test_id: int, student_id: int):
    r = await client.post(
        f"/api/v1/tests/{test_id}/assign",
        json={"test_id": test_id, "student_id": student_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text


async def start_attempt(client: AsyncClient, token: str, test_id: int) -> str:
    r = await client.post(
        "/api/v1/results/start",
        json={"test_id": test_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    return r.json()["started_at"]


async def get_test_detail(client: AsyncClient, token: str, test_id: int):
    r = await client.get(f"/api/v1/tests/{test_id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_single_choice(client: AsyncClient):
    await ensure_user(client, "t_sc@example.com", "t_sc", "Teacher SC", "pass1234", "teacher")
    await ensure_user(client, "s_sc@example.com", "s_sc", "Student SC", "pass1234", "student")
    teacher = await login(client, "t_sc", "pass1234")
    student = await login(client, "s_sc", "pass1234")

    test = await create_test_with_questions(
        client,
        teacher,
        [
            {
                "question_text": "2+2?",
                "question_type": "single_choice",
                "points": 2,
                "order": 0,
                "options": [
                    {"option_text": "4", "is_correct": True, "order": 0},
                    {"option_text": "3", "is_correct": False, "order": 1},
                ],
            }
        ],
    )
    await assign_to_student(client, teacher, test["id"], 2)
    started_at = await start_attempt(client, student, test["id"])
    detail = await get_test_detail(client, student, test["id"]) 
    q = detail["questions"][0]
    correct_option = next(o for o in q["options"] if o["is_correct"]) 
    submit = {
        "test_id": test["id"],
        "started_at": started_at,
        "answers": [{"question_id": q["id"], "answer_data": {"selected_option_id": correct_option["id"]}}],
    }
    r = await client.post("/api/v1/results/submit", json=submit, headers={"Authorization": f"Bearer {student}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["score"] == 100
    assert data["status"] == "auto_completed"
    assert data["pending_answers_count"] == 0


@pytest.mark.asyncio
async def test_multiple_choice(client: AsyncClient):
    await ensure_user(client, "t_mc@example.com", "t_mc", "Teacher MC", "pass1234", "teacher")
    await ensure_user(client, "s_mc@example.com", "s_mc", "Student MC", "pass1234", "student")
    teacher = await login(client, "t_mc", "pass1234")
    student = await login(client, "s_mc", "pass1234")

    test = await create_test_with_questions(
        client,
        teacher,
        [
            {
                "question_text": "Select primes",
                "question_type": "multiple_choice",
                "points": 3,
                "order": 0,
                "options": [
                    {"option_text": "2", "is_correct": True, "order": 0},
                    {"option_text": "3", "is_correct": True, "order": 1},
                    {"option_text": "4", "is_correct": False, "order": 2},
                ],
            }
        ],
    )
    await assign_to_student(client, teacher, test["id"], 4)
    started_at = await start_attempt(client, student, test["id"]) 
    detail = await get_test_detail(client, student, test["id"]) 
    q = detail["questions"][0]
    correct_ids = [o["id"] for o in q["options"] if o["is_correct"]]
    submit = {
        "test_id": test["id"],
        "started_at": started_at,
        "answers": [{"question_id": q["id"], "answer_data": {"selected_option_ids": correct_ids}}],
    }
    r = await client.post("/api/v1/results/submit", json=submit, headers={"Authorization": f"Bearer {student}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["score"] == 100
    assert data["status"] == "auto_completed"
    assert data["pending_answers_count"] == 0


@pytest.mark.asyncio
async def test_true_false_and_numeric(client: AsyncClient):
    await ensure_user(client, "t_tf@example.com", "t_tf", "Teacher TF", "pass1234", "teacher")
    await ensure_user(client, "s_tf@example.com", "s_tf", "Student TF", "pass1234", "student")
    teacher = await login(client, "t_tf", "pass1234")
    student = await login(client, "s_tf", "pass1234")

    test = await create_test_with_questions(
        client,
        teacher,
        [
            {
                "question_text": "Earth is round",
                "question_type": "true_false",
                "points": 1,
                "order": 0,
                "correct_answer_text": "true",
                "options": [],
            },
            {
                "question_text": "Pi approx?",
                "question_type": "numeric",
                "points": 2,
                "order": 1,
                "correct_answer_text": "3.14",
                "options": [],
            },
        ],
    )
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {student}"})
    assert me.status_code == 200
    student_id = me.json()["id"]

    await assign_to_student(client, teacher, test["id"], student_id)
    started_at = await start_attempt(client, student, test["id"]) 
    detail = await get_test_detail(client, student, test["id"]) 
    q_tf = detail["questions"][0]
    q_num = detail["questions"][1]
    submit = {
        "test_id": test["id"],
        "started_at": started_at,
        "answers": [
            {"question_id": q_tf["id"], "answer_data": {"value": "True"}},
            {"question_id": q_num["id"], "answer_data": {"number_value": 3.14}},
        ],
    }
    r = await client.post("/api/v1/results/submit", json=submit, headers={"Authorization": f"Bearer {student}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["points_total"] == 3
    assert round(data["score"]) == 100
    assert data["status"] == "auto_completed"
    assert data["pending_answers_count"] == 0


@pytest.mark.asyncio
async def test_numeric_with_comma_separator(client: AsyncClient):
    await ensure_user(client, "t_numcomma@example.com", "t_numcomma", "Teacher NumComma", "pass1234", "teacher")
    await ensure_user(client, "s_numcomma@example.com", "s_numcomma", "Student NumComma", "pass1234", "student")
    teacher = await login(client, "t_numcomma", "pass1234")
    student = await login(client, "s_numcomma", "pass1234")

    test = await create_test_with_questions(
        client,
        teacher,
        [
            {
                "question_text": "Pi approx?",
                "question_type": "numeric",
                "points": 2,
                "order": 0,
                "correct_answer_text": "3,14",
                "options": [],
            },
        ],
    )
    await assign_to_student(client, teacher, test["id"], 6)
    started_at = await start_attempt(client, student, test["id"])
    detail = await get_test_detail(client, student, test["id"])
    question = detail["questions"][0]

    submit = {
        "test_id": test["id"],
        "started_at": started_at,
        "answers": [
            {"question_id": question["id"], "answer_data": {"number_value": "3,14"}},
        ],
    }
    r = await client.post("/api/v1/results/submit", json=submit, headers={"Authorization": f"Bearer {student}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["points_total"] == 2
    assert round(data["score"]) == 100
    assert data["status"] == "auto_completed"
    assert data["pending_answers_count"] == 0


@pytest.mark.asyncio
async def test_fill_in_blank_and_ordering(client: AsyncClient):
    await ensure_user(client, "t_fb@example.com", "t_fb", "Teacher FB", "pass1234", "teacher")
    await ensure_user(client, "s_fb@example.com", "s_fb", "Student FB", "pass1234", "student")
    teacher = await login(client, "t_fb", "pass1234")
    student = await login(client, "s_fb", "pass1234")

    test = await create_test_with_questions(
        client,
        teacher,
        [
            {
                "question_text": "Paris is capital of _____",
                "question_type": "fill_in_blank",
                "points": 2,
                "order": 0,
                "correct_answer_text": "france",
                "options": [],
            },
            {
                "question_text": "Order numbers",
                "question_type": "ordering",
                "points": 3,
                "order": 1,
                "options": [
                    {"option_text": "one", "is_correct": False, "order": 1},
                    {"option_text": "two", "is_correct": False, "order": 2},
                    {"option_text": "three", "is_correct": False, "order": 3},
                ],
            },
        ],
    )
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {student}"})
    assert me.status_code == 200
    student_id = me.json()["id"]

    await assign_to_student(client, teacher, test["id"], student_id)
    started_at = await start_attempt(client, student, test["id"]) 
    detail = await get_test_detail(client, student, test["id"]) 
    q_blank = detail["questions"][0]
    q_ord = detail["questions"][1]
    # Build order mapping option_id -> position
    order_map = {opt["id"]: opt["order"] for opt in q_ord["options"]}
    submit = {
        "test_id": test["id"],
        "started_at": started_at,
        "answers": [
            {"question_id": q_blank["id"], "answer_data": {"blanks": ["france"]}},
            {"question_id": q_ord["id"], "answer_data": {"order": order_map}},
        ],
    }
    r = await client.post("/api/v1/results/submit", json=submit, headers={"Authorization": f"Bearer {student}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["points_total"] == 5
    assert round(data["score"]) == 100
    assert data["status"] == "auto_completed"
    assert data["pending_answers_count"] == 0


@pytest.mark.asyncio
async def test_ordering_with_one_based_input(client: AsyncClient):
    await ensure_user(client, "t_ordone@example.com", "t_ordone", "Teacher Ord1", "pass1234", "teacher")
    await ensure_user(client, "s_ordone@example.com", "s_ordone", "Student Ord1", "pass1234", "student")
    teacher = await login(client, "t_ordone", "pass1234")
    student = await login(client, "s_ordone", "pass1234")

    test = await create_test_with_questions(
        client,
        teacher,
        [
            {
                "question_text": "Order phases",
                "question_type": "ordering",
                "points": 3,
                "order": 0,
                "options": [
                    {"option_text": "Start", "is_correct": False, "order": 0},
                    {"option_text": "Middle", "is_correct": False, "order": 1},
                    {"option_text": "End", "is_correct": False, "order": 2},
                ],
            },
        ],
    )
    await assign_to_student(client, teacher, test["id"], 8)
    started_at = await start_attempt(client, student, test["id"])
    detail = await get_test_detail(client, student, test["id"])
    q_ord = detail["questions"][0]
    shuffled_options = q_ord["options"]
    submit_order = {}
    for idx, opt in enumerate(shuffled_options, start=1):
        submit_order[opt["id"]] = idx  # пользователь вводит порядковые номера 1..N

    submit = {
        "test_id": test["id"],
        "started_at": started_at,
        "answers": [
            {"question_id": q_ord["id"], "answer_data": {"order": submit_order}},
        ],
    }
    r = await client.post("/api/v1/results/submit", json=submit, headers={"Authorization": f"Bearer {student}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["points_total"] == 3
    assert round(data["score"]) == 100
    assert data["status"] == "auto_completed"
    assert data["pending_answers_count"] == 0


@pytest.mark.asyncio
async def test_matching_manual_text_and_file_upload_and_code(client: AsyncClient):
    await ensure_user(client, "t_mx@example.com", "t_mx", "Teacher MX", "pass1234", "teacher")
    await ensure_user(client, "s_mx@example.com", "s_mx", "Student MX", "pass1234", "student")
    teacher = await login(client, "t_mx", "pass1234")
    student = await login(client, "s_mx", "pass1234")

    # Matching: pairs are stored within single options; correct mapping id->id
    test = await create_test_with_questions(
        client,
        teacher,
        [
            {
                "question_text": "Match countries and capitals",
                "question_type": "matching",
                "points": 4,
                "order": 0,
                "options": [
                    {"option_text": "Paris", "matching_pair": "France", "is_correct": False, "order": 0},
                    {"option_text": "Berlin", "matching_pair": "Germany", "is_correct": False, "order": 1},
                ],
            },
            {
                "question_text": "Write short answer",
                "question_type": "short_answer",
                "points": 1,
                "order": 1,
                "options": [],
            },
            {
                "question_text": "Essay",
                "question_type": "essay",
                "points": 1,
                "order": 2,
                "options": [],
            },
            {
                "question_text": "Upload file",
                "question_type": "file_upload",
                "points": 1,
                "order": 3,
                "options": [],
            },
            {
                "question_text": "Code task",
                "question_type": "code",
                "points": 1,
                "order": 4,
                "options": [],
            },
        ],
    )
    await assign_to_student(client, teacher, test["id"], 10)
    started_at = await start_attempt(client, student, test["id"]) 
    detail = await get_test_detail(client, student, test["id"]) 
    q_match = detail["questions"][0]
    left_options = q_match["options"]
    matches = {opt["id"]: opt["id"] for opt in left_options}
    submit = {
        "test_id": test["id"],
        "started_at": started_at,
        "answers": [
            {"question_id": q_match["id"], "answer_data": {"matches": matches}},
            {"question_id": detail["questions"][1]["id"], "answer_data": {"text": "some"}},
            {"question_id": detail["questions"][2]["id"], "answer_data": {"text": "long text"}},
            {"question_id": detail["questions"][3]["id"], "answer_data": {"file_name": "a.txt", "file_type": "text/plain", "file_size": 5, "file_content": "ZW1wdHk="}},
            {"question_id": detail["questions"][4]["id"], "answer_data": {"code": "print('hi')"}},
        ],
    }
    r = await client.post("/api/v1/results/submit", json=submit, headers={"Authorization": f"Bearer {student}"})
    assert r.status_code == 200, r.text
    data = r.json()
    # Only matching is auto-graded among these, so earned should be 4 out of total (8)
    assert data["points_total"] == 8
    assert data["points_earned"] == 4
    assert 49 < data["score"] < 51  # ~50%
    assert data["status"] == "pending_manual"
    assert data["pending_answers_count"] == 3
    assert data["is_passed"] is False


@pytest.mark.asyncio
async def test_short_answer_auto_grading(client: AsyncClient):
    await ensure_user(client, "t_sa@example.com", "t_sa", "Teacher SA", "pass1234", "teacher")
    await ensure_user(client, "s_sa@example.com", "s_sa", "Student SA", "pass1234", "student")
    teacher = await login(client, "t_sa", "pass1234")
    student = await login(client, "s_sa", "pass1234")

    test = await create_test_with_questions(
        client,
        teacher,
        [
            {
                "question_text": "Какая столица России?",
                "question_type": "short_answer",
                "points": 2,
                "order": 0,
                "correct_answer_text": "Москва|Moscow",
                "options": [],
            }
        ],
    )

    # Получаем фактический ID ученика
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {student}"})
    assert me.status_code == 200
    student_id = me.json()["id"]

    await assign_to_student(client, teacher, test["id"], student_id)
    started_at = await start_attempt(client, student, test["id"])
    detail = await get_test_detail(client, student, test["id"])
    question = detail["questions"][0]

    submit = {
        "test_id": test["id"],
        "started_at": started_at,
        "answers": [
            {"question_id": question["id"], "answer_data": {"text": "   МОСКВА   "}}
        ],
    }
    r = await client.post("/api/v1/results/submit", json=submit, headers={"Authorization": f"Bearer {student}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["points_total"] == 2
    assert data["points_earned"] == 2
    assert data["answers"][0]["is_correct"] is True
    assert data["answers"][0]["points_earned"] == 2
    assert data["status"] == "auto_completed"
    assert data["pending_answers_count"] == 0


@pytest.mark.asyncio
async def test_short_answer_without_expected_answers_requires_manual(client: AsyncClient):
    await ensure_user(client, "t_sam@example.com", "t_sam", "Teacher SA Manual", "pass1234", "teacher")
    await ensure_user(client, "s_sam@example.com", "s_sam", "Student SA Manual", "pass1234", "student")
    teacher = await login(client, "t_sam", "pass1234")
    student = await login(client, "s_sam", "pass1234")

    test = await create_test_with_questions(
        client,
        teacher,
        [
            {
                "question_text": "Опишите процесс",
                "question_type": "short_answer",
                "points": 5,
                "order": 0,
                # намеренно без correct_answer_text → требует ручной проверки
                "options": [],
            }
        ],
    )

    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {student}"})
    assert me.status_code == 200
    student_id = me.json()["id"]

    await assign_to_student(client, teacher, test["id"], student_id)
    started_at = await start_attempt(client, student, test["id"])
    detail = await get_test_detail(client, student, test["id"])
    question = detail["questions"][0]

    submit = {
        "test_id": test["id"],
        "started_at": started_at,
        "answers": [
            {"question_id": question["id"], "answer_data": {"text": "Свободный ответ ученика"}},
        ],
    }
    r = await client.post("/api/v1/results/submit", json=submit, headers={"Authorization": f"Bearer {student}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "pending_manual"
    assert data["pending_answers_count"] == 1
    assert data["answers"][0]["is_correct"] is None
    assert data["status"] == "auto_completed"
    assert data["pending_answers_count"] == 0

