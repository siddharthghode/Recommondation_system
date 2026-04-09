# Library Management System with Book Recommendations

A full-stack library management web app with an intelligent book recommendation engine. Students browse and borrow books, librarians manage department requests, and admins oversee the entire system. Recommendations are powered by TF-IDF vectorisation, cosine similarity, and weighted collaborative filtering via scikit-learn.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 6.0.1 + Django REST Framework 3.16.1 |
| Auth | JWT via djangorestframework-simplejwt 5.5.1 |
| ML | scikit-learn 1.6.1, NumPy 2.4.1, Pandas 2.3.3 |
| Database | SQLite (dev) → PostgreSQL (prod) |
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
python manage.py seed_demo
python manage.py ensure_profiles
python manage.py import_books          # imports ~6k books from data/books_6k.csv
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
| Student | `student1` | `test1234` |
| Librarian | `librarian_cs` | `test1234` |
| Admin | `admin` | `admin123` |

Django admin panel: `http://localhost:8000/admin`

---

## Features

### Students
- Register and log in with JWT authentication
- Browse, search, and filter the book catalogue
- View book details with "Because You Read…" similar-book suggestions
- Get personalised recommendations (content-based, collaborative, hybrid)
- Request and return books; track borrow history
- Manage account details and preferred categories
- In-app notifications and messaging

### Librarians
- Department-scoped dashboard with borrow stats, top books, and active students
- Approve or reject borrow requests from their department
- Manage books (create, update, delete)
- View and filter students in their department

### Admins
- Full system access across all departments
- Dedicated admin dashboard, book management, and student management pages
- Global analytics

---

## Project Structure

```
Book_Recommondation_System/
├── backend/
│   ├── accounts/           # User auth, profiles, departments, notifications
│   ├── books/              # Book CRUD, interactions, dwell-time, recommender
│   │   └── services/recommender.py
│   ├── borrows/            # Borrow request → approve/reject → return
│   ├── analytics/          # Dashboard stats, per-student analytics
│   ├── messaging/          # Inter-user messaging (DRF ViewSet)
│   ├── book_recommondation/ # Django project settings & root URLs
│   ├── qa_tests/           # E2E test scripts
│   ├── data/books_6k.csv
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/          # Home, Books, Recommendations, MyBorrows,
│       │                   # LibrarianDashboard, AdminDashboard, Messages…
│       ├── components/     # BookCard, BookDetail, Navbar, Sidebar,
│       │                   # Notifications, InterestSelector, Toast…
│       └── services/api.js # All API calls + auto token-refresh
├── database/ER_DIAGRAM.md
├── ARCHITECTURE.md
├── API_DOCUMENTATION.md
├── SECURITY.md
└── SETUP_INSTRUCTIONS.md
```

---

## Documentation

| File | Description |
|------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, data flow, recommendation algorithms |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | Full API reference with request/response examples |
| [SECURITY.md](./SECURITY.md) | Security measures and production hardening checklist |
| [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) | Detailed setup and troubleshooting guide |
| [backend/README.md](./backend/README.md) | Backend-specific setup and API reference |
| [frontend/README.md](./frontend/README.md) | Frontend-specific setup and component reference |
