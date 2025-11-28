import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from app.models.user import User, UserRole


async def register_user(client: AsyncClient, email: str, username: str, full_name: str, password: str, role: str):
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
    assert r.status_code == 201, r.text
    return r.json()


async def login_user(client: AsyncClient, username: str, password: str) -> str:
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    return data["access_token"]


@pytest.mark.asyncio
async def test_create_assign_take_submit_flow(client: AsyncClient, db_session: AsyncSession):
    # Register teacher and student
    await register_user(
        client,
        email="teacher@example.com",
        username="teacher1",
        full_name="Teacher One",
        password="password123",
        role="teacher",
    )
    await register_user(
        client,
        email="student@example.com",
        username="student1",
        full_name="Student One",
        password="password123",
        role="student",
    )
    # verify users
    await db_session.execute(update(User).where(User.username.in_(["teacher1","student1"])).values(is_verified=True))
    await db_session.commit()

    teacher_token = await login_user(client, "teacher1", "password123")
    student_token = await login_user(client, "student1", "password123")

    # Teacher creates a published test with one single-choice question
    create_payload = {
        "title": "Demo Test",
        "description": "desc",
        "duration_minutes": 10,
        "passing_score": 60,
        "max_attempts": 2,
        "show_results": True,
        "shuffle_questions": False,
        "shuffle_options": False,
        "status": "published",
        "questions": [
            {
                "question_text": "2 + 2 = ?",
                "question_type": "single_choice",
                "points": 1,
                "order": 0,
                "options": [
                    {"option_text": "4", "is_correct": True, "order": 0},
                    {"option_text": "5", "is_correct": False, "order": 1},
                ],
            }
        ],
    }
    r = await client.post(
        "/api/v1/tests/",
        json=create_payload,
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 201, r.text
    test_data = r.json()
    test_id = test_data["id"]

    # Assign to student
    r = await client.post(
        f"/api/v1/tests/{test_id}/assign",
        json={"test_id": test_id, "student_id": 2},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 201, r.text

    # Student lists tests
    r = await client.get(
        "/api/v1/tests/",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert r.status_code == 200
    tests = r.json()
    assert any(t["id"] == test_id for t in tests)

    # Teacher gets test detail (to find correct option, since student view hides answers)
    r = await client.get(f"/api/v1/tests/{test_id}", headers={"Authorization": f"Bearer {teacher_token}"})
    assert r.status_code == 200, r.text
    detail = r.json()
    question_id = detail["questions"][0]["id"]
    correct_option_id = next(o["id"] for o in detail["questions"][0]["options"] if o["is_correct"]) 

    # Start attempt
    r = await client.post(
        "/api/v1/results/start",
        json={"test_id": test_id},
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert r.status_code == 200, r.text
    started_at = r.json()["started_at"]

    # Submit attempt with correct answer
    submit_payload = {
        "test_id": test_id,
        "started_at": started_at,
        "answers": [
            {
                "question_id": question_id,
                "answer_data": {"selected_option_id": correct_option_id},
            }
        ],
    }
    r = await client.post(
        "/api/v1/results/submit",
        json=submit_payload,
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["score"] == 100
    assert result["is_passed"] is True


