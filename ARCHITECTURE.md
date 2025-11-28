# Архитектура проекта Testing Platform

## Обзор

Testing Platform - это современная веб-платформа для создания и прохождения тестов, построенная на микросервисной архитектуре с разделением frontend и backend.

## Принципы проектирования

### 1. Separation of Concerns (Разделение ответственности)
- **Backend (FastAPI)**: API, бизнес-логика, аутентификация, база данных
- **Frontend (React)**: UI, пользовательский опыт, клиентское состояние
- **Database (PostgreSQL)**: Хранение данных
- **Cache (Redis)**: Кеширование и сессии

### 2. RESTful API
Все взаимодействие между frontend и backend происходит через RESTful API:
- Чистые endpoint'ы с предсказуемыми URLs
- Правильное использование HTTP методов (GET, POST, PATCH, DELETE)
- Структурированные JSON ответы
- Правильные HTTP статус коды

### 3. Role-Based Access Control (RBAC)
Система ролей с различными уровнями доступа:
- **Admin**: Полный контроль над системой
- **Teacher**: Управление тестами и просмотр результатов
- **Student**: Прохождение тестов и просмотр своих результатов
- **Parent**: Просмотр результатов детей

## Backend Architecture

### Структура слоев

```
┌─────────────────────────────────────┐
│         API Endpoints (routes)      │  ← HTTP requests/responses
├─────────────────────────────────────┤
│      Business Logic (services)      │  ← Валидация, обработка
├─────────────────────────────────────┤
│      Data Access (repositories)     │  ← SQLAlchemy queries
├─────────────────────────────────────┤
│         Models (SQLAlchemy)         │  ← ORM модели
├─────────────────────────────────────┤
│         Database (PostgreSQL)       │  ← Данные
└─────────────────────────────────────┘
```

### Ключевые компоненты

#### 1. Models (app/models/)
SQLAlchemy модели для всех сущностей:
- `User`: Пользователи всех ролей
- `Test`: Тесты с настройками
- `Question`: Вопросы с разными типами
- `QuestionOption`: Варианты ответов
- `TestResult`: Результаты прохождения
- `Answer`: Ответы студентов

**Связи:**
- One-to-Many: User → Tests (создатель)
- One-to-Many: Test → Questions
- One-to-Many: Question → Options
- Many-to-Many: Test ↔ Students (через TestAssignment)
- Many-to-Many: Parent ↔ Children (через ParentChild)

#### 2. Schemas (app/schemas/)
Pydantic модели для валидации:
- Request schemas (Create, Update)
- Response schemas
- Автоматическая валидация входящих данных
- Сериализация исходящих данных

#### 3. API Endpoints (app/api/v1/endpoints/)
REST API endpoints с версионированием:
- `/api/v1/auth/*` - Аутентификация
- `/api/v1/users/*` - Управление пользователями
- `/api/v1/tests/*` - CRUD тестов
- `/api/v1/results/*` - Результаты тестов

#### 4. Dependencies (app/api/dependencies.py)
Переиспользуемые зависимости:
- `get_current_user`: JWT аутентификация
- `RoleChecker`: Проверка ролей
- `get_db`: Database session

#### 5. Security (app/core/security.py)
- JWT токены (access + refresh)
- Bcrypt хеширование паролей
- Защита от CSRF, XSS

## Frontend Architecture

### Структура компонентов

```
┌─────────────────────────────────────┐
│            Pages (роуты)            │  ← Страницы приложения
├─────────────────────────────────────┤
│       Components (переиспольз.)     │  ← UI компоненты
├─────────────────────────────────────┤
│    Services (API клиенты)           │  ← HTTP запросы
├─────────────────────────────────────┤
│    Store (Zustand)                  │  ← Глобальное состояние
└─────────────────────────────────────┘
```

### Ключевые концепции

#### 1. State Management
**Zustand** для глобального состояния:
- `authStore`: Текущий пользователь и аутентификация
- Простой API, минимальный boilerplate
- Персистентность в localStorage

**React Query** для server state:
- Кеширование API ответов
- Автоматическая ре-валидация
- Оптимистичные обновления
- Loading и error states

#### 2. Routing
React Router v6 с защищенными роутами:
```typescript
<ProtectedRoute allowedRoles={[UserRole.TEACHER]}>
  <TeacherTestsPage />
</ProtectedRoute>
```

#### 3. API Client (services/)
Axios instance с перехватчиками:
- Автоматическое добавление JWT токенов
- Обработка 401 ошибок
- Типизация TypeScript

#### 4. Form Management
React Hook Form для всех форм:
- Минимальные ре-рендеры
- Встроенная валидация
- TypeScript типизация

## Database Schema

### Основные таблицы

```sql
users
├── id (PK)
├── email (unique)
├── username (unique)
├── hashed_password
├── role (enum)
└── ...

tests
├── id (PK)
├── creator_id (FK → users)
├── title
├── settings (duration, passing_score, etc.)
└── ...

questions
├── id (PK)
├── test_id (FK → tests)
├── question_type (enum)
├── points
└── ...

test_results
├── id (PK)
├── test_id (FK → tests)
├── student_id (FK → users)
├── score
└── ...
```

### Индексы
Оптимизация запросов через индексы:
- Unique индексы на email, username
- Foreign key индексы
- Композитные индексы для частых запросов

## Security Architecture

### Authentication Flow

```
1. User → POST /login (username, password)
2. Backend verifies credentials
3. Backend generates JWT tokens
4. Frontend stores tokens
5. Frontend includes token in all requests
6. Backend validates token via middleware
```

### Authorization
Role-based проверки на уровне endpoints:
```python
@router.get("/tests/")
async def get_tests(
    current_user: User = Depends(require_teacher)
):
    # Only teachers and admins can access
```

## Data Flow

### Создание теста (Teacher)
```
Frontend                Backend                 Database
   │                       │                       │
   ├──POST /tests/────────>│                       │
   │   {test_data}         │                       │
   │                       ├──Validate token───────>│
   │                       ├──Check role (teacher)─>│
   │                       ├──Validate data─────────>│
   │                       ├──INSERT INTO tests────>│
   │                       ├──INSERT questions─────>│
   │<────{test_created}────┤                       │
   │                       │                       │
```

### Прохождение теста (Student)
```
Frontend                Backend                 Database
   │                       │                       │
   ├──POST /results/start─>│                       │
   │<────{started_at}──────┤                       │
   │                       │                       │
   │ (Student answers)     │                       │
   │                       │                       │
   ├──POST /results/submit>│                       │
   │   {answers}           │                       │
   │                       ├──Calculate score──────>│
   │                       ├──INSERT result────────>│
   │                       ├──INSERT answers───────>│
   │<────{result}──────────┤                       │
   │                       │                       │
```

## Scalability Considerations

### Horizontal Scaling
- Stateless backend (все в JWT)
- Database connection pooling
- Redis для shared state

### Performance
- Database индексы
- React Query кеширование
- Lazy loading компонентов
- Pagination на больших списках

### Monitoring
- Health check endpoints
- Structured logging
- Error tracking готовность

## Development Workflow

### Local Development
```bash
# Backend
cd backend && uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev
```

### Docker Development
```bash
docker-compose up -d
```

### Migrations
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Testing Strategy

### Backend Testing (будущее)
- Unit tests для бизнес-логики
- Integration tests для API
- pytest + pytest-asyncio

### Frontend Testing (будущее)
- Component tests (React Testing Library)
- E2E tests (Playwright)
- Jest для unit tests

## Deployment

### Production Checklist
- [ ] Изменить SECRET_KEY
- [ ] Настроить PostgreSQL пароли
- [ ] Включить HTTPS
- [ ] Настроить CORS
- [ ] Database backups
- [ ] Monitoring и logging
- [ ] Rate limiting
- [ ] CDN для статики

### CI/CD Pipeline (рекомендуемое)
```
1. Git push
2. Run tests
3. Build Docker images
4. Push to registry
5. Deploy to production
6. Run migrations
7. Health checks
```

## Future Improvements

### Короткосрочные
- [ ] Загрузка изображений в вопросы
- [ ] Экспорт результатов в CSV/PDF
- [ ] Email уведомления
- [ ] Улучшенная аналитика

### Долгосрочные
- [ ] Real-time обновления (WebSockets)
- [ ] Мобильные приложения
- [ ] AI-powered генерация вопросов
- [ ] Интеграции с LMS
- [ ] Видео в вопросах

## Заключение

Архитектура Testing Platform построена с учетом:
- **Масштабируемости**: Легко добавлять новые функции
- **Безопасности**: JWT, RBAC, валидация
- **Производительности**: Оптимизированные запросы, кеширование
- **Поддерживаемости**: Чистый код, типизация, документация
- **Developer Experience**: Современный стек, хорошие инструменты

