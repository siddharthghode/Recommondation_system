# Library Management & Book Recommendation System

[![Python](https://img.shields.io/badge/Python-3.11%2B%20%7C%203.13-3776AB?logo=python&logoColor=white)](https://python.org)
[![Django](https://img.shields.io/badge/Django-6.0.1-092E20?logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7.3.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose%20v2-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![Tests](https://img.shields.io/badge/Tests-125%20Passing-success)](file:///home/sidhharth/sppu/git/Recommondation_system/pytest.ini)

A production-ready, full-stack university library management system featuring role-based access control, strict department-level catalog isolation, student registration approval workflows, email OTP verification, Google OAuth, librarian CSV catalog imports, an intelligent machine learning recommendation engine, atomic inventory management, in-app notifications, and containerized Docker deployment.

---

## ⚡ Quick Start (Fastest Setup)

Choose between **Docker** (recommended — zero host dependencies) or **Local Development** (Python + Node.js).

### Option A: 🐳 Docker Compose (Recommended)

Run the entire stack (PostgreSQL + Django API + React Nginx) with Docker:

```bash
# 1. Clone the repository
git clone https://github.com/siddharthghode/Recommondation_system.git
cd Recommondation_system

# 2. Create environment file from template
cp .env.example .env

# 3. Build and launch all containers in background
docker compose up --build -d

# 4. Populate catalog & demo data (admin, librarian, students, 6.8k books)
docker compose exec backend python manage.py import_books
docker compose exec backend python manage.py seed_demo
```

### Option B: 💻 Local Native Setup (Without Docker)

If you prefer running natively on your host machine:

#### 1. Backend (Django)
```bash
cd backend

# Create & activate virtual environment
python3 -m venv bookenv
source bookenv/bin/activate          # Windows: bookenv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Apply database migrations
python manage.py migrate

# Seed catalog & demo accounts
python manage.py import_books
python manage.py seed_demo

# Start Django development server
python manage.py runserver 0.0.0.0:8000
```

#### 2. Frontend (React + Vite)
In a new terminal:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server with hot reload
npm run dev
# App will run at: http://localhost:5173 (auto-proxies /api -> http://localhost:8000)
```

---

## 🌐 Access Points & Demo Credentials

### Application Endpoints

| Service | Docker URL | Local Dev URL | Description |
|---|---|---|---|
| **Web Application** | [`http://localhost`](http://localhost) | [`http://localhost:5173`](http://localhost:5173) | Main React UI for Students & Librarians |
| **Django Admin Panel** | [`http://localhost/admin/`](http://localhost/admin/) | [`http://localhost:8000/admin/`](http://localhost:8000/admin/) | Super Admin management dashboard |
| **API Health Check** | [`http://localhost/api/health/`](http://localhost/api/health/) | [`http://localhost:8000/api/health/`](http://localhost:8000/api/health/) | JSON status (`{"status": "healthy"}`) |

> **Note**: If port 80 is occupied on your host machine, change `FRONTEND_PORT=8080` in `.env` and access at `http://localhost:8080`.

### Pre-Seeded Demo Accounts

The `python manage.py seed_demo` command creates ready-to-test accounts:

| Role | Username | Password | Department | Permissions / Scope |
|---|---|---|---|---|
| **Super Admin** | `admin` | `admin123` | *Global* | Full Django Admin & system oversight |
| **Librarian** | `librarian_cs` | `test1234` | Computer Science | Book catalog CRUD, CSV import, approve borrows & students |
| **Student** | `aarav_sharma` | `test1234` | Computer Science | Browse CS catalog, request books, ML recommendations |
| **Student** | `priya_patil` | `test1234` | Computer Science | Browse CS catalog, request books, ML recommendations |
| **Student** | `rohan_desai` | `test1234` | Computer Science | Browse CS catalog, request books, ML recommendations |

---

## 🌟 Key Features

### 👑 Super Admin
- **Department Oversight**: Create, update, and manage academic departments (e.g. *Computer Science*, *Mechanical Engineering*, *Civil Engineering*).
- **Librarian Provisioning**: Assign and reassign librarians to specific academic departments.
- **Global Catalog & Transaction Visibility**: Access system-wide books, borrow transactions, and student activity via Django Admin.

### 📚 Librarian
- **Department Catalog Management**: Create, edit, and delete books strictly bound to the librarian's assigned department.
- **CSV Catalog Bulk Upload**: Upload bulk book catalogs (`POST /api/books/import/`) with automatic validation, schema mapping, and department assignment.
- **Student Approval Workflow**: Review, approve, or reject student registration requests belonging to their department.
- **Borrow Request Processing**: Approve or reject department student borrow requests with **atomic row-level locking** (`select_for_update`) to prevent oversubscription.
- **Analytics Dashboard**: Department-scoped statistics on active borrows, overdue items, inventory distribution, and reading trends.

### 🎓 Student
- **Self-Registration & Email OTP**: Register with student ID, select department, and verify identity via a secure 6-digit email OTP.
- **Google OAuth 2.0**: Seamless single sign-on with verified Google accounts.
- **Department Catalog & Search**: Search, category filter, and paginate through books belonging exclusively to their approved department.
- **Interaction & Dwell Time Tracking**: Automatically logs book views, likes, dwell time, and searches to power personalized suggestions.
- **Machine Learning Recommendations**: Real-time personalized book recommendations powered by TF-IDF vectorization, cosine similarity, collaborative filtering, and hybrid ranking.
- **Borrow Lifecycle**: Request books, track active loans, receive instant in-app notifications on approvals/rejections, and manage returns.

---

## 🤖 Recommendation Engine Architecture

The recommendation engine blends multiple machine learning techniques to deliver accurate suggestions:

```
                      Student Interaction Signals
               (Views, Likes, Borrows, Dwell Time)
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│     Content-Based Model      │        │    Collaborative Filtering   │
│  - TF-IDF Vectorizer         │        │  - User-Item Matrix          │
│  - Cosine Similarity         │        │  - Co-occurrence Correlation │
│  - Book Metadata & Overviews │        │  - Department Peer Patterns  │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │                                       │
               └───────────────────┬───────────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │    Hybrid Ranker & Scorer     │
                   │  - Weighted Interaction Score │
                   │  - Dwell Time Significance    │
                   │  - Department Filtering       │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                    Personalized Recommendation List
```

1. **Content-Based Filtering**: TF-IDF vectorization on book titles, subtitles, categories, and descriptions with cosine similarity matrices.
2. **Collaborative Filtering**: Evaluates interaction affinities across student cohorts within the same department.
3. **Implicit Feedback Weighting**: Views (weight: 1x), Likes (weight: 3x), Borrows (weight: 5x), and Dwell Time (decay-adjusted dwell weighting).
4. **Hybrid Ranking**: Dynamically blends content and collaborative scores to eliminate cold-start issues while adapting to student interest shifts.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19.2, Vite 7.3, React Router 7 | Responsive SPA with client-side routing |
| **Styling & UI** | Tailwind CSS 4, Framer Motion, Recharts | Modern UI design, animations, and analytics charts |
| **Backend API** | Django 6.0, Django REST Framework 3.16 | High-performance modular REST API |
| **Authentication** | SimpleJWT 5.5, Argon2, Google OAuth 2.0 | Token-based auth and secure password hashing |
| **Machine Learning** | scikit-learn 1.6, NumPy 2.4, Pandas 2.3 | TF-IDF similarity, vector calculations & data processing |
| **Database** | PostgreSQL 16 Alpine | ACID relational database with row-level locks |
| **Web Server** | Nginx Alpine, Gunicorn 23.0, WhiteNoise 6.8 | Reverse proxy, WSGI application server & static files |
| **Containerization**| Docker, Docker Compose v2 | Multi-container isolated environment with automated health checks |

---

## 📁 Project Structure

```
Recommondation_system/
├── backend/
│   ├── accounts/               # User auth, department model, profile, OTP, notifications
│   ├── analytics/              # Librarian & student dashboard statistics
│   ├── book_recommondation/    # Django core settings, WSGI, URLs, caching, health check
│   ├── books/                  # Book catalog, CSV import, categories API, ML recommender
│   ├── borrows/                # Borrow lifecycle, atomic inventory locks, return ownership
│   ├── messaging/              # Internal messaging endpoints
│   ├── data/                   # Initial CSV datasets (books_6k.csv)
│   ├── Dockerfile              # Python 3.13 backend container
│   ├── entrypoint.sh           # Automated migrations, collectstatic & Gunicorn startup
│   ├── requirements.txt        # Backend dependencies
│   └── manage.py               # Django CLI
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components (Navbar, Modals, BookCards)
│   │   ├── pages/              # Views (Home, Catalog, Recommendations, ManageBooks)
│   │   └── services/           # Centralized API service layer (api.js)
│   ├── Dockerfile              # Multi-stage Node 20 builder -> Nginx Alpine runtime
│   ├── nginx.conf              # Nginx SPA routing and /api/ reverse proxy
│   ├── package.json            # Frontend dependencies and npm scripts
│   └── vite.config.js          # Vite build & proxy configuration
├── docker-compose.yml          # Docker Compose orchestration definition
├── DEPLOYMENT.md               # Production deployment, SSL/TLS, and server sizing guide
├── PROJECT_RULES.md            # System architecture and department security rules
├── .env.example                # Template environment variables
└── README.md                   # Project documentation & quick start guide
```

---

## 🧪 Testing & Verification Baseline

The repository includes a comprehensive automated test suite covering authentication, department scoping, CSV imports, ML algorithms, atomic inventory locks, and API endpoints.

### Run Tests in Docker:
```bash
docker compose exec backend python manage.py test
```

### Run Tests Locally (Backend):
```bash
cd backend
python manage.py test        # Django test runner (105 tests)
pytest -q                    # Pytest runner (125 tests)
```

### Run Frontend Build & Lint:
```bash
cd frontend
npm run lint                 # ESLint check
npm run build                # Production Vite asset build
```

---

## 📋 Common Commands Reference

| Action | Docker Command | Local Dev Command |
|---|---|---|
| **Start Services** | `docker compose up -d` | `python manage.py runserver` & `npm run dev` |
| **Rebuild & Start** | `docker compose up --build -d` | `pip install -r requirements.txt` & `npm install` |
| **Stop Services** | `docker compose down` | `Ctrl + C` |
| **View Logs** | `docker compose logs -f backend` | Terminal stdout |
| **Run Migrations** | `docker compose exec backend python manage.py migrate` | `python manage.py migrate` |
| **Import 6k Books** | `docker compose exec backend python manage.py import_books` | `python manage.py import_books` |
| **Seed Demo Data** | `docker compose exec backend python manage.py seed_demo` | `python manage.py seed_demo` |
| **Create Superuser** | `docker compose exec backend python manage.py createsuperuser` | `python manage.py createsuperuser` |
| **Django Shell** | `docker compose exec backend python manage.py shell` | `python manage.py shell` |
| **Run Test Suite** | `docker compose exec backend python manage.py test` | `python manage.py test` |
| **Reset Database** | `docker compose down -v` | Drop database / delete SQLite file |

---

## ⚙️ Environment Variables Reference

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

| Variable | Default (Local/Docker) | Purpose |
|---|---|---|
| `POSTGRES_DB` | `library_db` | PostgreSQL database name |
| `POSTGRES_USER` | `library_user` | PostgreSQL database username |
| `POSTGRES_PASSWORD` | `StrongPass@123` | PostgreSQL password |
| `POSTGRES_HOST` | `db` (Docker) / `127.0.0.1` (Local) | Database host address |
| `POSTGRES_PORT` | `5432` | Database port |
| `DEBUG` | `False` (Production) / `True` (Dev) | Django debug flag |
| `DJANGO_SECRET_KEY` | *(Set a secure string)* | Cryptographic signing key |
| `DJANGO_ENV` | `production` / `development` | Enforces secret key checks in production |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend,frontend` | Allowed HTTP host headers |
| `CORS_ALLOWED_ORIGINS` | `http://localhost,http://localhost:80,http://127.0.0.1` | Authorized CORS domains |
| `FRONTEND_PORT` | `80` | Host port for Nginx frontend |
| `GOOGLE_CLIENT_ID` | *(Optional)* | Google OAuth Web Client ID |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | Email backend (console for dev, smtp for prod) |

---

## 🔧 Troubleshooting

### 1. Port 80 is already in use
If another service (e.g. Apache, local Nginx) is using port 80:
```bash
# In .env, change FRONTEND_PORT:
FRONTEND_PORT=8080

# Restart containers:
docker compose up -d
```
Access the application at `http://localhost:8080`.

### 2. Viewing OTP verification codes in local development
When using the default console email backend, OTP codes appear in the backend logs:
```bash
docker compose logs -f backend
```
Look for:
```
Your verification code for the Department Library System is:
    123456
This code will expire in 10 minutes.
```

### 3. Database reset to clean state
To completely wipe all records and re-seed from scratch:
```bash
docker compose down -v
docker compose up --build -d
docker compose exec backend python manage.py import_books
docker compose exec backend python manage.py seed_demo
```

---

## 🚢 Production Deployment

For complete instructions on deploying to Ubuntu Linux, configuring Nginx with SSL/HTTPS certificates via Let's Encrypt / Certbot, domain configuration, and automated PostgreSQL backups, refer to the [DEPLOYMENT.md](file:///home/sidhharth/sppu/git/Recommondation_system/DEPLOYMENT.md) guide.

---

## 📄 License & Authors

Developed for the SPPU Academic Library System.
Maintained by **Siddharth Ghode**.
