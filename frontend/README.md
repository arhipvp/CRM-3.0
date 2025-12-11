# Frontend (React + Vite + TypeScript)

## Обзор
Frontend — SPA на React 19 + Vite с TypeScript, основанной на проксировании `/api/v1` через Vite dev-сервер. Порядок модулей делится по API-клиенту, компонентам, контекстам, хукам и утилитам; комбинация Vitest + Testing Library покрывает UI и логические модули.

## Структурные блоки
- **`src/main.tsx`** монтирует приложение и оборачивает его в провайдеры (например, AuthContext, UI-провайдеры).
- **`src/App.tsx` / `src/AppContent.tsx`** управляют маршрутизацией, уровнем доступа и отображением глобальных стейтов (загрузка, ошибки).
- **`src/api.ts`** инициирует HTTP-клиент (fetch/axios) с обработкой токенов, refresh flow и логированием ошибок. Через него идут все запросы к backend (`/api/v1`).
- **`components/`** содержит визуальные блоки (карточки клиентов, списки сделок, фильтры, модальные окна, таблицы) — каждый компонент получает typed props и минимум глобального состояния.
- **`hooks/`** реализуют кастомные логики: `useAuth`, `useDebouncedValue`, `usePaginatedApi`, `useInteractions`. Они изолируют побочные эффекты, подписки на таймеры/WS и обрабатывают загрузку/ошибки.
- **`contexts/`** задают глобальные состояния/сервисы (auth, settings, notifications) и предоставляют методы обновления через `useContext`.
- **`utils/` и `types/`** хранят хелперы (formatters, validators, date utils) и central typed interfaces для API, компонентов и событий.
- **`public/`** содержит `index.html`, favicon, manifest, robots и другие статические ресурсы; `vite.config.ts` включает proxy `VITE_PROXY_TARGET`, алиасы и оптимизации.

## Переменные окружения
- `.env.example` задаёт `VITE_API_URL` (обычно `/api/v1`). В Docker используется `VITE_PROXY_TARGET=http://backend:8000`.
- При локальной разработке Vite проксирует `VITE_API_URL`, так что в коде можно обращаться по относительному пути. В production можно указывать полные URL.

## Установка и скрипты
```bash
cd frontend
npm install
npm run dev          # Vite dev-сервер на localhost:5173
npm run build        # TypeScript-компиляция и сборка production-бандла
npm run preview      # Проверка production-сборки локально
npm run lint         # ESLint по конфигурации `eslint.config.js`
npm run test         # Vitest с Testing Library и setupTests
```

## Тестирование и качество
- `npm run lint` проверяет правила ESLint + React hooks.
- `npm run test` запускает Vitest (настройка в `setupTests.ts`) и выполняет юнит-тесты в `frontend/__tests__/` и `src/__tests__/` (включая mock API и событие в DOM).
- `tsconfig.app.json`, `tsconfig.node.json` и `tsconfig.json` обеспечивают строгую типизацию и поддержку библиотеки React.

## Docker и CI
- `frontend/Dockerfile` собирает образ на Node 20, копирует `package.json`, `package-lock.json`, выполняет `npm install`, `npm run build` и запускает Vite (или serve) в контейнере.
- В `docker-compose.yml` сервис `frontend` монтирует `./frontend`, `node_modules`, читает `frontend/.env`, проксирует запросы к `backend`.

## Полезные точки входа
- `frontend/src/api.ts`: конфиг HTTP-клиента, обработка JWT, токенов refresh и общие CRUD-методы.
- `frontend/src/components/`: UI-компоненты, часто переиспользуются в разных страницах.
- `frontend/src/hooks/` и `frontend/src/contexts/`: управление auth/session, уведомлениями, фильтрами.
- `frontend/src/__tests__/` + `frontend/__tests__/`: примеры тестов, которые можно расширять при добавлении новых компонентов или логики.

## Ресурсы
- `frontend/README.md` (этот файл) описывает локальный workflow; `frontend_example/` — отдельная зона для прототипов.
- `AGENTS.md` подчёркивает работу с кодировкой, секретами и командной культурой.
