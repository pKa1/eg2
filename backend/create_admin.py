"""
Скрипт создания/обновления администратора.
Пример использования:
  python backend/create_admin.py --username superadmin --password "S3cure!"
"""

import argparse
import asyncio
from typing import Optional

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole


async def create_admin_user(
    username: str,
    password: str,
    email: str,
    full_name: Optional[str],
    force: bool,
) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == username))
        admin = result.scalar_one_or_none()

        if admin and not force:
            print("⚠️  Пользователь с таким username уже существует. Используйте --force для обновления.")
            return

        if not admin:
            admin = User(username=username)
            db.add(admin)

        admin.email = email
        admin.full_name = full_name or admin.full_name or "Администратор"
        admin.hashed_password = get_password_hash(password)
        admin.role = UserRole.ADMIN
        admin.is_active = True
        admin.is_verified = True

        await db.commit()
        print("✅ Администратор сохранен.")
        print(f"  Username: {username}")
        print(f"  Email:    {email}")
        print("⚠️  Обязательно смените пароль после первого входа!")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Создать или обновить администратора")
    parser.add_argument("--username", default="admin", help="Имя пользователя администратора (по умолчанию: admin)")
    parser.add_argument("--password", default="admin123", help="Пароль администратора (по умолчанию: admin123)")
    parser.add_argument("--email", default="admin@example.com", help="Email администратора")
    parser.add_argument("--full-name", default="Администратор", help="Полное имя администратора")
    parser.add_argument("--force", action="store_true", help="Обновить существующего пользователя")
    return parser.parse_args()


if __name__ == "__main__":
    options = parse_args()
    asyncio.run(
        create_admin_user(
            username=options.username,
            password=options.password,
            email=options.email,
            full_name=options.full_name,
            force=options.force,
        )
    )

