# Quality rails

## Backend
- format: `python -m black backend`
- format check: `python -m black --check backend`
- import sort: `python -m isort backend`
- import check: `python -m isort --check-only backend`
- lint: `python -m ruff check backend`

## Frontend
- lint: `cd frontend && npm run lint`
- format: `cd frontend && npm run format`
- format check: `cd frontend && npm run format:check`
- typecheck: `cd frontend && npx tsc --noEmit`

## Pre-commit
- install: `python -m pip install pre-commit`
- enable hooks: `pre-commit install`
- run on demand: `pre-commit run --all-files`
