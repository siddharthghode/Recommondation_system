# Library Management System with Book Recommendations

A full-stack university library management web app with an intelligent book recommendation engine. Students browse and borrow books, librarians manage department-scoped requests, and admins oversee the entire system. Recommendations are powered by TF-IDF vectorisation, cosine similarity, and weighted collaborative filtering via scikit-learn.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 6.0.1 + Django REST Framework 3.16.1 |
| Auth | JWT via djangorestframework-simplejwt 5.5.1 |
| ML | scikit-learn 1.6.1, NumPy 2.4.1, Pandas 2.3.3 |
| Database | SQLite (dev) |
| Frontend | React 19.2.0 + Vite |
| Routing | React Router 7.11.0 |
| Styling | Tailwind CSS 4.1.18 |
| Animations | Framer Motion 12.24.10 |
| Charts | Recharts 3.6.0 |

---

## Quick Start

### Backend
```bash
cd backend
python -m venv bookenv && source bookenv/bin/activate   # Windows: bookenv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py import_books          # imports ~6k books from data/books_6k.csv
python manage.py seed_demo             # creates users, assigns books to dept, seeds borrows
python manage.py runserver 0.0.0.0:8000
```

### Frontend
```bash
# in a new terminal
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Student | `aarav_sharma` | `test1234` |
| Student | `priya_patil` | `test1234` |
| Librarian | `librarian_cs` | `test1234` |
| Admin | `admin` | `admin123` |

> All 10 seeded students use password `test1234`. See `seed_demo` output for full list.

Django admin panel: `http://localhost:8000/admin`

---

## Features

### Students
- Register and log in with JWT authentication
- Browse, search, filter, and paginate the book catalogue (6k+ books)
- View book details with "Because You Read…" TF-IDF similar-book suggestions
- Get personalised recommendations (content-based, collaborative, hybrid)
- Request and return books; track borrow history with status
- Edit account details and preferred categories
- In-app notifications

### Librarians
- Action-first dashboard: pending borrow requests with inline approve/reject
- Department-scoped stats (books, students, active borrows, borrow trends)
- Approve requests with atomic stock decrement (`select_for_update`)
- Reject requests with optional reason (student notified automatically)
- Manage books (create, update, delete)
- View students in their department

### Admins
- Full system access across all departments
- Admin dashboard, book management, and student management
- Global analytics

---

## Project Structure

```
Book_Recommondation_System/
├── backend/
│   ├── accounts/           # User, UserProfile, Department, Notification; JWT auth
│   │   └── management/commands/seed_demo.py
│   ├── books/              # Book CRUD, interactions, dwell-time, recommender
│   │   ├── services/recommender.py   # TF-IDF, cosine similarity, hybrid engine
│   │   └── management/commands/import_books.py
│   ├── borrows/            # Borrow lifecycle: requested → approved → returned/rejected
│   ├── analytics/          # Librarian/admin dashboard stats
│   ├── messaging/          # Inter-user messaging (DRF ViewSet)
│   ├── book_recommondation/ # Django project settings & root URLs
│   ├── qa_tests/           # E2E test scripts
│   ├── data/books_6k.csv
│   ├── db.sqlite3
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/          # Home, Books, Recommendations, MyBorrows,
│       │                   # LibrarianDashboard, AdminDashboard…
│       ├── components/     # BookCard, BookDetail, Navbar, ProtectedRoute,
│       │                   # Notifications, InterestSelector, Toast…
│       │   └── dashboard/  # LibrarianDashboard (action-first, real data)
│       └── services/api.js # All API calls + auto token-refresh
├── database/ER_DIAGRAM.md
├── BLUEPRINT_REPORT.md     # Full technical architecture reference
├── backend/README.md       # Backend setup, API reference, env vars
└── frontend/README.md      # Frontend setup, routes, components
```

---

## Documentation

| File | Description |
|------|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Step-by-step production deployment guide (Nginx, Gunicorn, PostgreSQL, SSL) |
| [BLUEPRINT_REPORT.md](./BLUEPRINT_REPORT.md) | Full technical architecture, algorithm deep-dives, deployment guide |
| [database/ER_DIAGRAM.md](./database/ER_DIAGRAM.md) | Entity relationships, constraints, cardinality |
| [backend/README.md](./backend/README.md) | Backend setup, API reference, management commands |
| [frontend/README.md](./frontend/README.md) | Frontend setup, routes, components, service layer |
