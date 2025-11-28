"""
Скрипт для создания демонстрационного студента с назначенным тестом
"""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.test import TestAssignment
from datetime import datetime, timedelta


async def create_demo_student():
    """Создает демонстрационного студента и назначает ему тесты"""
    
    async with AsyncSessionLocal() as session:
        print("🚀 Создание демо-студента...")
        print("="*60)
        
        # Проверяем, есть ли уже студент с таким email
        result = await session.execute(
            text("SELECT * FROM users WHERE email = 'student@demo.com' LIMIT 1")
        )
        existing = result.first()
        
        if existing:
            print("⚠️  Студент student@demo.com уже существует")
            student_id = existing[0]
            print(f"✅ Используем существующего студента ID: {student_id}")
        else:
            # Создаем нового студента
            password_hash = get_password_hash("student123")
            
            result = await session.execute(
                text("""
                    INSERT INTO users (email, username, full_name, hashed_password, role, is_active)
                    VALUES (:email, :username, :full_name, :hashed_password, :role, :is_active)
                    RETURNING id, email, full_name
                """),
                {
                    "email": "student@demo.com",
                    "username": "demo_student",
                    "full_name": "Иван Демо-Студент",
                    "hashed_password": password_hash,
                    "role": "student",
                    "is_active": True
                }
            )
            
            student = result.first()
            student_id = student[0]
            await session.commit()
            
            print(f"✅ Создан новый студент ID: {student_id}")
            print(f"   Email: {student[1]}")
            print(f"   Имя: {student[2]}")
        
        # Находим все опубликованные тесты
        result = await session.execute(
            text("SELECT id, title FROM tests WHERE status = 'published' ORDER BY id")
        )
        tests = result.fetchall()
        
        if not tests:
            print("\n⚠️  Нет опубликованных тестов для назначения")
            print("💡 Создайте тест командой: make create-demo-test")
            return
        
        print(f"\n📚 Найдено тестов для назначения: {len(tests)}")
        
        # Назначаем все тесты студенту
        assigned_count = 0
        for test in tests:
            test_id = test[0]
            test_title = test[1]
            
            # Проверяем, не назначен ли уже этот тест
            result = await session.execute(
                text("""
                    SELECT id FROM test_assignments 
                    WHERE test_id = :test_id AND student_id = :student_id
                """),
                {"test_id": test_id, "student_id": student_id}
            )
            
            if result.first():
                print(f"   ⏭️  Тест '{test_title[:50]}...' уже назначен")
                continue
            
            # Назначаем тест с дедлайном через 30 дней
            due_date = datetime.now() + timedelta(days=30)
            
            await session.execute(
                text("""
                    INSERT INTO test_assignments (test_id, student_id, due_date, assigned_by_id)
                    VALUES (:test_id, :student_id, :due_date, :assigned_by_id)
                """),
                {
                    "test_id": test_id,
                    "student_id": student_id,
                    "due_date": due_date,
                    "assigned_by_id": 1  # Предполагаем, что админ с ID=1 назначает
                }
            )
            
            print(f"   ✅ Назначен: '{test_title[:50]}'")
            assigned_count += 1
        
        await session.commit()
        
        # Финальный вывод
        print("\n" + "="*60)
        print("✅ ДЕМО-СТУДЕНТ ГОТОВ К ИСПОЛЬЗОВАНИЮ!")
        print("="*60)
        
        print("\n👤 Учетные данные для входа:")
        print("   📧 Email:    student@demo.com")
        print("   🔑 Пароль:   student123")
        
        print(f"\n📚 Назначено тестов: {assigned_count}")
        print(f"📅 Срок выполнения: {(datetime.now() + timedelta(days=30)).strftime('%d.%m.%Y')}")
        
        print("\n🌐 Как войти:")
        print("   1. Откройте: http://localhost:5173")
        print("   2. Войдите с учетными данными выше")
        print("   3. Вы увидите интерфейс студента с назначенными тестами")
        
        print("\n📝 Что может делать студент:")
        print("   ✅ Просматривать назначенные тесты")
        print("   ✅ Проходить тесты")
        print("   ✅ Видеть свои результаты")
        print("   ✅ Просматривать правильные ответы (если разрешено)")
        
        print("\n💡 Подсказка:")
        print("   Чтобы назначить еще тесты, создайте их командой:")
        print("   make create-demo-test")
        
        print("\n" + "="*60)
        print("🎓 Приятного тестирования!")
        print("="*60 + "\n")


if __name__ == "__main__":
    print("🎯 Запуск создания демо-студента...")
    asyncio.run(create_demo_student())

