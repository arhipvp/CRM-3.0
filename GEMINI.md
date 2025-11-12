# GEMINI.md

## Project Overview

This is a monorepo for a CRM application with a Django backend and a React frontend.

**Backend:**
- Django
- Django Rest Framework
- Simple JWT for authentication
- PostgreSQL database
- Gunicorn for production server
- Pytest for testing

**Frontend:**
- React
- Vite
- TypeScript
- Tailwind CSS

## Building and Running

### Backend

1.  `cd backend`
2.  `python -m venv .venv && .venv\Scripts\activate`
3.  `pip install -r requirements.txt`
4.  `cp .env.example .env`
5.  `python manage.py migrate`
6.  `python manage.py runserver`

API is available at `http://localhost:8000/api/v1/`, and a health-check at `/health/`.

### Frontend

1.  `cd frontend`
2.  `npm install`
3.  `cp .env.example .env`
4.  `npm run dev`

The application is available at `http://localhost:5173/` and interacts with the backend via the `VITE_API_URL` environment variable.

### Docker Compose

1.  Ensure that `backend/.env` contains a free `DJANGO_DB_PORT` (default is 5435).
2.  Run `docker compose up --build`.

Services:
- Postgres: port `5435`.
- Backend: http://localhost:8000/
- Frontend (Vite): http://localhost:5173/

## Development Conventions

### Backend

- The backend follows standard Django project structure.
- API endpoints are versioned under `/api/v1/`.
- Tests are written using `pytest` and `pytest-django`.

### Frontend

- The frontend is a modern React application built with Vite.
- It uses TypeScript for static typing.
- Styling is done with Tailwind CSS.
- Linting is configured with ESLint.
