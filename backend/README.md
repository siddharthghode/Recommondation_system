# Backend — Django REST Framework

## Requirements

- Python 3.11+ (developed on 3.13)
- SQLite (built-in, no setup required)

---

## Setup

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv bookenv
source bookenv/bin/activate          # Windows: bookenv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Apply migrations
python manage.py migrate

# 4. Import book catalogue (~6k books)
python manage.py import_books        # reads data/books_6k.csv

# 5. Seed demo data (users + borrow history + interactions)
python manage.py seed_demo

# 6. Start server
python manage.py runserver 0.0.0.0:8000
```

---

## Demo Users

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin / Superuser |
| `librarian_cs` | `test1234` | Librarian (CS dept) |
| `aarav_sharma` | `test1234` | Student |
| `priya_patil` | `test1234` | Student |
| `rohan_desai` | `test1234` | Student |
| `sneha_kulkarni` | `test1234` | Student |
| `vikram_joshi` | `test1234` | Student |
| `ananya_mehta` | `test1234` | Student |
| `karan_singh` | `test1234` | Student |
| `pooja_nair` | `test1234` | Student |
| `arjun_rao` | `test1234` | Student |
| `divya_iyer` | `test1234` | Student |

Django admin panel: `http://localhost:8000/admin`

---

## Management Commands

| Command | Description |
|---------|-------------|
| `seed_demo` | Creates all demo users, assigns 200 books to CS dept, seeds borrow history (45 records), 5 pending requests, 200 ML interactions |
| `import_books [path]` | Imports books from CSV; defaults to `data/books_6k.csv` |
| `seed_interactions [--count N]` | Generates N additional `BookInteraction` records (default: 500) |

### What `seed_demo` creates

- 1 admin, 1 librarian (CS dept), 10 students with real Indian names
- All students assigned to Computer Science department with student IDs `CS2021001–CS2021010`
- 200 random books from the catalogue assigned to CS department
- 45 borrow history records (70% returned, 30% active) spread over last 60 days
- 5 pending borrow requests (10–300 minutes old) for the librarian dashboard
- 200 ML interactions (view/like/borrow weighted 65/25/10) for recommendation engine

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Django security (required in production)
DJANGO_SECRET_KEY=your-secret-key-here
JWT_SIGNING_KEY=your-jwt-signing-key-here
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | insecure dev key | **Must be set in production** |
| `JWT_SIGNING_KEY` | falls back to `SECRET_KEY` | Separate JWT signing key (recommended) |

`python-dotenv` loads this file automatically via `load_dotenv()` in `settings.py`.

---

## Django Apps

| App | Responsibility |
|-----|---------------|
| `accounts` | Custom `User` model (student/librarian/admin), `UserProfile`, `Department`, `Notification`; JWT login & register |
| `books` | Book CRUD, search/filter/pagination, interaction tracking (view/like/borrow), dwell-time, TF-IDF recommendation engine |
| `borrows` | Borrow lifecycle: request → approve/reject → return; atomic stock management with `select_for_update()` |
| `analytics` | Librarian/admin dashboard stats, per-student borrows and analytics |
| `messaging` | ~~Removed~~ — messaging feature has been removed from the project |

---

## API Reference

All endpoints require `Authorization: Bearer <access_token>` unless marked **public**.

### Auth — `/api/auth/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register/` | public | Register new student |
| `POST` | `/api/auth/login/` | public | Login; returns `access`, `refresh`, `role` |
| `GET` | `/api/auth/me/` | required | Get current user profile |
| `PUT` | `/api/auth/me/` | required | Update profile (first_name, last_name, email, department, year, student_id, preferred_categories) |
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
| `POST` | `/api/books/manage/` | librarian/admin | Create book |
| `PUT` | `/api/books/manage/<id>/` | librarian/admin | Update book |
| `DELETE` | `/api/books/manage/<id>/` | librarian/admin | Delete book |

### Interactions & Dwell-Time

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/interactions/` | required | Create `BookInteraction` (`view`, `like`, `borrow`) |
| `POST` | `/api/dwell-time/` | required | Record time spent on a book page (seconds) |

### Borrows — `/api/borrows/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/borrows/request/` | student | Request to borrow a book |
| `GET` | `/api/borrows/my/` | required | Current user's borrow history (`?status=`) |
| `GET` | `/api/borrows/pending/` | librarian/admin | Pending requests (dept-scoped for librarians) |
| `POST` | `/api/borrows/approve/<id>/` | librarian/admin | Approve; atomically decrements stock via `select_for_update()` |
| `POST` | `/api/borrows/reject/<id>/` | librarian/admin | Reject with optional reason; notifies student |
| `POST` | `/api/borrows/return/` | student | Return a borrowed book |

### Analytics — `/api/analytics/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/analytics/librarian-dashboard/` | librarian/admin | Dashboard stats (dept-scoped or global) |
| `GET` | `/api/analytics/students/` | librarian/admin | Student list (dept-scoped for librarians) |
| `GET` | `/api/analytics/students/<id>/recommendations/` | librarian/admin | Recommendations for a student |
| `GET` | `/api/analytics/students/<id>/borrows/` | librarian/admin | Borrow history for a student |
| `GET` | `/api/analytics/students/<id>/analytics/` | librarian/admin | Interaction analytics for a student |


## Key Settings (`book_recommondation/settings.py`)

| Setting | Value |
|---------|-------|
| `AUTH_USER_MODEL` | `accounts.User` |
| `DATABASE ENGINE` | `django.db.backends.sqlite3` → `db.sqlite3` |
| `DEFAULT_AUTHENTICATION_CLASSES` | `JWTAuthentication` |
| `DEFAULT_PERMISSION_CLASSES` | `IsAuthenticated` |
| `ACCESS_TOKEN_LIFETIME` | 60 minutes |
| `REFRESH_TOKEN_LIFETIME` | 1 day |
| `PASSWORD_HASHERS` | Argon2 (preferred) → PBKDF2 → BCrypt |
| `CORS_ALLOWED_ORIGINS` | `localhost:5173`, `127.0.0.1:5173` |

---

## Database Reset

To fully reset and reseed:

```bash
rm db.sqlite3
python manage.py migrate
python manage.py import_books
python manage.py seed_demo
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

- [ ] Set `DJANGO_SECRET_KEY` to a secure random value
- [ ] Set `DEBUG = False`
- [ ] Set `ALLOWED_HOSTS` to your production domain
- [ ] Update `CORS_ALLOWED_ORIGINS` to production frontend URL
- [ ] Switch `DATABASE` to PostgreSQL + install `psycopg2-binary`
- [ ] Run `python manage.py collectstatic`
- [ ] Serve with Gunicorn behind Nginx
- [ ] Enable HTTPS and set `SECURE_SSL_REDIRECT = True`
- [ ] Set `JWT_SIGNING_KEY` separately from `SECRET_KEY`
