"""
Скрипт для автоматического назначения теста всем студентам
"""
import asyncio
import sys
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.user import User
from app.models.test import Test, TestAssignment


async def assign_test_to_all_students(test_id: int):
    async with AsyncSessionLocal() as session:
        # Получаем тест
        result = await session.execute(
            select(Test).where(Test.id == test_id)
        )
        test = result.scalar_one_or_none()
        
        if not test:
            print(f"❌ Тест с ID {test_id} не найден!")
            return
        
        print(f"📝 Тест: {test.title}")
        print(f"   Статус: {test.status}")
        
        # Получаем всех студентов
        result = await session.execute(
            select(User).where(User.role == 'student')
        )
        students = result.scalars().all()
        
        if not students:
            print("❌ Студенты не найдены в системе!")
            return
        
        print(f"\n👥 Найдено студентов: {len(students)}")
        
        assigned_count = 0
        already_assigned = 0
        
        for student in students:
            # Проверяем, не назначен ли тест уже
            result = await session.execute(
                select(TestAssignment).where(
                    TestAssignment.test_id == test_id,
                    TestAssignment.student_id == student.id
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                already_assigned += 1
                print(f"  ⚠️  {student.full_name} ({student.email}) - уже назначен")
            else:
                # Создаем назначение
                assignment = TestAssignment(
                    test_id=test_id,
                    student_id=student.id,
                    assigned_by_id=test.creator_id,
                    due_date=None
                )
                session.add(assignment)
                assigned_count += 1
                print(f"  ✅ {student.full_name} ({student.email}) - назначен")
        
        await session.commit()
        
        print(f"\n{'='*60}")
        print(f"✅ НАЗНАЧЕНИЕ ЗАВЕРШЕНО")
        print(f"{'='*60}")
        print(f"Новых назначений: {assigned_count}")
        print(f"Уже было назначено: {already_assigned}")
        print(f"Всего студентов: {len(students)}")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ Использование: python assign_test_to_students.py <test_id>")
        print("   Пример: python assign_test_to_students.py 1")
        sys.exit(1)
    
    try:
        test_id = int(sys.argv[1])
        asyncio.run(assign_test_to_all_students(test_id))
    except ValueError:
        print("❌ test_id должен быть числом!")
        sys.exit(1)

