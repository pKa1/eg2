"""
Скрипт для создания демонстрационного теста со всеми типами вопросов
"""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.test import Test, Question, QuestionOption, QuestionType, TestStatus


async def create_demo_test():
    """Создает демонстрационный тест со всеми типами вопросов"""
    
    async with AsyncSessionLocal() as session:
        # Находим первого преподавателя или админа
        result = await session.execute(
            text("SELECT * FROM users WHERE role IN ('teacher', 'admin') LIMIT 1")
        )
        teacher = result.first()
        
        if not teacher:
            print("❌ Не найден пользователь с ролью teacher или admin")
            print("💡 Создайте преподавателя: make create-admin")
            return
        
        teacher_id = teacher[0]  # id первой колонки
        print(f"✅ Найден преподаватель ID: {teacher_id}")
        
        # Создаем тест
        test = Test(
            title="🎯 Демо-тест: Все типы вопросов",
            description="Этот тест демонстрирует все 11 типов вопросов, доступных в платформе. Используйте его для изучения возможностей и тестирования функционала.",
            creator_id=teacher_id,
            duration_minutes=30,
            passing_score=70.0,
            max_attempts=3,
            show_results=True,
            shuffle_questions=False,
            shuffle_options=False,
            status='published'
        )
        session.add(test)
        await session.flush()  # Получаем ID теста
        
        print(f"✅ Создан тест ID: {test.id}")
        
        # === 1. SINGLE CHOICE ===
        q1 = Question(
            test_id=test.id,
            question_text="Какая планета является самой большой в Солнечной системе?",
            question_type='single_choice',
            points=1.0,
            order=1,
            explanation="Юпитер — самая большая планета Солнечной системы, газовый гигант."
        )
        session.add(q1)
        await session.flush()
        
        for opt_text, is_correct in [
            ("Марс", False),
            ("Юпитер", True),
            ("Сатурн", False),
            ("Венера", False)
        ]:
            session.add(QuestionOption(
                question_id=q1.id,
                option_text=opt_text,
                is_correct=is_correct,
                order=len([o for o in [("Марс", False), ("Юпитер", True), ("Сатурн", False), ("Венера", False)] if o[0] <= opt_text])
            ))
        
        # === 2. MULTIPLE CHOICE ===
        q2 = Question(
            test_id=test.id,
            question_text="Какие из перечисленных языков программирования являются объектно-ориентированными?",
            question_type='multiple_choice',
            points=2.0,
            order=2,
            explanation="Python, Java и C++ поддерживают ООП. C — процедурный язык."
        )
        session.add(q2)
        await session.flush()
        
        for idx, (opt_text, is_correct) in enumerate([
            ("Python", True),
            ("C", False),
            ("Java", True),
            ("C++", True)
        ], 1):
            session.add(QuestionOption(
                question_id=q2.id,
                option_text=opt_text,
                is_correct=is_correct,
                order=idx
            ))
        
        # === 3. TRUE/FALSE ===
        q3 = Question(
            test_id=test.id,
            question_text="HTML является языком программирования.",
            question_type='true_false',
            points=1.0,
            order=3,
            explanation="HTML — это язык разметки (HyperText Markup Language), а не язык программирования."
        )
        session.add(q3)
        await session.flush()
        
        for idx, (opt_text, is_correct) in enumerate([
            ("Правда", False),
            ("Ложь", True)
        ], 1):
            session.add(QuestionOption(
                question_id=q3.id,
                option_text=opt_text,
                is_correct=is_correct,
                order=idx
            ))
        
        # === 4. SHORT ANSWER ===
        q4 = Question(
            test_id=test.id,
            question_text="Какая столица России?",
            question_type='short_answer',
            points=1.0,
            order=4,
            correct_answer_text="Москва",
            explanation="Москва — столица и крупнейший город России."
        )
        session.add(q4)
        
        # === 5. ESSAY ===
        q5 = Question(
            test_id=test.id,
            question_text="Опишите основные преимущества использования облачных технологий в современном бизнесе. (минимум 100 слов)",
            question_type='essay',
            points=5.0,
            order=5,
            explanation="Ожидается развернутый ответ с конкретными примерами и аргументами."
        )
        session.add(q5)
        
        # === 6. NUMERIC ===
        q6 = Question(
            test_id=test.id,
            question_text="Чему равно значение числа π (Пи) с точностью до двух знаков после запятой?",
            question_type='numeric',
            points=1.0,
            order=6,
            correct_answer_text="3.14",
            explanation="π ≈ 3.14159..., с точностью до двух знаков: 3.14"
        )
        session.add(q6)
        
        # === 7. MATCHING ===
        q7 = Question(
            test_id=test.id,
            question_text="Сопоставьте языки программирования с их создателями:",
            question_type='matching',
            points=2.0,
            order=7,
            explanation="Python — Гвидо ван Россум, JavaScript — Брендан Эйх, Java — Джеймс Гослинг, C++ — Бьёрн Страуструп"
        )
        session.add(q7)
        await session.flush()
        
        for idx, (left_text, right_text) in enumerate([
            ("Python", "Гвидо ван Россум"),
            ("JavaScript", "Брендан Эйх"),
            ("Java", "Джеймс Гослинг"),
            ("C++", "Бьёрн Страуструп")
        ]):
            session.add(QuestionOption(
                question_id=q7.id,
                option_text=right_text,
                matching_pair=left_text,
                is_correct=False,
                order=idx
            ))
        
        # === 8. FILL IN BLANK ===
        q8 = Question(
            test_id=test.id,
            question_text="Столица Франции — _____, столица Италии — _____, столица Германии — _____.",
            question_type='fill_in_blank',
            points=1.5,
            order=8,
            correct_answer_text="Париж, Рим, Берлин",
            explanation="Париж — столица Франции, Рим — Италии, Берлин — Германии."
        )
        session.add(q8)
        
        # === 9. ORDERING ===
        q9 = Question(
            test_id=test.id,
            question_text="Расположите этапы жизненного цикла разработки ПО в правильном порядке:",
            question_type='ordering',
            points=2.0,
            order=9,
            explanation="Правильная последовательность: Анализ → Проектирование → Разработка → Тестирование → Развертывание"
        )
        session.add(q9)
        await session.flush()
        
        for idx, opt_text in enumerate([
            "Анализ требований",
            "Проектирование",
            "Разработка",
            "Тестирование",
            "Развертывание"
        ], 1):
            session.add(QuestionOption(
                question_id=q9.id,
                option_text=opt_text,
                is_correct=True,  # Для ordering все элементы правильные
                order=idx
            ))
        
        # === 10. CODE ===
        q10 = Question(
            test_id=test.id,
            question_text="Напишите функцию на Python, которая принимает список чисел и возвращает их сумму.",
            question_type='code',
            points=3.0,
            order=10,
            correct_answer_text="""def sum_numbers(numbers):
    return sum(numbers)

# Альтернативное решение:
def sum_numbers(numbers):
    total = 0
    for num in numbers:
        total += num
    return total""",
            explanation="Можно использовать встроенную функцию sum() или цикл для суммирования."
        )
        session.add(q10)
        
        # === 11. FILE UPLOAD ===
        q11 = Question(
            test_id=test.id,
            question_text="Загрузите вашу презентацию на тему 'Искусственный интеллект в образовании'",
            question_type='file_upload',
            points=5.0,
            order=11,
            explanation="Ожидается презентация в формате PDF, PPT или PPTX с анализом применения ИИ в обучении."
        )
        session.add(q11)
        
        # Сохраняем все изменения
        await session.commit()
        
        print("\n" + "="*60)
        print("✅ ДЕМО-ТЕСТ УСПЕШНО СОЗДАН!")
        print("="*60)
        print(f"\n📋 Название: {test.title}")
        print(f"🆔 ID теста: {test.id}")
        print(f"👨‍🏫 Создатель ID: {teacher_id}")
        print(f"📊 Статус: {test.status}")
        print(f"❓ Количество вопросов: 11")
        print(f"⏱️  Длительность: {test.duration_minutes} минут")
        print(f"🎯 Проходной балл: {test.passing_score}%")
        print(f"🔄 Максимум попыток: {test.max_attempts}")
        
        print("\n📝 Типы вопросов в тесте:")
        print("  1️⃣  Один правильный ответ (Single Choice)")
        print("  2️⃣  Несколько правильных ответов (Multiple Choice)")
        print("  3️⃣  Правда/Ложь (True/False)")
        print("  4️⃣  Короткий ответ (Short Answer)")
        print("  5️⃣  Эссе (Essay)")
        print("  6️⃣  Числовой ответ (Numeric)")
        print("  7️⃣  Соответствие (Matching)")
        print("  8️⃣  Заполнить пропуски (Fill in Blank)")
        print("  9️⃣  Упорядочивание (Ordering)")
        print("  🔟 Код (Code)")
        print("  1️⃣1️⃣  Загрузка файла (File Upload)")
        
        print("\n🌐 Откройте в браузере:")
        print(f"   http://localhost:5173")
        print(f"   Перейдите в раздел 'Мои тесты' для просмотра")
        print("\n" + "="*60)


if __name__ == "__main__":
    print("🚀 Запуск создания демо-теста...")
    print("="*60)
    asyncio.run(create_demo_test())

