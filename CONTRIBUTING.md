# Contributing to Testing Platform

Спасибо за интерес к улучшению Testing Platform! Это руководство поможет вам начать разработку.

## Начало работы

### 1. Форк и клонирование

```bash
# Fork репозиторий на GitHub, затем клонируйте свой fork
git clone https://github.com/your-username/testing-platform.git
cd testing-platform

# Добавьте upstream remote
git remote add upstream https://github.com/original/testing-platform.git
```

### 2. Создание ветки

```bash
# Обновите main
git checkout main
git pull upstream main

# Создайте feature branch
git checkout -b feature/your-feature-name
# или
git checkout -b fix/your-bug-fix
```

## Локальная разработка

### Backend разработка

```bash
cd backend

# Создайте виртуальное окружение
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или venv\Scripts\activate  # Windows

# Установите зависимости
pip install -r requirements.txt

# Запустите PostgreSQL и Redis
docker-compose up -d postgres redis

# Примените миграции
alembic upgrade head

# Запустите сервер с hot reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend разработка

```bash
cd frontend

# Установите зависимости
npm install

# Запустите dev server с hot reload
npm run dev
```

Backend будет доступен на http://localhost:8000  
Frontend будет доступен на http://localhost:5173

## Стандарты кода

### Python (Backend)

**Форматирование:**
```bash
# Установите инструменты
pip install black isort flake8

# Форматирование кода
black app/
isort app/

# Линтинг
flake8 app/
```

**Правила:**
- Используйте type hints
- Docstrings для функций и классов
- Максимальная длина строки: 100 символов
- Следуйте PEP 8

**Пример:**
```python
from typing import List
from fastapi import Depends
from app.models.user import User

async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
) -> List[User]:
    """
    Get list of users with pagination.
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        db: Database session
        
    Returns:
        List of User objects
    """
    result = await db.execute(
        select(User).offset(skip).limit(limit)
    )
    return result.scalars().all()
```

### TypeScript (Frontend)

**Форматирование:**
```bash
# Линтинг
npm run lint

# Исправление проблем
npm run lint -- --fix
```

**Правила:**
- Всегда используйте TypeScript типы
- Functional components с hooks
- Избегайте `any` типа
- Используйте arrow functions

**Пример:**
```typescript
interface User {
  id: number
  username: string
  role: UserRole
}

const UserCard: React.FC<{ user: User }> = ({ user }) => {
  return (
    <div className="card">
      <h3>{user.username}</h3>
      <span>{user.role}</span>
    </div>
  )
}

export default UserCard
```

## Создание миграций базы данных

Если вы изменили модели SQLAlchemy:

```bash
cd backend

# Создайте миграцию с автогенерацией
alembic revision --autogenerate -m "Add new field to User model"

# Проверьте сгенерированный файл в alembic/versions/

# Примените миграцию
alembic upgrade head

# При необходимости откатите
alembic downgrade -1
```

## Тестирование

### Backend тесты (TODO)

```bash
cd backend

# Установите тестовые зависимости
pip install pytest pytest-asyncio httpx

# Запустите тесты
pytest

# С coverage
pytest --cov=app --cov-report=html
```

### Frontend тесты (TODO)

```bash
cd frontend

# Запустите тесты
npm test

# С coverage
npm test -- --coverage
```

## Коммиты

### Commit Messages

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

**Типы:**
- `feat`: Новая функция
- `fix`: Исправление бага
- `docs`: Изменения документации
- `style`: Форматирование, отступы (не влияет на код)
- `refactor`: Рефакторинг кода
- `test`: Добавление тестов
- `chore`: Обновление build tasks, package manager configs

**Примеры:**
```bash
feat(auth): add password reset functionality
fix(tests): correct test assignment validation
docs(readme): update installation instructions
style(frontend): format code with prettier
refactor(api): simplify user endpoints
test(auth): add login endpoint tests
chore(deps): update FastAPI to 0.104.1
```

## Pull Request Process

### 1. Убедитесь что ваш код работает

```bash
# Backend
cd backend
pytest  # когда будут тесты
black app/ && isort app/
flake8 app/

# Frontend
cd frontend
npm run lint
npm test  # когда будут тесты
npm run build
```

### 2. Обновите документацию

- Обновите README.md если нужно
- Добавьте docstrings для новых функций
- Обновите ARCHITECTURE.md для крупных изменений

### 3. Создайте Pull Request

```bash
# Отправьте изменения
git push origin feature/your-feature-name
```

Создайте PR на GitHub со следующей информацией:

**Заголовок**: Краткое описание (следуйте Conventional Commits)

**Описание**:
```markdown
## Что изменено
- Добавлена функция X
- Исправлен баг Y
- Улучшена производительность Z

## Почему
Объясните зачем нужны эти изменения

## Как протестировать
1. Шаги для проверки изменений
2. Ожидаемый результат

## Скриншоты (если применимо)
[Добавьте скриншоты UI изменений]

## Чеклист
- [ ] Код работает локально
- [ ] Тесты проходят
- [ ] Документация обновлена
- [ ] Следую стандартам кода
```

### 4. Code Review

- Ответьте на комментарии ревьюеров
- Внесите запрошенные изменения
- Push дополнительные коммиты в ту же ветку

### 5. Merge

После одобрения ваш PR будет смержен в main ветку.

## Структура проекта

### Добавление нового endpoint (Backend)

1. Создайте Pydantic схемы в `app/schemas/`
2. Добавьте endpoint в `app/api/v1/endpoints/`
3. Зарегистрируйте router в `app/api/v1/api.py`
4. Обновите документацию

### Добавление новой страницы (Frontend)

1. Создайте компонент страницы в `src/pages/`
2. Добавьте route в `src/App.tsx`
3. Создайте service функцию в `src/services/` если нужно
4. Добавьте типы в `src/types/index.ts`

### Добавление новой модели (Database)

1. Создайте модель в `app/models/`
2. Добавьте в `app/models/__init__.py`
3. Создайте Pydantic схемы в `app/schemas/`
4. Создайте миграцию: `alembic revision --autogenerate`
5. Примените миграцию: `alembic upgrade head`

## Области для контрибуций

### 🌟 Приоритетные фичи

- [ ] Загрузка изображений в вопросы
- [ ] Экспорт результатов (CSV, PDF)
- [ ] Email уведомления
- [ ] Расширенная аналитика
- [ ] Мобильная адаптация
- [ ] Dark mode
- [ ] Интернационализация (i18n)

### 🐛 Известные баги

- [ ] Таймер теста не сохраняется при перезагрузке страницы
- [ ] Validation ошибки не всегда отображаются корректно

### 📚 Документация

- [ ] API примеры для всех endpoints
- [ ] Видео tutorials
- [ ] Deployment гайды для различных платформ

### 🧪 Тестирование

- [ ] Unit тесты для backend
- [ ] Integration тесты для API
- [ ] E2E тесты для frontend
- [ ] Performance тесты

## Вопросы и поддержка

- **Вопросы по коду**: Создайте GitHub Issue с тегом `question`
- **Баг репорты**: Создайте GitHub Issue с тегом `bug`
- **Feature requests**: Создайте GitHub Issue с тегом `enhancement`

## Лицензия

Внося вклад в проект, вы соглашаетесь, что ваши изменения будут лицензированы под MIT License.

---

**Спасибо за ваш вклад в Testing Platform!** 🎉

