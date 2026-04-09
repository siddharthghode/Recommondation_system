# Backend — Django REST Framework

## Requirements

- Python 3.11+ (developed on 3.13)
- PostgreSQL 12+ (production database)
- Virtualenv recommended

---

## Database Setup (PostgreSQL)

Before running Django, ensure PostgreSQL is installed and running:

```bash
# macOS (via Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows
# Download and install from https://www.postgresql.org/download/windows/
```

Create a database and user:

```bash
createdb library_erp
createuser library_user
psql -c "ALTER USER library_user WITH PASSWORD 'StrongPass@123';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE library_erp TO library_user;"
```

---

## Setup

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv bookenv
source bookenv/bin/activate          # Windows: bookenv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment variables
# Copy/create .env file with PostgreSQL credentials (see Environment Variables section)

# 4. Apply migrations and import books 
python manage.py migrate
python manage.py import_books        # imports ~6k books from data/books_6k.csv

# 5. Seed demo data
python manage.py seed_demo           # creates demo users
python manage.py ensure_profiles     # creates UserProfile for all students

# 6. (Optional) Generate fake interactions for testing recommendations
python manage.py seed_interactions   # default: 500 interactions

# 7. Start server
python manage.py runserver 0.0.0.0:8000
```

---

## Demo Users

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin / Superuser |
| `librarian_cs` | `test1234` | Librarian (CS dept) |
| `student1` | `test1234` | Student |

Django admin panel: `http://localhost:8000/admin`

---

## Management Commands

| Command | Description |
|---------|-------------|
| `seed_demo` | Creates demo users (admin, librarian, student) |
| `ensure_profiles` | Creates missing `UserProfile` for all student accounts |
| `import_books [path]` | Imports books from CSV; defaults to `data/books_6k.csv` |
| `seed_interactions [--count N]` | Generates N fake `BookInteraction` records (default: 500) |

---

## Environment Variables

Create a `.env` file in the `backend/` directory with the following PostgreSQL configuration:

```env
# Database configuration (required)
POSTGRES_DB=library_erp
POSTGRES_USER=library_user
POSTGRES_PASSWORD=StrongPass@123
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

# Security (required in production)
DJANGO_SECRET_KEY=your-secret-key-here
JWT_SIGNING_KEY=your-jwt-key-here
```

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | library_erp | Database name |
| `POSTGRES_USER` | library_user | PostgreSQL user |
| `POSTGRES_PASSWORD` | *(required)* | PostgreSQL password (must be set) |
| `POSTGRES_HOST` | 127.0.0.1 | PostgreSQL host |
| `POSTGRES_PORT` | 5432 | PostgreSQL port |
| `DJANGO_SECRET_KEY` | insecure dev key | **Must be set in production** |
| `JWT_SIGNING_KEY` | falls back to `SECRET_KEY` | Separate JWT signing key |

`python-dotenv` loads this file automatically via `load_dotenv()` in `settings.py`.

---

## Django Apps

| App | Responsibility |
|-----|---------------|
| `accounts` | Custom `User` model (student/librarian/admin), `UserProfile`, `Department`, `Notification`; JWT login & register |
| `books` | Book CRUD, search/filter/pagination, interaction tracking (view/like/borrow), dwell-time recording, recommendation engine |
| `borrows` | Borrow lifecycle: request → approve/reject → return; atomic stock management with `select_for_update()` |
| `analytics` | Librarian/admin dashboard stats, per-student borrows and analytics |
| `messaging` | Inter-user messaging via DRF `ModelViewSet` |

---

## API Reference

All endpoints require `Authorization: Bearer <access_token>` unless marked **public**.

### Auth — `/api/auth/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register/` | public | Register new student |
| `POST` | `/api/auth/login/` | public | Login; returns `access`, `refresh`, `role` |
| `GET/PUT` | `/api/auth/me/` | required | Get or update current user profile |
| `POST` | `/api/auth/refresh/` | public | Refresh access token |
| `GET` | `/api/auth/notifications/` | required | List notifications (`?is_read=true/false`) |
| `POST` | `/api/auth/notifications/mark-read/` | required | Mark one notification read |
| `POST` | `/api/auth/notifications/mark-all-read/` | required | Mark all notifications read |

### Books — `/api/books/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/books/` | public | List/search books (`?search=&category=&page=&page_size=`) |
| `GET` | `/api/books/<id>/` | public | Book detail |
| `GET` | `/api/books/<id>/similar/` | public | TF-IDF similar books (cached 10 min) |
| `GET` | `/api/books/recommendations/` | required | Personalised recommendations (`?type=hybrid\|content\|interaction&limit=N`) |
| `POST` | `/api/books/track/<id>/` | required | Record a view interaction |
| `POST` | `/api/books/manage/` | admin/librarian | Create book |
| `PUT` | `/api/books/manage/<id>/` | admin/librarian | Update book |
| `DELETE` | `/api/books/manage/<id>/` | admin/librarian | Delete book |

### Interactions & Dwell-Time

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/interactions/` | required | Create `BookInteraction` (`view`, `like`, `borrow`) |
| `POST` | `/api/dwell-time/` | required | Record time spent on a book page |

### Borrows — `/api/borrows/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/borrows/request/` | student | Request to borrow a book |
| `GET` | `/api/borrows/my/` | required | Current user's borrow history (`?status=`) |
| `GET` | `/api/borrows/pending/` | librarian/admin | Pending requests (dept-scoped for librarians) |
| `POST` | `/api/borrows/approve/<id>/` | librarian/admin | Approve; atomically decrements stock |
| `POST` | `/api/borrows/reject/<id>/` | librarian/admin | Reject with optional reason |

### Analytics — `/api/analytics/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/analytics/librarian-dashboard/` | librarian/admin | Dashboard stats (dept-scoped or global) |
| `GET` | `/api/analytics/students/` | librarian/admin | Student list (dept-scoped for librarians) |
| `GET` | `/api/analytics/students/<id>/recommendations/` | librarian/admin | Recommendations for a student |
| `GET` | `/api/analytics/students/<id>/borrows/` | librarian/admin | Borrow history for a student |
| `GET` | `/api/analytics/students/<id>/analytics/` | librarian/admin | Interaction analytics for a student |

### Messaging — `/api/messages/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/messages/` | List or send messages |
| `GET/PUT/DELETE` | `/api/messages/<id>/` | Retrieve, update, or delete a message |

---

## Key Settings (`book_recommondation/settings.py`)

| Setting | Value |
|---------|-------|
| `AUTH_USER_MODEL` | `accounts.User` |
| `DEFAULT_AUTHENTICATION_CLASSES` | `JWTAuthentication` |
| `DEFAULT_PERMISSION_CLASSES` | `IsAuthenticated` |
| `ACCESS_TOKEN_LIFETIME` | 60 minutes |
| `REFRESH_TOKEN_LIFETIME` | 1 day |
| `PASSWORD_HASHERS` | Argon2 (preferred) → PBKDF2 → BCrypt |
| `CORS_ALLOWED_ORIGINS` | `localhost:5173`, `127.0.0.1:5173` |

---

## Migrations

If migration files are missing (fresh clone or reset):

```bash
python manage.py makemigrations accounts books borrows messaging
python manage.py migrate
```

To fully reset the database (PostgreSQL):

```bash
# Drop and recreate the database
dropdb -U library_user library_erp
createdb -U library_user library_erp

# Reapply all migrations
python manage.py migrate

# Seed with demo data
python manage.py seed_demo && python manage.py ensure_profiles
python manage.py import_books
```

---

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| Django | 6.0.1 | Web framework |
| djangorestframework | 3.16.1 | REST API |
| djangorestframework-simplejwt | 5.5.1 | JWT authentication |
| django-cors-headers | 4.0.0 | CORS |
| scikit-learn | 1.6.1 | TF-IDF, cosine similarity |
| NumPy | 2.4.1 | Vectorisation |
| Pandas | 2.3.3 | CSV import, data processing |
| argon2-cffi | 23.1.0 | Argon2 password hashing |
| python-dotenv | 1.2.1 | `.env` file support |
| Faker | 25.8.0 | Seed data generation |

---

## Production Checklist

- [ ] Set `DJANGO_SECRET_KEY` to a secure random value in environment
- [ ] Set `DEBUG = False`
- [ ] Set `ALLOWED_HOSTS` to your production domain
- [ ] Update `CORS_ALLOWED_ORIGINS` to production frontend URL
- [ ] Switch database to PostgreSQL
- [ ] Run `python manage.py collectstatic`
- [ ] Serve with Gunicorn behind Nginx
- [ ] Enable HTTPS and set `SECURE_SSL_REDIRECT = True`
- [ ] Optionally set `JWT_SIGNING_KEY` separately from `SECRET_KEY`
