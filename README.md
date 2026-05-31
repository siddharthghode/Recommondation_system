# Library Management System with Book Recommendations

A full-stack university library management web app with an intelligent book recommendation engine. Students browse and borrow books, librarians manage department-scoped requests, and admins oversee the entire system. Recommendations are powered by TF-IDF vectorisation, cosine similarity, and weighted collaborative filtering via scikit-learn.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 6.0.1 + Django REST Framework 3.16.1 |
| Auth | JWT via djangorestframework-simplejwt 5.5.1 |
| ML | scikit-learn 1.6.1, NumPy 2.4.1, Pandas 2.3.3 |
| Database | PostgreSQL |
| Frontend | React 19.2.0 + Vite |
| Routing | React Router 7.11.0 |
| Styling | Tailwind CSS 4.1.18 |
| Animations | Framer Motion 12.24.10 |
| Charts | Recharts 3.6.0 |

---

## Quick Start
#### Backend
```bash
Fresh Start
cd backend
chmod +x back_start.sh 
./back_start.sh      
this makes all tables and user in psql 

```

#### Frontend
```bash
chmod +x full_start.sh
./full_start.sh
this start backend and frontend
```
Open `http://localhost:5173` for backend

---

## Demo Credentials   [these are the demo users]
| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Librarian | `librarian_cs` | `test1234` |
| Student | `aarav_sharma` | `test1234` |
| Student | `priya_patil` | `test1234` |

## Fresh Setup (remove demo users)

**Step 1 — Clear demo data**
```bash
cd backend
source bookenv/bin/activate
python manage.py clear_users          # removes only demo users
# or: python manage.py clear_users --all   # removes every user
```

**Step 2 — Create your superuser (admin)**
```bash
python manage.py createsuperuser
# enter username, email, password when prompted
```
Then open `http://localhost:8000/admin`, find the new user → set `role = admin`.

**Step 3 — Create a Librarian**
In Django admin → Users → Add User:
- Set `role = librarian`
- Assign a `department`

**Step 4 — Students**
Students can self-register via the frontend login page, or you can create them in Django admin with `role = student`.

## Documentation

| File | Description |
|------|-------------|
| [BLUEPRINT_REPORT.md](./BLUEPRINT_REPORT.md) | Full technical architecture, algorithm deep-dives, deployment guide |
| [database/ER_DIAGRAM.md](./database/ER_DIAGRAM.md) | Entity relationships, constraints, cardinality |
| [backend/README.md](./backend/README.md) | Backend setup, API reference, management commands |
| [frontend/README.md](./frontend/README.md) | Frontend setup, routes, components, service layer |
