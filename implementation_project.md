# Library Management & Book Recommendation System
## Complete Implementation Guide, Architecture & Operations Runbook

---

## 1. Executive Summary & Architecture Specification

The **Library Management & Book Recommendation System** is a production-grade, 12-factor compliant university library platform designed for multi-department academic institutions. The system provides strict department-scoped catalog isolation, role-based workflows for Students, Librarians, and Super Admins, real-time machine learning book recommendations, atomic inventory tracking, in-app notifications, and enterprise-grade security.

### 1.1 Four-Tier Architecture Diagram

The production topology separates concerns across four distinct, containerized services connected via an internal Docker bridge network (`library_network`):

```
                                  Internet / End Users
                                            │
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │             Web Browser Client            │
                      │       (React 19 SPA / Vite Runtime)       │
                      └─────────────────────┬─────────────────────┘
                                            │ HTTP / WebSocket (Port 80/443)
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │         Reverse Proxy & Web Server        │
                      │          (Nginx Alpine Container)         │
                      │           [Service: frontend]             │
                      └──────────────┬────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │ Proxy /api/* & /admin/*         │ Static Assets / SPA Routes
                    ▼                                 ▼
      ┌───────────────────────────┐     ┌───────────────────────────┐
      │     WSGI Backend Server   │     │    Pre-Compiled Bundle    │
      │   (Django 6 + DRF +       │     │     (/usr/share/nginx/    │
      │    Gunicorn 23.0 Workers) │     │      html - React 19)     │
      │    [Service: backend]     │     └───────────────────────────┘
      └─────────────┬─────────────┘
                    │
        ┌───────────┴────────────────────────┐
        │ TCP (Port 5432)                    │ TCP (Port 6379)
        ▼                                    ▼
┌───────────────────────────┐        ┌───────────────────────────┐
│     Relational Database   │        │     In-Memory Data Store  │
│    (PostgreSQL 16 Alpine) │        │     (Redis 7 Alpine)      │
│     [Service: db]         │        │     [Service: redis]      │
│  - Persistent ACID store  │        │  - Dynamic Catalog Cache  │
│  - Row-level lock safety  │        │  - Cached DB Sessions     │
│  - Relational constraints │        │  - ML Matrix Cache        │
└───────────────────────────┘        └───────────────────────────┘
```

### 1.2 Core Subsystem Matrix

| Subsystem | Technologies | Key Responsibilities |
|---|---|---|
| **Frontend SPA** | React 19.2, Vite 7.3, React Router 7, Tailwind CSS 4, Framer Motion, Recharts | Interactive UI, dynamic category filtering, dwell-time analytics logging, real-time notifications, responsive borrow workflows. |
| **Backend REST API** | Django 6.0.1, Django REST Framework 3.16, Gunicorn 23.0 | Central business logic, department authorization barriers, serialization, atomic inventory locking, RESTful API endpoints. |
| **Authentication & Security** | SimpleJWT 5.5, Argon2, Brevo REST API, Google OAuth 2.0 | Stateless JWT access/refresh lifecycle, Argon2 memory-hard password hashing, 6-digit email OTP delivery via HTTPS port 443. |
| **ML Recommendation Engine** | scikit-learn 1.6, NumPy 2.4, Pandas 2.3 | Content-based TF-IDF cosine similarity, department-scoped collaborative filtering, dwell-time weighted hybrid ranker. |
| **Relational Database** | PostgreSQL 16 Alpine | Relational data persistence, foreign key cascades, unique constraints, and atomic row-level locking (`select_for_update`). |
| **Caching & Fast Session Layer** | Redis 7 Alpine, django-redis 5.4 | First-page catalog caching, dynamic category count aggregation, recommendation similarity caching, `cached_db` sessions. |

---

## 2. Prerequisites & Host Environment Requirements

### 2.1 Hardware Requirements

| Environment | CPU Cores | RAM | Disk Storage | Swap Recommendation |
|---|---|---|---|---|
| **Local Development** | 2+ Cores | 4 GB | 10 GB SSD | Optional |
| **Production Server** | 2 vCPUs | 2 GB minimum | 20+ GB SSD | **Crucial**: 2 GB Swap file required during Vite & ML builds |

### 2.2 Software Dependencies

* **Docker Option (Recommended)**:
  * Docker Engine `24.0.0` or newer
  * Docker Compose `v2.20.0` or newer
* **Native Development Option**:
  * Python `3.11`, `3.12`, or `3.13`
  * Node.js `20.x` or `22.x LTS` (with `npm 10+`)
  * PostgreSQL `16.x`
  * Redis `7.x`
  * Git `2.34+`

### 2.3 Port Planning & Host Conflicts

Default host bindings and override environment variables in `.env`:

| Service | Internal Port | Default Host Port | Override Variable | Troubleshooting Conflict |
|---|---|---|---|---|
| **Frontend / Nginx** | `80` | `80` | `FRONTEND_PORT` | Set `FRONTEND_PORT=8082` if host runs Apache/Nginx |
| **PostgreSQL Database**| `5432` | `5432` | `POSTGRES_PORT_HOST` | Set `POSTGRES_PORT_HOST=5435` if host has local PostgreSQL |
| **Redis Cache** | `6379` | `6379` | `REDIS_PORT_HOST` | Set `REDIS_PORT_HOST=6382` if host has local Redis |
| **Backend (Direct)** | `8000` | N/A (Proxied via Nginx) | N/A | Expose in docker-compose only if debugging directly |

---

## 3. Step-by-Step Setup Runbook

### Option A: Docker Compose Deployment (Recommended)

Docker Compose orchestrates all 4 services (`library_db`, `library_redis`, `library_backend`, `library_frontend`) with automatic network configuration, volume persistence, and dependency health checks.

#### Step 1: Clone the Repository
```bash
git clone https://github.com/siddharthghode/Recommondation_system.git
cd Recommondation_system
```

#### Step 2: Configure Environment Variables
Copy the template `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Generate a secure production secret key and assign it to `DJANGO_SECRET_KEY` in `.env`:
```bash
# Generate a cryptographically strong 50-character key
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Edit `.env` to configure your values:
```env
# Database Settings
POSTGRES_DB=library_db
POSTGRES_USER=library_user
POSTGRES_PASSWORD=StrongPass@123
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Redis Cache Settings
REDIS_URL=redis://redis:6379/1
REDIS_PORT_HOST=6379

# Django Security Settings
DEBUG=False
DJANGO_SECRET_KEY=YOUR_GENERATED_SECRET_KEY
DJANGO_ENV=production
ALLOWED_HOSTS=localhost,127.0.0.1,backend,frontend
CORS_ALLOWED_ORIGINS=http://localhost,http://localhost:80,http://127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost,http://localhost:80,http://127.0.0.1

# Frontend Port Configuration
FRONTEND_PORT=80

# Email Integration (Brevo HTTP API)
EMAIL_BACKEND=anymail.backends.brevo.EmailBackend
BREVO_API_KEY=xkeysib-your-brevo-v3-api-key
DEFAULT_FROM_EMAIL=your-verified-sender@example.com
```

#### Step 3: Build & Launch Containers
Build images and start containers in detached mode:
```bash
docker compose up --build -d
```

Verify that all four containers are up and healthy:
```bash
docker compose ps
```
*Expected status*: `library_db` (healthy), `library_redis` (healthy), `library_backend` (running), `library_frontend` (running).

#### Step 4: Populate Catalog and Seed Demo Data
The backend image pre-compiles static files at build time and automatically executes database migrations during boot (`MIGRATE_ON_BOOT=true`). Populate the catalog and seed demo users:

```bash
# 1. Import 6,810 books from CSV (use --clear if replacing existing catalog)
docker compose exec backend python manage.py import_books --clear

# 2. Seed departments, admin, CS librarian, 10 demo students, and ML interactions
docker compose exec backend python manage.py seed_demo

# 3. Verify Redis caching connectivity
docker compose exec backend python manage.py check_redis
```

#### Step 5: Verify Deployment
Test the deep health check endpoint via curl:
```bash
curl -i http://localhost/api/health/
```
*Expected Response (`HTTP 200 OK`)*:
```json
{
  "status": "healthy",
  "service": "library-backend",
  "database": "healthy",
  "cache": "healthy"
}
```

---

### Option B: Local Native Setup (Without Docker)

For local development directly on your host machine using Python virtual environments and Vite.

#### Step 1: Start Local PostgreSQL and Redis
Ensure PostgreSQL and Redis are active on your host:
```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Create PostgreSQL database and user
sudo -u postgres psql -c "CREATE USER library_user WITH PASSWORD 'StrongPass@123';"
sudo -u postgres psql -c "CREATE DATABASE library_db OWNER library_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE library_db TO library_user;"

# Start Redis service
sudo systemctl start redis-server
```

#### Step 2: Configure and Run Backend
```bash
cd backend

# Create & activate a Python virtual environment
python3 -m venv bookenv
source bookenv/bin/activate          # Windows: bookenv\Scripts\activate

# Install all backend requirements
pip install -r requirements.txt

# Configure backend environment
cp .env.example .env
# Ensure POSTGRES_HOST=127.0.0.1 and REDIS_URL=redis://127.0.0.1:6379/1 in backend/.env

# Execute migrations
python manage.py migrate

# Seed catalog and demo accounts
python manage.py import_books --clear
python manage.py seed_demo

# Start Django development server
python manage.py runserver 0.0.0.0:8000
```

#### Step 3: Configure and Run Frontend
Open a separate terminal window:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
The frontend starts at `http://localhost:5173`. Vite automatically proxies `/api/*` and `/admin/*` requests to `http://localhost:8000`.

---

## 4. Default Credentials & Access Points

### 4.1 Application URLs

| Interface | Docker URL | Local Dev URL | Audience |
|---|---|---|---|
| **Student & Librarian Portal** | `http://localhost` | `http://localhost:5173` | Students & Librarians |
| **Django Admin Panel** | `http://localhost/admin/` | `http://localhost:8000/admin/` | Super Administrators |
| **Deep Health Check** | `http://localhost/api/health/` | `http://localhost:8000/api/health/` | DevOps & Monitoring Agents |

### 4.2 Seeded Accounts (`python manage.py seed_demo`)

| Role | Username | Password | Department Scope | Key Permissions |
|---|---|---|---|---|
| **Super Admin** | `admin` | `admin123` | *Global* (All Departments) | Manage departments, provision librarians, system-wide admin |
| **Librarian** | `librarian_cs` | `test1234` | Computer Science | Manage CS catalog, approve/reject CS students & borrow requests |
| **Student** | `aarav_sharma` | `test1234` | Computer Science (Approved) | Browse CS books, request borrows, dwell tracking, ML recommendations |
| **Student** | `priya_patil` | `test1234` | Computer Science (Approved) | Browse CS books, request borrows, dwell tracking, ML recommendations |
| **Student** | `rohan_desai` | `test1234` | Computer Science (Approved) | Browse CS books, request borrows, dwell tracking, ML recommendations |

---

## 5. Management Commands & Administrative CLI Reference

All administrative operations are packaged as self-contained Django management commands located in domain apps.

### 5.1 Command Overview Table

| Command | App | Usage / Flags | Description |
|---|---|---|---|
| `import_books` | `books` | `python manage.py import_books [path] [--clear]` | Imports catalog from CSV. Defaults to `backend/data/books_6k.csv` (6,810 books). Safe append by default; `--clear` explicitly deletes old books first. |
| `seed_demo` | `accounts` | `python manage.py seed_demo` | Idempotent setup: creates CS Department, admin, librarian, 10 approved students, assigns 200 catalog books to CS, seeds 45 borrow logs, 5 pending requests, and 200 ML interactions. |
| `seed_interactions`| `books` | `python manage.py seed_interactions [--count N]` | Generates `N` (default: 500) realistic `BookInteraction` records (`view`, `like`, `borrow`) across users for ML recommender training. |
| `check_redis` | `accounts` | `python manage.py check_redis` | Tests raw Redis socket ping, Django cache operations (`set`, `get`, `delete`), session store access, and prints latency. |
| `create_admin` | `accounts` | `python manage.py create_admin` | Idempotently creates or updates the production admin user using `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables. |
| `migrate` | Django Core | `python manage.py migrate [--noinput]` | Applies schema migrations safely to PostgreSQL. |
| `makemigrations`| Django Core | `python manage.py makemigrations [--check --dry-run]` | Inspects model definitions and generates new migration files. |
| `collectstatic` | Django Core | `python manage.py collectstatic --noinput` | Pre-compiles Django admin and DRF static assets into `staticfiles/`. Run at Docker build time. |

### 5.2 Detailed Command Usage Examples

#### 1. Importing Book Catalog (`import_books`)
```bash
# Append / update books without deleting existing records (Safe):
docker compose exec backend python manage.py import_books

# Clear existing records and re-import completely (Destructive):
docker compose exec backend python manage.py import_books --clear

# Import a custom department CSV file:
docker compose exec backend python manage.py import_books /app/data/mechanical_books.csv
```

#### 2. Verifying Redis Health (`check_redis`)
```bash
docker compose exec backend python manage.py check_redis
```
*Sample Output*:
```text
==================================================
Testing Redis Cache Connection...
REDIS_URL: redis://redis:6379/1
==================================================
✅ Raw Redis client connected successfully! PING -> PONG
✅ Django Cache SET succeeded.
✅ Django Cache GET succeeded (Retrieved: redis_test_value)
✅ Django Cache DELETE succeeded.
🎉 Redis Cache & Session configuration verified working!
```

#### 3. Creating Production Admin (`create_admin`)
```bash
docker compose exec -e ADMIN_USERNAME=sysadmin -e ADMIN_PASSWORD=ComplexSuperPassword987 backend python manage.py create_admin
```

---

## 6. 12-Factor App Methodology Implementation

This project implements all twelve factors of the [12-Factor App methodology](https://12factor.net/):

| Factor | Principle | Project Implementation & Verification |
|---|---|---|
| **I. Codebase** | One codebase tracked in revision control, many deploys | Single Git repository tracking frontend, backend, configuration, and deployment files. Deployed to dev, docker, and cloud environments from unified branches. |
| **II. Dependencies** | Explicitly declare and isolate dependencies | Backend pins exact versions in `backend/requirements.txt` (`psycopg2-binary==2.9.13`, `argon2-cffi==25.1.0`, etc.). Frontend locks all packages in `package-lock.json`. Isolated via Docker containers. |
| **III. Config** | Store config in the environment | 100% of runtime configuration is injected via OS environment variables (`.env`). Secrets (`DJANGO_SECRET_KEY`, `BREVO_API_KEY`) are excluded from Git. `settings.py` raises `RuntimeError` if production secrets are missing. |
| **IV. Backing Services** | Treat backing services as attached resources | PostgreSQL (`POSTGRES_HOST`) and Redis (`REDIS_URL`) are treated as attached network resources. Brevo email uses HTTPS REST API (port 443). Resources can be swapped via URL without modifying code. |
| **V. Build, Release, Run** | Strictly separate build and run stages | Docker builds immutable image artifacts. Static assets are collected at build time (`RUN ... collectstatic`). Migrations are separated via `render.yaml` `preDeployCommand` or container startup flags (`MIGRATE_ON_BOOT`). |
| **VI. Processes** | Execute the app as one or more stateless processes | Backend Gunicorn workers are entirely stateless. User sessions and authentication tokens are stored in Redis (`cached_db`) and client JWTs. Local filesystem storage is strictly non-ephemeral or mounted via Docker volumes. |
| **VII. Port Binding** | Export services via port binding | Gunicorn binds to `0.0.0.0:8000`. Vite binds to `0.0.0.0:5173`. Nginx binds to `0.0.0.0:80`. Port numbers are configurable via environment variables (`PORT`, `FRONTEND_PORT`). |
| **VIII. Concurrency** | Scale out via the process model | Backend scales horizontally via Gunicorn workers (`GUNICORN_WORKERS=${WEB_CONCURRENCY:-3}`) and container replication. Concurrency-safe atomic database operations prevent race conditions. |
| **IX. Disposability** | Maximize robustness with fast startup and graceful shutdown | Backend starts quickly with minimal boot overhead. Nginx includes `STOPSIGNAL SIGQUIT` for graceful connection termination. Gunicorn handles `SIGTERM` to complete in-flight HTTP requests. |
| **X. Dev/Prod Parity** | Keep development, staging, and production as similar as possible | Both local Docker and cloud production use PostgreSQL 16 Alpine and Redis 7 Alpine. The CI pipeline runs tests against real PostgreSQL 16 containers via `USE_POSTGRES_TESTS: "true"`. |
| **XI. Logs** | Treat logs as event streams | Django logging dictionary streams timestamped, structured logs to `sys.stdout`. Gunicorn uses `--access-logfile - --error-logfile -`. No hardcoded file loggers. Logs are captured by Docker/log aggregators. |
| **XII. Admin Processes** | Run admin/management tasks as one-off processes | Database migrations, catalog imports (`import_books`), user seeding (`seed_demo`), and cache checks (`check_redis`) run as standalone one-off commands using the identical runtime environment. |

---

## 7. Deep Health Check & Observability Specification

The application features a 12-factor deep health check endpoint at `/api/health/` that verifies both application responsiveness and attached backing service connectivity.

### 7.1 Health Check Logic
* **Database Verification**: Calls `django.db.connection.ensure_connection()` to verify PostgreSQL socket availability and credentials.
* **Cache Verification**: Executes an atomic `cache.set("_health_ping", 1, timeout=5)` to test Redis read/write latency.
* **Status Codes**:
  * `200 OK`: All backing services are healthy.
  * `503 Service Unavailable`: One or more backing services failed.

### 7.2 Sample Response Payloads

#### Healthy Payload (`HTTP 200`):
```json
{
  "status": "healthy",
  "service": "library-backend",
  "database": "healthy",
  "cache": "healthy"
}
```

#### Degraded / Unhealthy Payload (`HTTP 503`):
```json
{
  "status": "unhealthy",
  "service": "library-backend",
  "database": "unhealthy: could not connect to server: Connection refused",
  "cache": "healthy"
}
```

---

## 8. Complete REST API Reference & Data Contracts

All endpoints except public authentication and catalog routes require the HTTP header:
`Authorization: Bearer <access_token>`

### 8.1 Authentication & Profile Endpoints (`/api/auth/`)

| Method | Endpoint | Access | Request Payload | Response | Description |
|---|---|---|---|---|---|
| `POST` | `/api/auth/otp/request/` | Public | `{"email": "student@sppu.edu"}` | `{"message": "OTP sent successfully"}` | Generates 6-digit OTP and delivers via Brevo API (expires in 10 mins). |
| `POST` | `/api/auth/otp/verify/` | Public | `{"email": "student@sppu.edu", "otp": "123456"}` | `{"verification_token": "uuid-token"}` | Validates OTP and returns verification token for registration. |
| `POST` | `/api/auth/register/` | Public | `{"username": "aarav", "password": "...", "email": "...", "department_id": 1, "verification_token": "..."}` | `{"message": "Registration submitted for librarian approval"}` | Creates student account with `is_approved=False`. |
| `POST` | `/api/auth/login/` | Public | `{"username": "aarav", "password": "..."}` | `{"access": "jwt...", "refresh": "jwt...", "user": {"role": "STUDENT", "department": 1}}` | Validates credentials; returns JWT tokens and user context. |
| `POST` | `/api/auth/refresh/` | Public | `{"refresh": "jwt..."}` | `{"access": "new-jwt..."}` | Issues a new short-lived access token using valid refresh token. |
| `POST` | `/api/auth/google/` | Public | `{"credential": "google-id-token"}` | `{"access": "jwt...", "refresh": "jwt...", "user": {...}}` | Google OAuth 2.0 authentication and account provisioning. |
| `GET` | `/api/auth/departments/` | Public | None | `[{"id": 1, "name": "Computer Science", "code": "CS"}]` | Lists active academic departments for dropdowns. |
| `GET` | `/api/auth/me/` | Authenticated | None | `{"id": 1, "username": "aarav", "role": "STUDENT", "profile": {...}}` | Retrieves profile of currently authenticated user. |
| `PUT` | `/api/auth/me/` | Authenticated | `{"first_name": "Aarav", "bio": "..."}` | `{"id": 1, "username": "aarav", ...}` | Updates user profile information. |
| `GET` | `/api/auth/notifications/` | Authenticated | None | `[{"id": 1, "message": "...", "is_read": false}]` | Returns in-app notifications for borrow/approval events. |
| `POST`| `/api/auth/notifications/mark-read/` | Authenticated | `{"notification_id": 1}` | `{"success": true}` | Marks a specific notification as read. |
| `POST`| `/api/auth/notifications/mark-all-read/` | Authenticated | None | `{"success": true}` | Marks all user notifications as read. |

### 8.2 Book Catalog & Recommendation Endpoints (`/api/books/`)

| Method | Endpoint | Access | Query Parameters / Payload | Description |
|---|---|---|---|---|
| `GET` | `/api/books/` | Public | `?search=algo&category=CS&page=1&page_size=20` | Paginated catalog search with cached page 1. |
| `GET` | `/api/books/categories/` | Public | `?department=1` | Dynamic category list with book counts per category. |
| `GET` | `/api/books/<id>/` | Public | None | Retrieves detailed metadata for a single book. |
| `GET` | `/api/books/<id>/similar/` | Public | None | TF-IDF content similarity recommendations for given book. |
| `GET` | `/api/books/recommendations/`| Student | `?type=hybrid\|content\|interaction&limit=10` | Personalized hybrid recommendations for student. |
| `POST`| `/api/books/manage/` | Librarian | `{"title": "...", "author": "...", "isbn": "...", "total_copies": 5}` | Creates new book record locked to librarian's department. |
| `PUT` | `/api/books/manage/<id>/` | Librarian | `{"title": "...", "total_copies": 8}` | Updates book record belonging to librarian's department. |
| `DELETE`| `/api/books/manage/<id>/` | Librarian | None | Deletes book record belonging to librarian's department. |
| `POST`| `/api/books/import/` | Librarian | Multipart `file` (CSV) | Bulk imports CSV books into librarian's department. |

### 8.3 Interaction & Dwell-Time Endpoints

| Method | Endpoint | Access | Request Payload | Description |
|---|---|---|---|---|
| `POST` | `/api/interactions/` | Student | `{"book": 105, "interaction_type": "like"}` | Logs implicit interest signal (`view`, `like`, `borrow`). |
| `POST` | `/api/dwell-time/` | Student | `{"book": 105, "dwell_seconds": 45}` | Records time spent inspecting book modal to tune ML score. |

### 8.4 Borrow Lifecycle Endpoints (`/api/borrows/`)

| Method | Endpoint | Access | Payload | Description |
|---|---|---|---|---|
| `POST` | `/api/borrows/request/` | Student | `{"book_id": 105}` | Creates a `PENDING` borrow request. |
| `GET` | `/api/borrows/my/` | Student | None | Lists student's active, pending, and past borrow history. |
| `GET` | `/api/borrows/pending/` | Librarian | None | Lists pending borrow requests for librarian's department. |
| `POST` | `/api/borrows/approve/<id>/` | Librarian | None | **Atomic row-locked approval**: decrements `available_copies` and issues loan. |
| `POST` | `/api/borrows/reject/<id>/` | Librarian | `{"reason": "Exceeded limit"}` | Rejects borrow request and notifies student. |
| `POST` | `/api/borrows/return/` | Student | `{"borrow_id": 42}` | Marks book returned and increments `available_copies`. |

### 8.5 Analytics & Dashboards (`/api/analytics/`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/analytics/librarian-dashboard/` | Librarian | Department-scoped borrowing statistics, active vs overdue loans, popular books. |
| `GET` | `/api/analytics/students/` | Librarian | List of students registered in librarian's department with approval status. |
| `GET` | `/api/analytics/students/<id>/borrows/` | Librarian | Full borrowing history for a specific department student. |
| `GET` | `/api/analytics/students/<id>/recommendations/` | Librarian | Visualizes recommendation vectors generated for a specific student. |

### 8.6 Internal Messaging (`/api/messages/`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/messages/` | Authenticated | Lists conversation threads for current user. |
| `POST`| `/api/messages/send/` | Authenticated | Sends internal message to student or librarian. |
| `POST`| `/api/messages/<id>/read/` | Authenticated | Marks message thread as read. |

---

## 9. Role-Based Workflows & Security Model

```
                    ┌───────────────────────────────┐
                    │       Super Administrator     │
                    │   - Creates academic depts    │
                    │   - Provisions librarians     │
                    │   - Global Django Admin audit │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      Department Librarian     │
                    │   - Department catalog CRUD   │
                    │   - CSV bulk catalog upload   │
                    │   - Approves student accounts │
                    │   - Atomic borrow approvals   │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       Department Student      │
                    │   - 6-digit email OTP signup  │
                    │   - Scoped catalog browsing   │
                    │   - ML hybrid recommendations │
                    │   - Book borrow & return flow │
                    └───────────────────────────────┘
```

### 9.1 Concurrency & Atomic Inventory Protection

To eliminate race conditions when multiple students request the last available copy of a book simultaneously, the borrow approval workflow in `borrows/views.py` employs PostgreSQL row-level locks:

```python
with transaction.atomic():
    # Acquire exclusive row-level lock on the target Book record
    book = Book.objects.select_for_update().get(id=borrow_request.book_id)
    
    if book.available_copies < 1:
        raise ValidationError("No copies available for loan.")
        
    book.available_copies -= 1
    book.save(update_fields=['available_copies'])
    
    borrow_request.status = 'APPROVED'
    borrow_request.issue_date = timezone.now()
    borrow_request.due_date = timezone.now() + timedelta(days=14)
    borrow_request.save()
```

---

## 10. Machine Learning Recommendation Engine

The recommendation system utilizes a multi-model hybrid approach combining **Content-Based Filtering**, **Collaborative Filtering**, and **Implicit Feedback Dwell-Time Scoring**.

```
                        User Interaction Stream
                  (Views, Likes, Borrows, Dwell-Time)
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌──────────────────────────────┐            ┌──────────────────────────────┐
│     Content-Based Model      │            │   Collaborative Filtering    │
│  - TF-IDF on Title, Author,  │            │  - User-Item Matrix          │
│    Overview, & Categories    │            │  - Interaction Affinities    │
│  - Scikit-Learn Vectorizer   │            │  - Department Peer Patterns  │
│  - Cosine Similarity Matrix  │            │  - Co-occurrence Correlation │
└──────────────┬───────────────┘            └──────────────┬───────────────┘
               │                                           │
               └─────────────────────┬─────────────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │    Hybrid Ranker & Scorer     │
                     │  - Weight: View = 1.0         │
                     │  - Weight: Like = 3.0         │
                     │  - Weight: Borrow = 5.0       │
                     │  - Dwell Bonus = log(secs)    │
                     │  - Department Catalog Scope   │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                      Top-N Ranked Recommendations
                      (Cached in Redis for 1 hour)
```

### 10.1 Redis Caching & Invalidation Architecture
* **Dynamic Category Caching**: Category counts and lists are cached in Redis (`books:categories:<dept_id>`) with an automatic 6-hour TTL.
* **Instant Cache Invalidation**: Any catalog mutation (`POST`, `PUT`, `DELETE` in `manage/` or CSV upload) immediately purges cached catalog keys via `books/cache_utils.py`.
* **Sub-Millisecond Recommendations**: Pre-computed similarity vectors are stored in Redis (`recs:<user_id>`) for 1 hour and refreshed when new interaction events occur.

---

## 11. Automated Testing & Quality Assurance

The codebase includes comprehensive test suites covering unit tests, integration tests, concurrency tests, and security permission checks across all apps.

### 11.1 Test Suite Verification Commands

#### Run Full Pytest Suite (170 Passing Tests):
```bash
# In Docker:
docker compose exec backend pytest -q

# Locally:
cd backend && pytest -q
```
*Expected output*: `170 passed, 147 warnings in ~53s`

#### Run Django Built-in Test Runner (114 Passing Tests):
```bash
# In Docker:
docker compose exec backend python manage.py test

# Locally:
cd backend && python manage.py test
```
*Expected output*: `Ran 114 tests ... OK`

#### Run Tests Against Real PostgreSQL:
Set `USE_POSTGRES_TESTS=true` to run tests against PostgreSQL instead of the fast in-memory SQLite runner:
```bash
docker compose exec -e USE_POSTGRES_TESTS=true backend pytest -q
```

#### Run Frontend Lint & Build Checks:
```bash
cd frontend
npm run lint                 # ESLint static code verification
npm run build                # Production Vite asset compilation
```

---

## 12. Production Operations, SSL & Maintenance Runbook

### 12.1 Host Nginx Reverse Proxy with Let's Encrypt SSL

When deploying to a public VPS (Ubuntu 22.04 / 24.04 LTS), terminate SSL at the host level using Certbot and proxy to the Docker container:

1. Configure `.env` on host:
   ```env
   FRONTEND_PORT=8080
   ALLOWED_HOSTS=library.yourdomain.edu,www.library.yourdomain.edu
   CSRF_TRUSTED_ORIGINS=https://library.yourdomain.edu,https://www.library.yourdomain.edu
   CORS_ALLOWED_ORIGINS=https://library.yourdomain.edu,https://www.library.yourdomain.edu
   ```

2. Recreate containers:
   ```bash
   docker compose up -d --force-recreate frontend
   ```

3. Configure host `/etc/nginx/sites-available/library.yourdomain.edu`:
   ```nginx
   server {
       server_name library.yourdomain.edu www.library.yourdomain.edu;

       client_max_body_size 50M;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. Issue Free SSL Certificate via Certbot:
   ```bash
   sudo ln -s /etc/nginx/sites-available/library.yourdomain.edu /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d library.yourdomain.edu -d www.library.yourdomain.edu
   ```

### 12.2 Automated PostgreSQL Backups

#### Manual Backup:
```bash
docker compose exec db pg_dump -U library_user -d library_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Manual Restore:
```bash
cat backup_20261102_120000.sql | docker compose exec -T db psql -U library_user -d library_db
```

#### Daily Automated Cron Backup:
Add this entry to your crontab (`crontab -e`):
```bash
0 2 * * * cd /home/sidhharth/sppu/git/Recommondation_system && docker compose exec db pg_dump -U library_user -d library_db > /backups/db_$(date +\%F).sql 2>&1
```

---

## 13. Troubleshooting & Disaster Recovery

### Issue 1: Port Conflict on Host Machine
* **Symptom**: `Bind for 0.0.0.0:80 failed: port is already allocated` or `5432 failed`.
* **Fix**: In `.env`, change `FRONTEND_PORT=8082` and `POSTGRES_PORT_HOST=5435`. Then run `docker compose up -d`.

### Issue 2: Redis Unavailable or Intermittent
* **Symptom**: Redis container crashes or network timeout occurs.
* **Behavior**: The application continues functioning without throwing 500 errors because `IGNORE_EXCEPTIONS=True` is enabled in `settings.py` for Redis cache.
* **Fix**: Check Redis container health with `docker compose ps` and restart via `docker compose restart redis`.

### Issue 3: Brevo OTP Emails Not Sending
* **Symptom**: Students do not receive the 6-digit registration code.
* **Fix**:
  1. Inspect backend logs: `docker compose logs -f backend`.
  2. Verify `BREVO_API_KEY` is an active v3 key and `DEFAULT_FROM_EMAIL` matches an authorized sender in Brevo.
  3. In development environments without a Brevo key, OTP codes are printed directly to the backend stdout logs.

### Issue 4: Resetting Database to Clean State
* **Symptom**: Corrupt test records or need to completely reset the system.
* **Fix**:
  ```bash
  docker compose down -v
  docker compose up --build -d
  docker compose exec backend python manage.py import_books --clear
  docker compose exec backend python manage.py seed_demo
  ```

---

## 14. Document Version & Maintenance

* **Document Version**: `2.0.0 (12-Factor Compliant Release)`
* **Primary Maintainer**: Siddharth Ghode
* **Project**: SPPU Academic Library & Book Recommendation System
* **Git Branch**: `12_factor_app`
