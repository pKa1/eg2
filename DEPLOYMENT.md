## Продакшн-деплой EVROSHOLS

Инструкция описывает полный цикл развёртывания и обновления проекта на сервере (Ubuntu 22.04+, Docker Compose 1.29). Все команды выполняются под `root`.

---

### 1. Установка зависимостей
```bash
apt update && apt upgrade -y
apt install -y git docker.io docker-compose nginx certbot python3-certbot-nginx
systemctl enable --now docker
```

### 2. Клонирование и подготовка конфигов
```bash
cd /opt
git clone https://github.com/pKa1/eg2.git
cd eg2
cp env.example .env
```

Заполните `.env`:

- `POSTGRES_*` — пароли к БД
- `SECRET_KEY` — минимум 32 символа
- `VITE_API_URL=https://eg-online72.ru` (или другой боевой домен)
- при необходимости отредактируйте `BACKEND_CORS_ORIGINS` (через запятую)

> Файл `frontend/env.production.template` содержит production‑значение и автоматически копируется в `.env.production` при сборке Docker‑образа. Если боевой домен меняется — отредактируйте template-файл в репозитории и закоммитьте изменения.

### 3. Первый запуск контейнеров
```bash
# подтянуть базовые образы
docker-compose -f docker-compose.prod.yml pull

# билд + запуск
docker-compose -f docker-compose.prod.yml up -d

# применить миграции (при первом запуске)
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### 4. Настройка nginx (reverse proxy)
```bash
cat >/etc/nginx/sites-available/eg-online72.ru <<'EOF'
server {
    listen 80;
    server_name eg-online72.ru;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/eg-online72.ru /etc/nginx/sites-enabled/eg-online72.ru
nginx -t && systemctl reload nginx
```

### 5. Включение HTTPS
```bash
certbot --nginx -d eg-online72.ru -m director@eg72.ru --agree-tos --redirect
```

### 6. Создание администратора
```bash
docker-compose -f docker-compose.prod.yml exec backend \
  python create_admin.py \
    --username superadmin \
    --password 'S3curePass!' \
    --email admin@eg-online72.ru \
    --full-name "Главный администратор"
```

---

## Обновление проекта

1. Обновить код:
   ```bash
   cd /opt/eg2
   git pull
   ```
2. Собрать и поднять контейнеры:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```
3. Прогнать миграции при необходимости:
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
   ```
4. Проверить статус:
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   docker-compose -f docker-compose.prod.yml logs -f backend
   ```

### Известный баг docker-compose 1.29
Иногда при добавлении портов/томов появляется `KeyError: 'ContainerConfig'`. Решение:
```bash
docker-compose -f docker-compose.prod.yml rm -sf <service>
docker-compose -f docker-compose.prod.yml up -d <service>
```

---

## Быстрая проверка после деплоя

- `curl -I https://eg-online72.ru` — фронтенд отдаёт 200
- `curl -I https://eg-online72.ru/api/v1/health` — backend отвечает `200 OK`
- `docker-compose -f docker-compose.prod.yml ps` — backend должен иметь порт `127.0.0.1:8000->8000/tcp`, frontend — `0.0.0.0:8080->80/tcp`

---

## Частые задачи

| Задача | Команда |
|---|---|
| Создать/обновить администратора | `docker-compose -f docker-compose.prod.yml exec backend python create_admin.py --username ... --force` |
| Применить миграции | `docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head` |
| Посмотреть логи backend | `docker-compose -f docker-compose.prod.yml logs -f backend` |
| Пересобрать только фронтенд | `docker-compose -f docker-compose.prod.yml build frontend && docker-compose -f docker-compose.prod.yml up -d frontend` |
| Пересобрать только backend | `docker-compose -f docker-compose.prod.yml build backend && docker-compose -f docker-compose.prod.yml up -d backend` |

---

## Что уже автоматизировано

- `frontend/.env.production` хранится в репозитории → не нужно создавать файл на сервере вручную.
- В `docker-compose.prod.yml` backend слушает `127.0.0.1:8000`, поэтому nginx всегда может пробросить API без дополнительных шагов.

При изменении домена достаточно обновить значения в `.env` и `frontend/.env.production`, закоммитить, затем выполнить «Обновление проекта».


