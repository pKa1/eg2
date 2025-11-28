"""
Создание комплексного теста со ВСЕМИ 11 типами вопросов
для проверки корректности работы платформы
"""
import asyncio
from app.core.database import AsyncSessionLocal
from app.models.test import Test, Question, QuestionOption
from app.core.security import get_password_hash


async def create_comprehensive_test():
    async with AsyncSessionLocal() as session:
        # Получаем или создаем учителя
        from sqlalchemy import select
        from app.models.user import User
        
        result = await session.execute(
            select(User).where(User.role == 'teacher')
        )
        teacher = result.scalar_one_or_none()
        
        if not teacher:
            # Создаем учителя, если нет
            teacher = User(
                email="teacher_test@example.com",
                username="teacher_test",
                hashed_password=get_password_hash("test123"),
                full_name="Учитель Тестовый",
                role="teacher",
                is_active=True,
                is_verified=True
            )
            session.add(teacher)
            await session.flush()
        
        # Создаем тест
        test = Test(
            title="🧪 Полный тест всех типов вопросов",
            description="Этот тест содержит по одному вопросу каждого из 11 типов для комплексной проверки",
            duration_minutes=30,
            passing_score=70.0,
            max_attempts=None,
            show_results=True,
            shuffle_questions=False,
            shuffle_options=False,
            status='published',
            creator_id=teacher.id
        )
        
        session.add(test)
        await session.flush()
        
        print(f"✅ Создан тест: {test.title} (ID: {test.id})")
        
        # 1. SINGLE_CHOICE
        q1 = Question(
            test_id=test.id,
            question_text="Какая планета является самой большой в Солнечной системе?",
            question_type='single_choice',
            points=1.0,
            order=0,
            correct_answer_text=None,
            explanation="Юпитер — газовый гигант и самая большая планета в нашей системе"
        )
        session.add(q1)
        await session.flush()
        
        options_q1 = [
            QuestionOption(question_id=q1.id, option_text="Марс", is_correct=False, order=0),
            QuestionOption(question_id=q1.id, option_text="Юпитер", is_correct=True, order=1),
            QuestionOption(question_id=q1.id, option_text="Сатурн", is_correct=False, order=2),
            QuestionOption(question_id=q1.id, option_text="Земля", is_correct=False, order=3),
        ]
        for opt in options_q1:
            session.add(opt)
        print(f"  ✓ Вопрос 1: SINGLE_CHOICE")
        
        # 2. MULTIPLE_CHOICE
        q2 = Question(
            test_id=test.id,
            question_text="Какие из этих языков программирования являются объектно-ориентированными? (выберите все)",
            question_type='multiple_choice',
            points=2.0,
            order=1,
            correct_answer_text=None,
            explanation="Python, Java и C++ поддерживают ООП, а C — процедурный язык"
        )
        session.add(q2)
        await session.flush()
        
        options_q2 = [
            QuestionOption(question_id=q2.id, option_text="Python", is_correct=True, order=0),
            QuestionOption(question_id=q2.id, option_text="Java", is_correct=True, order=1),
            QuestionOption(question_id=q2.id, option_text="C", is_correct=False, order=2),
            QuestionOption(question_id=q2.id, option_text="C++", is_correct=True, order=3),
        ]
        for opt in options_q2:
            session.add(opt)
        print(f"  ✓ Вопрос 2: MULTIPLE_CHOICE")
        
        # 3. TRUE_FALSE
        q3 = Question(
            test_id=test.id,
            question_text="JavaScript и Java — это один и тот же язык программирования",
            question_type='true_false',
            points=1.0,
            order=2,
            correct_answer_text="false",
            explanation="Это распространенное заблуждение. JavaScript и Java — совершенно разные языки"
        )
        session.add(q3)
        await session.flush()
        print(f"  ✓ Вопрос 3: TRUE_FALSE")
        
        # 4. SHORT_ANSWER
        q4 = Question(
            test_id=test.id,
            question_text="Как называется процесс преобразования исходного кода в машинный код?",
            question_type='short_answer',
            points=1.5,
            order=3,
            correct_answer_text="компиляция",
            explanation="Компиляция — это процесс преобразования программы на высокоуровневом языке в машинный код"
        )
        session.add(q4)
        await session.flush()
        print(f"  ✓ Вопрос 4: SHORT_ANSWER")
        
        # 5. ESSAY
        q5 = Question(
            test_id=test.id,
            question_text="Опишите разницу между Stack и Heap в управлении памятью (минимум 100 символов)",
            question_type='essay',
            points=3.0,
            order=4,
            correct_answer_text=None,
            explanation="Stack используется для статического выделения памяти (локальные переменные), "
                       "Heap — для динамического (объекты). Stack работает по принципу LIFO и быстрее."
        )
        session.add(q5)
        await session.flush()
        print(f"  ✓ Вопрос 5: ESSAY")
        
        # 6. MATCHING
        q6 = Question(
            test_id=test.id,
            question_text="Сопоставьте языки программирования с их основным применением:",
            question_type='matching',
            points=2.0,
            order=5,
            correct_answer_text="1-2, 2-3, 3-1, 4-4",
            explanation="Python — данные, JavaScript — веб (фронтенд), C++ — системное программирование, SQL — базы данных"
        )
        session.add(q6)
        await session.flush()
        
        options_q6 = [
            # Левая колонка (что сопоставляем)
            QuestionOption(question_id=q6.id, option_text="Python", is_correct=False, order=0),
            QuestionOption(question_id=q6.id, option_text="JavaScript", is_correct=False, order=1),
            QuestionOption(question_id=q6.id, option_text="C++", is_correct=False, order=2),
            QuestionOption(question_id=q6.id, option_text="SQL", is_correct=False, order=3),
            # Правая колонка (с чем сопоставляем)
            QuestionOption(question_id=q6.id, option_text="Системное программирование", is_correct=False, order=4),
            QuestionOption(question_id=q6.id, option_text="Анализ данных и AI", is_correct=False, order=5),
            QuestionOption(question_id=q6.id, option_text="Веб-разработка (фронтенд)", is_correct=False, order=6),
            QuestionOption(question_id=q6.id, option_text="Работа с базами данных", is_correct=False, order=7),
        ]
        for opt in options_q6:
            session.add(opt)
        print(f"  ✓ Вопрос 6: MATCHING")
        
        # 7. FILL_IN_BLANK
        q7 = Question(
            test_id=test.id,
            question_text="Столица Франции — _____, а столица Германии — _____.",
            question_type='fill_in_blank',
            points=2.0,
            order=6,
            correct_answer_text="Париж, Берлин",
            explanation="Париж — столица Франции, Берлин — столица Германии"
        )
        session.add(q7)
        await session.flush()
        print(f"  ✓ Вопрос 7: FILL_IN_BLANK")
        
        # 8. ORDERING
        q8 = Question(
            test_id=test.id,
            question_text="Расположите этапы разработки ПО в правильном порядке (Waterfall модель):",
            question_type='ordering',
            points=2.0,
            order=7,
            correct_answer_text="1,2,3,4,5",
            explanation="Классическая Waterfall модель: Требования → Проектирование → Реализация → Тестирование → Поддержка"
        )
        session.add(q8)
        await session.flush()
        
        options_q8 = [
            QuestionOption(question_id=q8.id, option_text="Сбор требований", is_correct=False, order=0),
            QuestionOption(question_id=q8.id, option_text="Проектирование", is_correct=False, order=1),
            QuestionOption(question_id=q8.id, option_text="Реализация (кодирование)", is_correct=False, order=2),
            QuestionOption(question_id=q8.id, option_text="Тестирование", is_correct=False, order=3),
            QuestionOption(question_id=q8.id, option_text="Поддержка и сопровождение", is_correct=False, order=4),
        ]
        for opt in options_q8:
            session.add(opt)
        print(f"  ✓ Вопрос 8: ORDERING")
        
        # 9. NUMERIC
        q9 = Question(
            test_id=test.id,
            question_text="Сколько байт в одном килобайте (КБ)?",
            question_type='numeric',
            points=1.0,
            order=8,
            correct_answer_text="1024",
            explanation="1 килобайт = 1024 байта (2^10)"
        )
        session.add(q9)
        await session.flush()
        print(f"  ✓ Вопрос 9: NUMERIC")
        
        # 10. FILE_UPLOAD
        q10 = Question(
            test_id=test.id,
            question_text="Загрузите скриншот вашего рабочего окружения для разработки (IDE или редактор кода)",
            question_type='file_upload',
            points=2.0,
            order=9,
            correct_answer_text=None,
            explanation="Этот вопрос требует ручной проверки преподавателем"
        )
        session.add(q10)
        await session.flush()
        print(f"  ✓ Вопрос 10: FILE_UPLOAD")
        
        # 11. CODE
        q11 = Question(
            test_id=test.id,
            question_text="Напишите функцию на Python, которая возвращает факториал числа n:",
            question_type='code',
            points=3.0,
            order=10,
            correct_answer_text=None,
            explanation="Пример решения:\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n-1)"
        )
        session.add(q11)
        await session.flush()
        print(f"  ✓ Вопрос 11: CODE")
        
        # Коммитим все изменения
        await session.commit()
        
        print(f"\n{'='*60}")
        print(f"✅ УСПЕШНО СОЗДАН ТЕСТ!")
        print(f"{'='*60}")
        print(f"ID теста: {test.id}")
        print(f"Название: {test.title}")
        print(f"Статус: {test.status}")
        print(f"Всего вопросов: 11 (все типы)")
        print(f"Максимальный балл: {sum([1.0, 2.0, 1.0, 1.5, 3.0, 2.0, 2.0, 2.0, 1.0, 2.0, 3.0])} баллов")
        print(f"\n📝 Типы вопросов:")
        print(f"  1. Single Choice - Одиночный выбор")
        print(f"  2. Multiple Choice - Множественный выбор")
        print(f"  3. True/False - Правда/Ложь")
        print(f"  4. Short Answer - Короткий ответ")
        print(f"  5. Essay - Эссе")
        print(f"  6. Matching - Сопоставление")
        print(f"  7. Fill in the Blank - Заполнить пропуски")
        print(f"  8. Ordering - Упорядочивание")
        print(f"  9. Numeric - Числовой ответ")
        print(f"  10. File Upload - Загрузка файла")
        print(f"  11. Code - Написание кода")
        print(f"{'='*60}\n")
        
        return test.id


if __name__ == "__main__":
    asyncio.run(create_comprehensive_test())

