# Frontend (React + Vite)

## Установка
```bash
cd frontend
npm install
npm run dev
```

## Переменные окружения
Создайте `.env` из шаблона:
```
VITE_API_URL=http://localhost:8000/api/v1
```

## Структура
- `src/components` — базовый Layout и карточки статистики.
- `src/pages` — заглушки экранов (дашборд, клиенты, сделки, задачи, документы, настройки).
- `src/lib/api.ts` — thin-слой для работы с REST API.
