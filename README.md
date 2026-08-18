# Library Management System with Book Recommendations

A full-stack university library management web app with strict department isolation and an intelligent book recommendation engine. Students browse and borrow books within their department, librarians manage catalog imports and approvals for their assigned department, and admins oversee the entire system.

---

## Architecture

```
                          Browser Client
                                │
                    Frontend / Nginx (:80)
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
               /api/                           │
                 │                             │
                 ▼                             │
            Django API                         │
              :8000                            │
                 │                             │
                 ▼                             │
            PostgreSQL                         │
               :5432                           │
                 │                             │
                 └─────────────────────────────┘
```

| Service | Technology | Role |
|---|---|---|
| **frontend** | React 19 + Vite + Nginx Alpine | Serves production SPA assets and reverse-proxies `/api/` to backend |
| **backend** | Django 6.0.1 + DRF 3.16.1 + Gunicorn | Handles REST APIs, department authorization, ML recommendation engine |
| **db** | PostgreSQL 16 Alpine | Relational database with automated health checks |

---

## Quick Start (One-Command Docker Setup)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (20.10+)
- [Docker Compose](https://docs.docker.com/compose/) (v2+)

### 1. Clone & Configure
```bash
git clone <repository_url>
cd Recommondation_system
cp .env.example .env
```
*(Optional: edit `.env` if you want to set custom passwords, ports, or Google OAuth keys)*

### 2. Start Application
```bash
docker compose up --build -d
```
The system will automatically:
1. Initialize the PostgreSQL container and verify database health.
2. Run all database migrations.
3. Collect static files into WhiteNoise.
4. Build the React frontend into static assets.
5. Start Gunicorn and Nginx.

### 3. Access Application
- **Web Application**: `http://localhost` (or `http://localhost:8080` if port 80 is customized via `FRONTEND_PORT`)
- **Backend Health Check**: `http://localhost/api/health/`
- **Django Admin Panel**: `http://localhost/admin/`

---

## Initial Super Admin Setup

Create the initial superuser:
```bash
docker compose exec backend python manage.py createsuperuser
```
Log in at `http://localhost/admin/` to create Departments and assign Department Librarians.

---

## Optional Demo Data

To populate sample departments, librarian, and demo students:
```bash
# Seed initial book catalog (development only)
docker compose exec backend python manage.py import_books

# Seed demo users, borrows, and interactions
docker compose exec backend python manage.py seed_demo
```

**Demo Credentials**:
| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Librarian (CS) | `librarian_cs` | `test1234` |
| Student | `aarav_sharma` | `test1234` |
| Student | `priya_patil` | `test1234` |

---

## Common Docker Commands

| Action | Command |
|---|---|
| **Start containers** | `docker compose up -d` |
| **Rebuild & start** | `docker compose up --build -d` |
| **View logs** | `docker compose logs -f` |
| **View backend logs** | `docker compose logs -f backend` |
| **Run tests** | `docker compose exec backend python manage.py test` |
| **Django check** | `docker compose exec backend python manage.py check` |
| **Django shell** | `docker compose exec backend python manage.py shell` |
| **Stop containers** | `docker compose down` |
| **Reset database** *(Destructive)* | `docker compose down -v` |

---

## Documentation

| Document | Purpose |
|---|---|
| [PROJECT_RULES.md](./PROJECT_RULES.md) | Architectural constraints and department security rules |
| [database/ER_DIAGRAM.md](./database/ER_DIAGRAM.md) | Database schema, foreign keys, and model relationships |
| [backend/README.md](./backend/README.md) | Backend details and REST API endpoint reference |
| [frontend/README.md](./frontend/README.md) | Frontend component hierarchy and routing |
