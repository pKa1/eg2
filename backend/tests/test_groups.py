import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from datetime import datetime, timedelta, timezone

from app.models.user import User


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
async def test_group_permissions_and_assign(client: AsyncClient, db_session: AsyncSession):
    # Two teachers and one student
    await register_user(client, "t1@example.com", "t1", "Teacher One", "pass", "teacher")
    await register_user(client, "t2@example.com", "t2", "Teacher Two", "pass", "teacher")
    await register_user(client, "s1@example.com", "s1", "Student One", "pass", "student")

    # Verify accounts
    await db_session.execute(update(User).where(User.username.in_(["t1", "t2", "s1"])).values(is_verified=True))
    await db_session.commit()

    t1 = await login_user(client, "t1", "pass")
    t2 = await login_user(client, "t2", "pass")

    # t1 creates a group
    r = await client.post(
        "/api/v1/groups/",
        json={"name": "Group A", "description": "desc"},
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert r.status_code == 201, r.text
    group_id = r.json()["id"]

    # t2 cannot edit t1's group
    r = await client.patch(
        f"/api/v1/groups/{group_id}",
        json={"name": "Hacked Name"},
        headers={"Authorization": f"Bearer {t2}"},
    )
    assert r.status_code == 403

    # t1 adds student to group
    r = await client.post(
        f"/api/v1/groups/{group_id}/members",
        json={"group_id": group_id, "student_id": 3},
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert r.status_code == 201, r.text

    # Create a published test by t1
    r = await client.post(
        "/api/v1/tests/",
        json={
            "title": "Math",
            "status": "published",
            "passing_score": 50,
            "questions": [
                {
                    "question_text": "1+1?",
                    "question_type": "single_choice",
                    "points": 1,
                    "order": 0,
                    "options": [
                        {"option_text": "2", "is_correct": True, "order": 0},
                        {"option_text": "3", "is_correct": False, "order": 1},
                    ],
                }
            ],
        },
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert r.status_code == 201, r.text
    test_id = r.json()["id"]

    # Assign test to group with due_date
    due = datetime.now(timezone.utc) + timedelta(days=2)
    r = await client.post(
        f"/api/v1/tests/{test_id}/assign-group",
        params={"group_id": group_id, "due_date": due.isoformat()},
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert r.status_code == 201, r.text
    created = r.json()
    assert isinstance(created, list) and len(created) == 1


