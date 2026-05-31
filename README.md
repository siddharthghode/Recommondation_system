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

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Student | `aarav_sharma` | `test1234` |
| Student | `priya_patil` | `test1234` |
| Librarian | `librarian_cs` | `test1234` |
| Admin | `admin` | `admin123` |

> All 10 seeded students use password `test1234`. See `seed_demo` output for full list.

Django admin panel: `http://localhost:8000/admin`


## Documentation

| File | Description |
|------|-------------|
| [BLUEPRINT_REPORT.md](./BLUEPRINT_REPORT.md) | Full technical architecture, algorithm deep-dives, deployment guide |
| [database/ER_DIAGRAM.md](./database/ER_DIAGRAM.md) | Entity relationships, constraints, cardinality |
| [backend/README.md](./backend/README.md) | Backend setup, API reference, management commands |
| [frontend/README.md](./frontend/README.md) | Frontend setup, routes, components, service layer |
