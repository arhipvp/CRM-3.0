# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CRM 3.0** is a deal-centric Customer Relationship Management system built as a monorepo with Django REST backend + React frontend. The system is designed around managing insurance/finance deals with associated clients, tasks, documents, payments, and policies.

Core concept: Everything revolves around **Deal** as the central entity. Clients have deals, deals have tasks/documents/payments/policies, and payments have income/expense records.

## Architecture Overview

### Technology Stack
- **Backend**: Django 5.1 + DRF + PostgreSQL 16 + Gunicorn
- **Frontend**: React 19 + Vite + TypeScript
- **Deployment**: Docker Compose (orchestrates PostgreSQL + Django)
- **Authentication**: JWT (djangorestframework-simplejwt)

### Directory Structure
```
backend/
├── config/                    # Django settings, API routing
├── apps/                      # 9 modular Django apps
│   ├── common/               # SoftDeleteModel base class
│   ├── clients/, deals/, tasks/, documents/
│   ├── finances/, notes/, notifications/, policies/
│   └── migrations/           # Database schema
├── manage.py, requirements.txt, Dockerfile, entrypoint.sh

frontend/
├── src/
│   ├── pages/               # 9 page views (Dashboard, Clients, Deals, etc.)
│   ├── components/          # Reusable UI (Layout, Modals, StatCard)
│   ├── lib/api.ts           # HTTP client layer
│   ├── types/index.ts       # TypeScript definitions
│   └── App.tsx              # Main router/state
├── Dockerfile, package.json, vite.config.ts

docker-compose.yml            # Orchestrates db + backend + (optional) frontend
QUICKSTART.md                  # 3-command setup guide
DOCKER_SETUP.md                # Full Docker reference
```

## Data Model

### Core Principle: Soft Delete Pattern
All models inherit from `SoftDeleteModel` (apps/common/models.py):
- UUID primary key
- Auto timestamps: `created_at`, `updated_at`
- Soft delete flag: `deleted_at` (NULL = active)
- Custom manager: `.alive()`, `.dead()`, `.with_deleted()`
- Methods: `.delete()` (soft), `.restore()`, `.hard_delete()`

### Entity Relationships
```
CLIENT (name, phone, birth_date)
  └─ (1:N) DEAL [PROTECT] ← Central entity (title, seller, executor, status, stage_name, etc.)
      ├─ (1:N) TASK [CASCADE] - title, status, priority, due_at, checklist
      ├─ (1:N) DOCUMENT [CASCADE] - file upload, doc_type, owner
      ├─ (1:N) NOTE [CASCADE] - body, author_name, deal_id
      ├─ (1:N) POLICY [CASCADE] - number (unique), insurance_type, vin, amount, start_date/end_date
      └─ (1:N) PAYMENT [CASCADE] - amount, status, scheduled_date, actual_date
          ├─ (1:N) INCOME [CASCADE] - amount, received_at, source
          └─ (1:N) EXPENSE [CASCADE] - amount, expense_type, expense_date

USER (Django built-in auth.User)
  ├─ (1:N) sold_deals (FK as Deal.seller)
  ├─ (1:N) executed_deals (FK as Deal.executor)
  └─ (1:N) notifications - Notification.user_id
```

### Key Field Patterns
- **Amounts**: Always DecimalField(12, 2) in RUB (no multi-currency support)
- **Dates**: DateField or DateTimeField depending on precision needed
- **Status**: CharField with choices (TextChoices enum)
- **Flexible Data**: JSONField for tags, checklist, payload
- **File Upload**: FileField with automatic path: documents/{deal_id}/{filename}

## API Architecture

### Endpoint Pattern
All endpoints under `/api/v1/` with ModelViewSet pattern:
```
GET/POST    /clients/, /deals/, /tasks/, /documents/, /payments/, /notes/, /notifications/
GET/PATCH   /{resource}/{id}/
DELETE      /{resource}/{id}/       # Soft delete
POST        /documents/recognize/   # Special: AI document recognition
GET         /finances/summary/      # Special: aggregated financial view
GET         /health/                # Health check
```

### Request/Response
- JSON bodies with nested serializers
- List endpoints return all records (no pagination yet)
- Errors returned as text or validation messages
- Document uploads via FormData (multipart)
- No authentication required currently (AllowAny permissions)

### Frontend API Client (lib/api.ts)
Provides TypeScript-typed wrapper around fetch:
```typescript
api.listClients()
api.createClient(payload)
api.listDeals()
api.createDeal(payload)
api.listTasks()
api.listDocuments()
api.listPayments()
api.getFinanceSummary()
api.listNotes(params)
api.createNote(payload)
api.recognizeDocuments(dealId, files)
```

Smart URL resolution: Reads VITE_API_URL env var, falls back to `http://{hostname}:8000/api/v1`

## Common Development Tasks

### Setup & Running

**Quick Start (3 commands)**
```bash
cd "C:\Dev\CRM 3.0"
docker-compose up -d
# Wait ~30 seconds, then http://localhost:8000
```

**Backend Only (Local Development)**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

**Frontend Only (Local Development)**
```bash
cd frontend
npm install
cp .env.example .env  # Set VITE_API_URL if needed
npm run dev
```

### Database Operations

```bash
# Apply migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Access Django shell
docker-compose exec backend python manage.py shell

# Connect to PostgreSQL
docker-compose exec db psql -U crm3 -d crm3
```

### Container Management

```bash
# View all services
docker-compose ps

# Watch logs
docker-compose logs -f backend
docker-compose logs -f db

# Rebuild image (after requirements.txt change)
docker-compose build --no-cache backend

# Stop services
docker-compose stop

# Completely remove (lose data!)
docker-compose down -v
```

### Creating Models & Endpoints

**1. Define Model** (apps/{app}/models.py)
```python
from apps.common.models import SoftDeleteModel

class YourModel(SoftDeleteModel):
    """Description"""
    title = models.CharField(max_length=255)
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='your_models')
    # Add fields, use CASCADE/PROTECT for deletion behavior
```

**2. Create Serializer** (apps/{app}/serializers.py)
```python
from rest_framework import serializers
from .models import YourModel

class YourModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = YourModel
        fields = ['id', 'title', 'deal', 'created_at', 'updated_at']
```

**3. Create ViewSet** (apps/{app}/views.py)
```python
from rest_framework.viewsets import ModelViewSet
from .models import YourModel
from .serializers import YourModelSerializer

class YourModelViewSet(ModelViewSet):
    queryset = YourModel.objects.all()
    serializer_class = YourModelSerializer
```

**4. Register in API** (config/api_router.py)
```python
from apps.yourapp.views import YourModelViewSet
router.register(r'yourmodels', YourModelViewSet)
```

**5. Register in Admin** (apps/{app}/admin.py)
```python
from django.contrib import admin
from .models import YourModel

admin.site.register(YourModel)
```

**6. Create Migration**
```bash
docker-compose exec backend python manage.py makemigrations
docker-compose exec backend python manage.py migrate
```

### Frontend Pages

Each page is a React component in `frontend/src/pages/`:
- Load data from API client
- Render tables/cards
- Handle modals for create/edit
- Manage local state with useState
- Error handling with try-catch

Example pattern:
```typescript
function MyPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listItems()
      .then(setItems)
      .catch(e => setError(e.message));
  }, []);

  return (
    <Layout>
      {error && <p className="error">{error}</p>}
      <table>
        {items.map(item => <tr key={item.id}>...</tr>)}
      </table>
    </Layout>
  );
}
```

### Modifying Environment Configuration

**Backend** (.env)
```
DEBUG=False (or True for dev)
DJANGO_SECRET_KEY=<secure-random-string>
DJANGO_DB_PASSWORD=<change-in-production>
ALLOWED_HOSTS=localhost,127.0.0.1,example.com
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

**Frontend** (.env)
```
VITE_API_URL=http://localhost:8000/api/v1
```

## Backend Implementation Details

### Django Configuration (config/settings.py)
- Installed apps: DRF, JWT auth, CORS, 9 custom apps
- Database: PostgreSQL with environment-based config
- REST Framework defaults: JSON parsing, pagination disabled, AllowAny permissions (needs override)
- JWT: 15-min access tokens, 7-day refresh tokens
- CORS: All origins allowed in dev (restrict in production)
- File storage: Local filesystem (media/ directory)

### ViewSet Patterns

**ModelViewSet** provides automatic CRUD:
```python
class DealViewSet(ModelViewSet):
    queryset = Deal.objects.all()  # Automatically filters .alive()
    serializer_class = DealSerializer
    # GET /deals/ → list()
    # POST /deals/ → create()
    # GET /deals/{id}/ → retrieve()
    # PATCH /deals/{id}/ → partial_update()
    # DELETE /deals/{id}/ → destroy() (soft delete via SoftDeleteModel)
```

**Custom Actions**:
```python
from rest_framework.decorators import action
from rest_framework.response import Response

@action(detail=False, methods=['get'])
def my_custom_endpoint(self, request):
    return Response({'data': 'value'})
# → GET /deals/my_custom_endpoint/
```

### Serializer Patterns

**Nested Relationships**:
```python
class DealSerializer(serializers.ModelSerializer):
    client = ClientSerializer(read_only=True)  # Nested
    seller = UserSerializer(read_only=True)

    class Meta:
        model = Deal
        fields = ['id', 'title', 'client', 'seller', ...]
```

**Write-Only for Relationships**:
```python
class TaskCreateSerializer(serializers.ModelSerializer):
    deal_id = serializers.IntegerField(write_only=True)

    def create(self, validated_data):
        # Handle nested creation
```

### Soft Delete Usage

```python
# Soft delete (reversible)
deal.delete()  # Sets deleted_at = now()

# Recover deleted
deal.restore()  # Sets deleted_at = NULL

# Permanent deletion
deal.hard_delete()  # Actually removes from DB

# Query active records (default)
Deal.objects.all()  # Automatically filtered: deleted_at IS NULL

# Include deleted records
Deal.objects.with_deleted().all()

# Only deleted records
Deal.objects.dead().all()
```

## Frontend Implementation Details

### Component Patterns

**Page Components** - Full page views with data loading:
```typescript
function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    api.listClients()
      .then(data => setClients(data))
      .catch(err => console.error(err));
  }, []);

  return <Layout>{/* render clients */}</Layout>;
}
```

**Modal Components** - Reusable dialogs:
```typescript
interface AddClientModalProps {
  onClose: () => void;
  onCreated?: (client: Client) => void;
}

function AddClientModal({ onClose, onCreated }: AddClientModalProps) {
  const handleSubmit = async (e) => {
    try {
      const client = await api.createClient(formData);
      onCreated?.(client);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  return <Modal open={true} onClose={onClose}>{/* form */}</Modal>;
}
```

**Layout Components** - Structural wrappers:
```typescript
function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <MainLayout />
      <div className="content">{children}</div>
    </div>
  );
}
```

### State Management
- **Local component state**: `useState` for component-level data
- **Effect hooks**: `useEffect` for data loading and side effects
- **Callbacks**: `useCallback` for memoized functions
- **Error handling**: Try-catch in async functions, state-based error display

### Styling
- **CSS**: Vanilla CSS (no Tailwind, Material-UI, etc.)
- **Color System**: CSS variables for semantic colors
- **Layout**: Flexbox/Grid with custom classes
- **Responsive**: Mobile-first approach (media queries)

### Type Safety (TypeScript)
All data from API has TypeScript types in `types/index.ts`:
```typescript
interface Deal {
  id: string;
  title: string;
  client_id: string;
  seller_id?: string;
  status: 'open' | 'won' | 'lost' | 'on_hold';
  created_at: string;
  updated_at: string;
}
```

## Docker & Deployment

### Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| db | postgres:16-alpine | 5432 | PostgreSQL database |
| backend | python:3.12-slim | 8000 | Django + Gunicorn |
| frontend | (optional) node:22-alpine | 5173 | Vite dev server |

### Multi-Stage Dockerfile (Backend)
1. **Builder stage**: Installs dependencies (gcc, PostgreSQL client)
2. **Final stage**: Minimal image, copies built artifacts
3. **Entrypoint**: Waits for DB → runs migrations → creates superuser → starts Gunicorn

### Docker Compose Features
- **Health checks**: Waits for DB before starting backend
- **Volume mounts**: Live code editing (./backend:/app)
- **Network**: All services on crm_network bridge
- **Persistence**: postgres_data volume survives container restart
- **Environment**: Variables from .env files

### Production Deployment Checklist
- [ ] Set DEBUG=False
- [ ] Change DJANGO_SECRET_KEY to random value
- [ ] Change database passwords
- [ ] Set ALLOWED_HOSTS to actual domain
- [ ] Update CORS_ALLOWED_ORIGINS
- [ ] Use managed PostgreSQL database (not containerized)
- [ ] Set up SSL/TLS with reverse proxy (Nginx)
- [ ] Enable authentication/authorization
- [ ] Set up monitoring and logging
- [ ] Configure backups

## Code Style & Conventions

### Backend (Django/Python)
- **PEP 8 style**: 4-space indentation, snake_case for functions/variables
- **Models**: Always use SoftDeleteModel base, add help_text to fields
- **Serializers**: Use ModelSerializer with explicit fields list
- **Views**: Use ModelViewSet for CRUD, add custom actions for special endpoints
- **File uploads**: Store in MEDIA_ROOT with organized subdirectories

### Frontend (React/TypeScript)
- **Components**: PascalCase file/function names, functional components with hooks
- **Props**: Use TypeScript interfaces for type safety
- **Styling**: CSS class names are kebab-case
- **Async**: Use async/await with error handling
- **State**: Prefer local state, lift to parent only when needed

## Testing (Not Yet Implemented)

Expected patterns when testing is added:
- **Backend**: Django TestCase for models, APITestCase for views
- **Frontend**: React Testing Library for components

Example:
```python
from django.test import TestCase
from apps.deals.models import Deal

class DealTestCase(TestCase):
    def test_create_deal(self):
        deal = Deal.objects.create(title="Test")
        self.assertEqual(deal.title, "Test")
```

## Debugging Tips

### Backend
```bash
# See actual SQL queries
docker-compose exec backend python manage.py shell
>>> from django.db import connection
>>> connection.queries

# Add print statements to views (shown in docker logs)
docker-compose logs -f backend

# Check which migrations are applied
docker-compose exec backend python manage.py showmigrations

# Test model relationships
docker-compose exec backend python manage.py shell
>>> from apps.deals.models import Deal
>>> d = Deal.objects.first()
>>> print(d.tasks.all())  # Related manager
```

### Frontend
- Browser DevTools Console (Network tab for API calls)
- `console.log()` statements (visible in npm dev output)
- React DevTools browser extension for component inspection
- Check .env file is properly set (VITE_API_URL)

### Docker
```bash
# Check container logs for startup errors
docker-compose logs --tail=50 backend

# Verify services are healthy
docker-compose ps

# Inspect running container
docker exec crm3-backend env  # Show env vars

# Check network connectivity
docker-compose exec backend python -c "import psycopg; print('DB connected')"
```

## Recent Model Changes (Important)

### Deal Simplification
- Removed Pipeline/DealStage hierarchy
- Now uses simple `stage_name` CharField instead
- Less flexible but simpler to implement
- Allows arbitrary stage names

### Client Simplification
- Removed many fields (legal_name, tax_id, industry, addresses, etc.)
- Now only has: name, phone, birth_date
- Contact model exists but rarely used
- Future: May expand again based on requirements

### Soft Delete Implementation (New)
- All models now inherit SoftDeleteModel
- Provides `.alive()`, `.dead()`, `.with_deleted()` queryset methods
- `.delete()` is soft (reversible), use `.hard_delete()` for permanent removal
- Automatically filters deleted records in queries

### Currency Handling
- All amounts stored as DecimalField in Russian Rubles (RUB)
- No multi-currency support
- help_text notes "в рублях" for clarity

## Known Limitations & TODOs

1. **No real authentication** - All endpoints are AllowAny (security risk!)
2. **No search/filtering** - Only basic list endpoints
3. **No pagination** - Returns all records (performance issue at scale)
4. **No caching** - Every request hits database
5. **No background tasks** - All operations synchronous (Celery not configured)
6. **Frontend state** - Only local useState, no Redux/Context
7. **Document recognition** - Endpoint exists but no implementation
8. **Telegram integration** - Mentioned in spec but not implemented
9. **Audit trail** - No created_by/updated_by fields yet
10. **Search/export** - No CSV export or advanced search

## File Organization Principles

### Backend Structure (by responsibility)
- **models.py**: Data structure definitions
- **serializers.py**: REST request/response transformation
- **views.py**: HTTP request handling and business logic
- **admin.py**: Django admin interface registration
- **apps.py**: App configuration

### Frontend Structure (by feature)
- **pages/**: Full-page components (one per route)
- **components/**: Reusable UI components
- **lib/**: Utility functions (API client)
- **types/**: TypeScript definitions
- **css/**: Stylesheets (global + per-component)

## Integration Points

### Frontend ↔ Backend
- REST API at `/api/v1/`
- JSON request/response bodies
- FormData for file uploads
- Error messages as plain text or validation dicts

### Backend ↔ Database
- Django ORM (Models) for type-safe queries
- Migrations manage schema changes
- Transactions at view level (decorator: @transaction.atomic)
- Soft delete filtering at QuerySet level

### Docker ↔ Services
- Port mapping: 8000 (backend), 5432 (db), 5173 (frontend optional)
- Volume mounts for persistent data and live code editing
- Network isolation via crm_network bridge
- Health checks prevent service cross-dependencies

## When Adding New Features

1. **Define the data model** (apps/{app}/models.py)
   - Inherit from SoftDeleteModel
   - Use CASCADE/PROTECT for deletion rules
   - Add help_text to all fields

2. **Create serializers** (apps/{app}/serializers.py)
   - Use ModelSerializer with explicit fields
   - Handle nested relationships appropriately

3. **Implement views** (apps/{app}/views.py)
   - Use ModelViewSet for standard CRUD
   - Add custom actions for special endpoints (@action decorator)

4. **Register endpoints** (config/api_router.py)
   - Add router.register() call

5. **Update admin** (apps/{app}/admin.py)
   - Register model for Django admin access

6. **Create migrations**
   - `makemigrations` then `migrate`

7. **Frontend components** (frontend/src/pages or components)
   - Use api client from lib/api.ts
   - Render tables/cards/forms with TypeScript types
   - Handle errors and loading states

8. **Test in Docker**
   - `docker-compose build --no-cache`
   - `docker-compose up -d`
   - Verify endpoint works

## Questions to Ask Yourself

When working on this codebase:

1. **Does this change fit the Deal-centric model?** - Deal is the central entity, everything else should relate to it.
2. **Should this be soft-deleted or hard-deleted?** - Prefer soft delete for audit trail.
3. **Is there a permission/authentication implication?** - Currently AllowAny, but keep in mind for future.
4. **What happens when the parent Deal is deleted?** - Should be CASCADE for child records.
5. **Do I need to update the frontend for this backend change?** - Check if new fields need UI.
6. **Should this be in .env?** - If it's environment-dependent, yes.
7. **Will this scale?** - No pagination/caching yet, so watch out for performance with large datasets.

## Reference Docs

- [Django Docs](https://docs.djangoproject.com/)
- [DRF Docs](https://www.django-rest-framework.org/)
- [React Docs](https://react.dev/)
- [TypeScript Docs](https://www.typescriptlang.org/)
- [Docker Docs](https://docs.docker.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

## Internal Documentation

- **backend/.claude/DATA_MODEL.md** - Detailed model specifications
- **backend/.claude/QUICK_REFERENCE.md** - Code examples for all operations
- **QUICKSTART.md** - 3-command setup guide
- **DOCKER_SETUP.md** - Complete Docker reference
- **crm3-specification.md** - Original project specification
