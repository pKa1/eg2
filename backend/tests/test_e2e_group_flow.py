import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from datetime import datetime, timezone, timedelta

from app.models.user import User


async def register_user(client: AsyncClient, email: str, username: str, full_name: str, password: str, role: str):
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": username, "full_name": full_name, "password": password, "role": role},
    )
    assert r.status_code == 201, r.text


async def login_user(client: AsyncClient, username: str, password: str) -> str:
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_e2e_group_assignment_and_analytics(client: AsyncClient, db_session: AsyncSession):
    # Arrange: register teacher and student, verify
    await register_user(client, "teach@example.com", "teach", "Teach", "pass", "teacher")
    await register_user(client, "stud@example.com", "stud", "Stud", "pass", "student")
    await db_session.execute(update(User).where(User.username.in_(["teach", "stud"])).values(is_verified=True))
    await db_session.commit()

    teach_token = await login_user(client, "teach", "pass")
    stud_token = await login_user(client, "stud", "pass")

    # Create group by teacher and add student
    r = await client.post("/api/v1/groups/", json={"name": "E2E Group"}, headers={"Authorization": f"Bearer {teach_token}"})
    assert r.status_code == 201, r.text
    group_id = r.json()["id"]
    r = await client.post(
        f"/api/v1/groups/{group_id}/members",
        json={"group_id": group_id, "student_id": 2},
        headers={"Authorization": f"Bearer {teach_token}"},
    )
    assert r.status_code == 201, r.text

    # Create published test
    r = await client.post(
        "/api/v1/tests/",
        json={
            "title": "E2E Test",
            "status": "published",
            "passing_score": 50,
            "questions": [
                {
                    "question_text": "Capital of France?",
                    "question_type": "single_choice",
                    "points": 1,
                    "order": 0,
                    "options": [
                        {"option_text": "Paris", "is_correct": True, "order": 0},
                        {"option_text": "London", "is_correct": False, "order": 1},
                    ],
                }
            ],
        },
        headers={"Authorization": f"Bearer {teach_token}"},
    )
    assert r.status_code == 201, r.text
    test_id = r.json()["id"]
    question_id = r.json()["questions"][0]["id"]
    correct_option_id = next(o["id"] for o in r.json()["questions"][0]["options"] if o["is_correct"])

    # Assign test to group with due date
    due = datetime.now(timezone.utc) + timedelta(days=1)
    r = await client.post(
        f"/api/v1/tests/{test_id}/assign-group",
        params={"group_id": group_id, "due_date": due.isoformat()},
        headers={"Authorization": f"Bearer {teach_token}"},
    )
    assert r.status_code == 201, r.text

    # Student starts and submits
    r = await client.post("/api/v1/results/start", json={"test_id": test_id}, headers={"Authorization": f"Bearer {stud_token}"})
    assert r.status_code == 200, r.text
    started_at = r.json()["started_at"]
    r = await client.post(
        "/api/v1/results/submit",
        json={
            "test_id": test_id,
            "started_at": started_at,
            "answers": [{"question_id": question_id, "answer_data": {"selected_option_id": correct_option_id}}],
        },
        headers={"Authorization": f"Bearer {stud_token}"},
    )
    assert r.status_code == 200, r.text

    # Analytics for group (should reflect 1 result and pass rate 100)
    r = await client.get(f"/api/v1/groups/{group_id}/analytics", params={"test_id": test_id}, headers={"Authorization": f"Bearer {teach_token}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["count"] >= 1
    assert data["pass_rate"] >= 100 - 0.01


