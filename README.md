# Library Management & Book Recommendation System

A full-stack university library management platform featuring role-based access control, strict department-based catalog isolation, student registration approval workflows, email OTP verification, Google OAuth integration, librarian CSV catalog imports, an intelligent machine learning book recommendation engine, atomic inventory management, in-app notifications, and a complete Dockerized deployment.

---

## Features

### Super Admin
- **Department Management**: Create, view, and oversee academic departments (e.g., Computer Science, Mechanical Engineering).
- **Librarian Management**: Provision and assign librarians to specific academic departments.
- **Global Oversight**: System-wide administrative access to books, borrow transactions, and users via the Django Admin panel.

### Librarian
- **Department-Scoped Catalog Management**: Create, edit, search, and delete books strictly bound to their assigned department.
- **Librarian CSV Catalog Import**: Upload CSV book catalogs (`POST /api/books/import/`) with automated department binding and atomic transactions.
- **Student Approval Workflow**: Review, approve, or reject student registration requests belonging to their department.
- **Borrow Request Processing**: Approve or reject department student borrow requests with atomic row-level locking (`select_for_update`) to prevent oversubscription.
- **Department Analytics Dashboard**: Monitor department borrowing statistics, inventory levels, and active student analytics.

### Student
- **Self-Registration & Email OTP**: Register with student ID, select academic department, and verify email via a secure 6-digit OTP.
- **Google OAuth**: Sign in or register with verified Google credentials.
- **Approval Status**: Access is restricted (`pending`) until approved by the department librarian.
- **Department Catalog & Search**: Search, filter by category, and paginate through books belonging exclusively to their approved department.
- **Interaction & Dwell Time Tracking**: Automatically logs book views, likes, dwell time, and search history to personalize recommendations.
- **Intelligent Recommendations**: Real-time personalized book recommendations powered by TF-IDF vectorization, cosine similarity, collaborative filtering, and hybrid ranking.
- **Borrowing Lifecycle**: Request book loans, track active borrows, receive instant notifications on approvals/rejections, and return borrowed books.

---

## Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 19.2.0, Vite, React Router 7 | Single Page Application (SPA) with responsive UI |
| **Styling & UI** | Tailwind CSS 4, Framer Motion, Recharts | Modern design, smooth transitions, and analytics charts |
| **Backend API** | Django 6.0.1, Django REST Framework 3.16.1 | REST API with modular apps and department authorization |
| **Authentication** | SimpleJWT 5.5.1, Argon2, Google OAuth | Token-based authentication and secure password hashing |
| **Machine Learning** | scikit-learn 1.6.1, NumPy 2.4.1, Pandas 2.3.3 | TF-IDF content similarity, collaborative filtering & hybrid ranker |
| **Database** | PostgreSQL 16 Alpine | Relational database with foreign key constraints & row locking |
| **Server & Proxy** | Nginx Alpine, Gunicorn 23.0.0, WhiteNoise 6.8.2 | Production reverse proxy, WSGI server, and static asset pipeline |
| **Containerization** | Docker, Docker Compose v2 | Multi-container isolated environment with automated health checks |

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

### Docker Compose Service Architecture:
- **`frontend`**: Serves pre-compiled React static assets and acts as the public reverse proxy routing `/api/` and `/admin/` to the backend.
- **`backend`**: Runs the Django application via Gunicorn WSGI, serves static files via WhiteNoise, runs migrations on startup, and executes ML recommendations.
- **`db`**: Runs the PostgreSQL 16 database; health is actively checked with `pg_isready` before backend services start.

---

## Requirements

### Required:
- [Docker](https://docs.docker.com/get-docker/) (20.10+)
- [Docker Compose](https://docs.docker.com/compose/) (v2.0+)

### Not Required on Host:
- Python, Node.js, npm, PostgreSQL, or virtual environments are **not required** on your host machine. Everything compiles, migrates, and runs inside Docker containers.

---

## Quick Start (One-Command Docker Setup)

### 1. Clone the Repository
```bash
git clone https://github.com/siddharthghode/Recommondation_system.git
cd Recommondation_system
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```

### 3. Start the Application
Run the single startup command:
```bash
docker compose up --build -d
```

**What happens automatically during startup:**
1. PostgreSQL container starts and initializes database credentials.
2. PostgreSQL health check passes (`pg_isready`).
3. Backend container detects healthy database and runs `python manage.py migrate`.
4. Backend collects static files using `collectstatic --noinput`.
5. Gunicorn WSGI server boots with 3 worker processes on `0.0.0.0:8000`.
6. Frontend multi-stage Docker build compiles the React SPA via Vite.
7. Nginx Alpine starts on port 80, serving the UI and proxying `/api/` traffic.

---

## Accessing the Application

| Resource | URL | Description |
|---|---|---|
| **Web Application** | `http://localhost` | React student & librarian interface |
| **Backend Health Check** | `http://localhost/api/health/` | API status endpoint (`{"status": "healthy"}`) |
| **Django Admin Panel** | `http://localhost/admin/` | Global super admin management interface |

> *Note*: If host port 80 is in use by your host system (e.g. Apache/Nginx), set `FRONTEND_PORT=8080` in `.env` and access the application at `http://localhost:8080`.

---

## Initial Super Admin Setup

Create the first superuser account (one-time operation):
```bash
docker compose exec backend python manage.py createsuperuser
```
Follow the interactive prompts to enter a username, email, and password.

---

## Initial Application Workflow

1. **Log in as Super Admin**: Open `http://localhost/admin/` and log in with your superuser credentials.
2. **Create Departments**: In the `Accounts` > `Departments` section, create one or more departments (e.g. *Computer Science*, *Mechanical Engineering*).
3. **Create Librarians**: In `Accounts` > `Users`, add a user with `role = librarian` and assign them to their respective department.
4. **Librarian Login & CSV Import**:
   - Log in at `http://localhost` with the librarian credentials.
   - Navigate to the **Manage Books** page.
   - Upload a book catalog CSV file. All imported books are automatically assigned to the librarian's department.
5. **Student Registration**:
   - Students visit `http://localhost` and click **Register**.
   - Student enters email and clicks **Send Code**.
   - Student verifies the 6-digit OTP, fills in student ID and selects their department.
   - Account is created in `PENDING` status.
6. **Librarian Student Approval**:
   - The department librarian logs in, opens the **Students** tab, and approves the pending student.
7. **Student Experience**:
   - Student logs in to browse department books, receives personalized ML recommendations, requests book borrows, receives approval notifications, and completes returns.

---

## Environment Variables Reference

All runtime variables are defined in `.env` (configured from `.env.example`):

| Variable | Default (Local Docker) | Description |
|---|---|---|
| `POSTGRES_DB` | `library_db` | PostgreSQL database name |
| `POSTGRES_USER` | `library_user` | PostgreSQL database username |
| `POSTGRES_PASSWORD` | `StrongPass@123` | PostgreSQL user password |
| `POSTGRES_HOST` | `db` | Docker internal database service hostname |
| `POSTGRES_PORT` | `5432` | PostgreSQL internal port |
| `DEBUG` | `False` | Django debug mode (`False` in production) |
| `DJANGO_SECRET_KEY` | *(Docker fallback)* | Django cryptographic signing key |
| `DJANGO_ENV` | `production` | Environment mode (`production` enforces secret key validation) |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend,frontend` | Allowed HTTP host headers |
| `CORS_ALLOWED_ORIGINS` | `http://localhost,http://localhost:80,http://127.0.0.1` | Authorized CORS origin domains |
| `GOOGLE_CLIENT_ID` | *(Optional)* | Google OAuth Web Client ID for Google Sign-In |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | Email delivery backend |
| `FRONTEND_PORT` | `80` | Host port mapped to frontend Nginx |

---

## Email OTP Authentication

### Local Development:
By default, the backend uses Django's console email backend. Verification OTPs are printed directly to the backend container logs:
```bash
docker compose logs -f backend
```
Look for:
```
Your verification code for the Department Library System is:
    123456
This code will expire in 10 minutes.
```

### Production Email:
For real email delivery, configure SMTP settings in `.env`:
```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-specific-password
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
```

---

## Google OAuth Configuration

To enable Google Sign-In and Registration:
1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Configure the OAuth Consent Screen and create an **OAuth 2.0 Client ID** (Web application).
3. Add your domain (e.g., `http://localhost` or `https://yourdomain.com`) to **Authorized JavaScript origins**.
4. Set the client ID in `.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
5. Rebuild the frontend container to apply the OAuth key:
   ```bash
   docker compose up --build -d frontend
   ```

---

## Librarian CSV Catalog Import

Librarians can import bulk book catalogs through the web UI (`POST /api/books/import/`).

### CSV Format Requirements:
The CSV must include headers matching book attributes. Minimal required column is `title`.
```csv
title,subtitle,authors,categories,description,published_year,num_pages,average_rating,ratings_count,thumbnail,quantity
"Introduction to Algorithms","Third Edition","Thomas H. Cormen","Computers","Comprehensive textbook",2009,1312,4.6,1500,"https://example.com/algo.jpg",5
```
- A sample dataset is available in the repository at [`backend/data/books_6k.csv`](file:///home/sidhharth/sppu/git/Recommondation_system/backend/data/books_6k.csv).
- All imported books are automatically scoped to the uploading librarian's department.

---

## Optional Demo Data Seeding

For testing or demonstrations, pre-built management commands can seed the catalog and demo users:

```bash
# Seed initial 6,000 book dataset (reads backend/data/books_6k.csv)
docker compose exec backend python manage.py import_books

# Seed demo departments, admin, CS librarian, 10 demo students, and ML interactions
docker compose exec backend python manage.py seed_demo
```

### Demo Credentials:
| Role | Username | Password | Department |
|---|---|---|---|
| **Super Admin** | `admin` | `admin123` | Global Access |
| **Librarian** | `librarian_cs` | `test1234` | Computer Science |
| **Student** | `aarav_sharma` | `test1234` | Computer Science |
| **Student** | `priya_patil` | `test1234` | Computer Science |

---

## Common Docker Commands Reference

| Task | Command | Description |
|---|---|---|
| **Start Services** | `docker compose up -d` | Starts all services in the background |
| **Rebuild & Start** | `docker compose up --build -d` | Rebuilds images and starts containers |
| **View All Logs** | `docker compose logs -f` | Follows combined logs of all services |
| **View Backend Logs** | `docker compose logs -f backend` | Follows Django / Gunicorn logs (and OTP emails) |
| **View Database Logs** | `docker compose logs -f db` | Follows PostgreSQL database logs |
| **Stop Services** | `docker compose down` | Stops containers while preserving database data |
| **Restart Services** | `docker compose restart` | Restarts all running containers |
| **Backend Shell** | `docker compose exec backend bash` | Opens a bash shell inside the Django container |
| **Django Shell** | `docker compose exec backend python manage.py shell` | Opens an interactive Django Python shell |
| **Run Unit Tests** | `docker compose exec backend python manage.py test` | Runs the full automated test suite |
| **Django System Check** | `docker compose exec backend python manage.py check` | Validates settings and model integrity |
| **Migration Dry-Run** | `docker compose exec backend python manage.py makemigrations --dry-run` | Verifies migration consistency |
| **Reset Database** *(Destructive)* | `docker compose down -v` | Stops containers and deletes all persistent volume data |

---

## Data Persistence

- **Normal Restarts (`docker compose down` -> `docker compose up -d`)**:
  All database records (departments, users, books, borrow transactions, notifications) are stored in the named Docker volume `library_postgres_data` and **persist completely**.
- **Media Uploads**:
  Uploaded book thumbnails and files are preserved in the named Docker volume `library_media_data`.
- **Complete Reset (`docker compose down -v`)**:
  Using the `-v` flag deletes all Docker volumes, returning the database to an empty state.

---

## Testing & Verification Baseline

The backend test suite is verified inside the Docker container:
```bash
docker compose exec backend python manage.py test
```
- **Verified Baseline**: **104 / 104 tests passing (100% OK)** covering department authorization, student approval workflows, email OTP verification, dynamic category discovery, CSV catalog imports, ML recommendation algorithms, concurrency locking, and inventory management.

---

## Project Structure

```
Recommondation_system/
├── backend/
│   ├── accounts/               # User auth, departments, profiles, OTP, notifications
│   ├── analytics/              # Librarian & student dashboard statistics
│   ├── book_recommondation/    # Django project settings, WSGI, URLs, caching, health checks
│   ├── books/                  # Book catalog, CSV import, categories API, ML recommender
│   ├── borrows/                # Borrow lifecycle, atomic inventory locks, return ownership
│   ├── messaging/              # Internal messaging service
│   ├── data/                   # Initial CSV datasets (books_6k.csv)
│   ├── Dockerfile              # Python 3.13 backend container definition
│   ├── entrypoint.sh           # Automated migration, collectstatic & Gunicorn startup
│   ├── requirements.txt        # Backend dependencies
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components (Navbar, Modals, BookCards)
│   │   ├── pages/              # Views (Home, Catalog, Recommendations, ManageBooks)
│   │   └── services/           # API integration layer (api.js)
│   ├── Dockerfile              # Multi-stage Node 20 builder -> Nginx Alpine runtime
│   ├── nginx.conf              # Nginx SPA fallback routing and /api/ reverse proxy
│   ├── package.json            # Frontend dependencies
│   └── vite.config.js          # Vite build configuration
├── docker-compose.yml          # Docker Compose orchestration definition
├── DEPLOYMENT.md               # Complete production deployment & SSL guide
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignored files (.env, pycache, dist, etc.)
├── PROJECT_RULES.md            # System architecture and department security rules
└── README.md                   # Project documentation and startup guide
```

---

## Production Deployment

For complete step-by-step instructions on setting up a Linux server, SSL/HTTPS certificates, domain mapping, automated backups, and server sizing, see the dedicated [DEPLOYMENT.md](file:///home/sidhharth/sppu/git/Recommondation_system/DEPLOYMENT.md) guide.

### Quick Production Deployment Checklist:
1. Generate a strong cryptographic `DJANGO_SECRET_KEY`.
2. Set `DEBUG=False` and `DJANGO_ENV=production` in `.env`.
3. Configure `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` with your production domain name.
4. Set up SMTP email credentials (`EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`) in `.env` and `backend/.env`.
5. Terminate SSL/TLS with HTTPS (e.g. Let's Encrypt / Certbot / Cloudflare).
6. Launch services with `docker compose up --build -d`.

---

## Troubleshooting

### 1. Port 80 Already in Use
**Symptom**: `Error: failed to bind host port 0.0.0.0:80/tcp: address already in use`
**Solution**: Set `FRONTEND_PORT=8080` in your `.env` file and restart:
```bash
FRONTEND_PORT=8080 docker compose up -d
```
Access the application at `http://localhost:8080`.

### 2. Backend Cannot Connect to Database
**Symptom**: Gunicorn logs report database connection failures.
**Solution**: Verify that `library_db` is healthy:
```bash
docker compose ps
docker compose logs db
```
The backend automatically waits for PostgreSQL health before starting.

### 3. Missing OTP Code During Registration
**Symptom**: Registration requires a code, but no email is received.
**Solution**: In local development, check the backend container logs where OTP codes are printed:
```bash
docker compose logs -f backend
```

### 4. Clean Database Re-initialization
**Symptom**: Need to completely reset the database to a fresh state.
**Solution**:
```bash
docker compose down -v
docker compose up --build -d
```

---

## Security Best Practices

- **Never Commit `.env`**: Secrets, API keys, and database passwords must remain in your local `.env` file (which is ignored by `.gitignore`).
- **Cryptographic Keys**: Always generate unique secret keys for production deployments.
- **Department Isolation**: Authorization checks are enforced strictly by the backend API; client-side route filtering is never relied upon for security.
- **Database Boundary**: Database users and roles are managed independently by the database container; Django never executes root-level database creation SQL.

---

## License & Authors

Developed for the SPPU Academic Library System.
Maintained by Siddharth Ghode.
