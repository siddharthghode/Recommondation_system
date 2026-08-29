# Backend — Django REST Framework

A high-performance Django REST Framework API powering role-based access control, strict department catalog scoping, student verification workflows, atomic borrow transactions, dwell-time analytics, and machine learning book recommendations.

---

## 🚀 Quick Setup

### Option 1: Using Docker Compose (Recommended)
From the root repository directory:
```bash
cp .env.example .env
docker compose up --build -d
docker compose exec backend python manage.py import_books
docker compose exec backend python manage.py seed_demo
```

### Option 2: Local Native Setup (Python Virtual Environment)
```bash
cd backend

# 1. Create and activate virtual environment
python3 -m venv bookenv
source bookenv/bin/activate          # Windows: bookenv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create .env file (optional, defaults are provided)
cp .env.example .env

# 4. Apply database migrations
python manage.py migrate

# 5. Import book catalogue (~6.8k books)
python manage.py import_books        # reads backend/data/books_6k.csv

# 6. Seed demo departments, users, borrow history & ML interactions
python manage.py seed_demo

# 7. Start Django development server
python manage.py runserver 0.0.0.0:8000
```

---

## 👥 Demo Users

| Username | Password | Role | Department / Scope |
|----------|----------|------|--------------------|
| `admin` | `admin123` | Admin / Superuser | Global system oversight & Django admin |
| `librarian_cs` | `test1234` | Librarian | Computer Science Department |
| `aarav_sharma` | `test1234` | Student | Computer Science (Approved) |
| `priya_patil` | `test1234` | Student | Computer Science (Approved) |
| `rohan_desai` | `test1234` | Student | Computer Science (Approved) |
| `sneha_kulkarni` | `test1234` | Student | Computer Science (Approved) |
| `vikram_joshi` | `test1234` | Student | Computer Science (Approved) |
| `ananya_mehta` | `test1234` | Student | Computer Science (Approved) |
| `karan_singh` | `test1234` | Student | Computer Science (Approved) |
| `pooja_nair` | `test1234` | Student | Computer Science (Approved) |
| `arjun_rao` | `test1234` | Student | Computer Science (Approved) |
| `divya_iyer` | `test1234` | Student | Computer Science (Approved) |

- **Django Admin Panel**: `http://localhost:8000/admin/`

---

## 🛠️ Management Commands

| Command | Description |
|---------|-------------|
| `import_books [path]` | Imports books from CSV; defaults to `data/books_6k.csv` (6,810 books). |
| `seed_demo` | Seeds CS department, admin, CS librarian, 10 demo students, 200 catalog assignments, 45 borrow records, 5 pending requests, and 200 ML interactions. |
| `seed_interactions [--count N]` | Generates N additional `BookInteraction` records (default: 500) for ML training. |
| `create_admin` | Creates or updates the production admin account using `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars. |

---

## 🧪 Testing

The backend includes test suites verified with both Django's built-in test runner and Pytest:

```bash
# Run Django test runner (105 tests)
python manage.py test

# Run Pytest suite (125 tests)
pytest -q
```

---

## 🔑 Environment Variables

Configure `backend/.env` or root `.env`:

| Variable | Default (Local) | Default (Docker) | Description |
|---|---|---|---|
| `POSTGRES_DB` | `library_db` | `library_db` | PostgreSQL database name |
| `POSTGRES_USER` | `library_user` | `library_user` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `StrongPass@123` | `StrongPass@123` | PostgreSQL password |
| `POSTGRES_HOST` | `127.0.0.1` | `db` | Database hostname |
| `POSTGRES_PORT` | `5432` | `5432` | Database port |
| `DEBUG` | `True` | `False` | Django debug mode |
| `DJANGO_SECRET_KEY` | *(dev insecure key)* | *(docker key)* | Cryptographic key (**required in production**) |
| `DJANGO_ENV` | `development` | `production` | Enforces production secret checks when `production` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | `localhost,127.0.0.1,backend,frontend` | Allowed Host header values |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | `http://localhost,http://localhost:80` | Allowed CORS origins |
| `EMAIL_BACKEND` | `console.EmailBackend` | `console.EmailBackend` | Set to `smtp.EmailBackend` for live SMTP |

---

## 📦 Django App Architecture

| App | Purpose |
|-----|---------|
| `accounts` | Custom `User` model (student/librarian/admin), `UserProfile`, `Department`, `Notification`, OTP verification, JWT auth |
| `books` | Book catalog CRUD, search/filter, category extraction, CSV imports, TF-IDF cosine similarity, ML hybrid recommender |
| `borrows` | Borrow lifecycle (request → approve/reject → return), atomic concurrency stock locks (`select_for_update`) |
| `analytics` | Librarian and student dashboard metrics, borrowing trends, top books, reading statistics |
| `messaging` | Internal messaging API (`/api/messages/`) |

---

## 📡 REST API Reference

All protected endpoints require `Authorization: Bearer <access_token>` header.

### Health Check
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health/` | Public | Backend health status (`{"status": "healthy"}`) |

### Authentication & Profiles — `/api/auth/`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/otp/request/` | Public | Request 6-digit email OTP for student registration |
| `POST` | `/api/auth/otp/verify/` | Public | Verify OTP and obtain verification token |
| `POST` | `/api/auth/register/` | Public | Student self-registration (with OTP token) |
| `POST` | `/api/auth/login/` | Public | Login; returns JWT `access`, `refresh`, and user `role` |
| `POST` | `/api/auth/google/` | Public | Google OAuth login / registration |
| `GET` | `/api/auth/departments/` | Public | List active academic departments |
| `GET` | `/api/auth/me/` | Authenticated | Get current authenticated user profile |
| `PUT` | `/api/auth/me/` | Authenticated | Update user profile |
| `POST` | `/api/auth/refresh/` | Public | Refresh JWT access token |
| `GET` | `/api/auth/notifications/` | Authenticated | List user notifications |
| `POST` | `/api/auth/notifications/mark-read/` | Authenticated | Mark single notification as read |
| `POST` | `/api/auth/notifications/mark-all-read/` | Authenticated | Mark all notifications as read |

### Books & Recommendations — `/api/books/`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/books/` | Public | List/search books (`?search=&category=&page=&page_size=`) |
| `GET` | `/api/books/categories/` | Public | Dynamic category list (`?department=`) |
| `GET` | `/api/books/<id>/` | Public | Retrieve book details |
| `GET` | `/api/books/<id>/similar/` | Public | TF-IDF content similarity recommendations |
| `GET` | `/api/books/recommendations/` | Authenticated | Personalized recommendations (`?type=hybrid\|content\|interaction&limit=N`) |
| `POST` | `/api/books/import/` | Librarian/Admin | Bulk import books from CSV with department scoping |
| `POST` | `/api/books/manage/` | Librarian/Admin | Create new book in department |
| `PUT` | `/api/books/manage/<id>/` | Librarian/Admin | Update book details |
| `DELETE` | `/api/books/manage/<id>/` | Librarian/Admin | Delete book |

### Interactions & Dwell Time
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/interactions/` | Authenticated | Record book interaction (`view`, `like`, `borrow`) |
| `POST` | `/api/dwell-time/` | Authenticated | Record time spent viewing a book (seconds) |

### Borrow Management — `/api/borrows/`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/borrows/request/` | Student | Request book loan |
| `GET` | `/api/borrows/my/` | Authenticated | Student's active and historical borrow records |
| `GET` | `/api/borrows/pending/` | Librarian/Admin | Pending borrow requests for department |
| `POST` | `/api/borrows/approve/<id>/` | Librarian/Admin | Atomically approve borrow and decrement inventory |
| `POST` | `/api/borrows/reject/<id>/` | Librarian/Admin | Reject borrow request with optional reason |
| `POST` | `/api/borrows/return/` | Student | Return active borrowed book |

### Analytics & Reports — `/api/analytics/`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/analytics/librarian-dashboard/` | Librarian/Admin | Department borrowing metrics and overview |
| `GET` | `/api/analytics/students/` | Librarian/Admin | List department students and approval status |
| `GET` | `/api/analytics/students/<id>/recommendations/` | Librarian/Admin | Recommendations for specific student |
| `GET` | `/api/analytics/students/<id>/borrows/` | Librarian/Admin | Borrow history for specific student |
| `GET` | `/api/analytics/students/<id>/analytics/` | Librarian/Admin | Interaction analytics for specific student |

---

## 🔒 Security Highlights

- **Department Scoping**: Librarians and students only interact with data matching their assigned department.
- **Concurrency Protection**: Stock modifications utilize Django's `select_for_update()` transaction locks to eliminate race conditions.
- **Argon2 Password Hashing**: State-of-the-art memory-hard hashing with fallback to PBKDF2.
- **Stateless JWT**: Short-lived access tokens (60 min) with refresh rotation.