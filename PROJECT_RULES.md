# Library Management & Book Recommendation System — Project Contract

## 1. Project Goal

This project is a single Django + React application for managing a multi-department library and providing department-scoped book recommendations.

The project must remain:

* simple
* maintainable
* Docker-first
* PostgreSQL-based
* deployable
* easy to explain in an interview
* reliable rather than over-engineered

The final architecture is:

```text
React + Vite
      ↓
Django REST Framework
      ↓
PostgreSQL
```

All services must eventually run through Docker Compose.

---

# 2. Core Business Workflow

The application has exactly three primary roles:

```text
SUPER ADMIN
LIBRARIAN
STUDENT
```

## Super Admin

On a fresh database:

```text
Create initial super admin
        ↓
Super admin logs in
        ↓
Creates departments
        ↓
Creates/approves librarians
        ↓
Assigns each librarian to a department
```

Super admin has global administrative authority.

---

# 3. Librarian Workflow

A librarian belongs to exactly one department.

A librarian can:

* log in
* view their department dashboard
* view/manage books belonging to their department
* import one CSV catalog for their department
* view pending student registrations for their department
* approve/reject students belonging to their department
* view/manage borrow requests for their department
* approve/reject borrow requests
* handle return/deposit workflow
* view relevant department analytics

A librarian MUST NOT access or modify another department's resources.

Department authorization must be enforced by the Django backend.

Frontend filtering alone is never considered security.

---

# 4. Student Registration

Students can register through:

### Email OTP

```text
Email
 ↓
OTP
 ↓
OTP verification
 ↓
Department selection
 ↓
PENDING approval
```

### Google OAuth

```text
Google authentication
 ↓
Department selection
 ↓
PENDING approval
```

A newly registered student MUST NOT become an approved student automatically.

Student states:

```text
pending
approved
rejected
```

Only approved students can access protected library functionality.

---

# 5. Student Workflow

An approved student can:

* log in
* view their department
* browse books
* search books
* view book details
* receive recommendations
* request books
* receive borrow notifications
* return books
* complete deposit-related workflow

Students MUST ONLY see books belonging to their department.

Students MUST NOT be able to bypass department restrictions through:

* query parameters
* book IDs
* API manipulation
* frontend modifications
* direct API requests

---

# 6. Department Isolation — Critical Security Rule

Every resource that belongs to a department must be checked against the authenticated user's department.

This includes:

```text
Books
Students
Borrow requests
Recommendations
Book interactions
Librarian dashboards
Analytics
CSV imports
```

For example:

```text
Student A → Department A
```

must never receive:

```text
Department B books
Department B recommendations
Department B borrow information
```

Similarly:

```text
Librarian A → Department A
```

must never modify:

```text
Department B books
Department B students
Department B borrow requests
```

Authorization MUST be implemented server-side.

---

# 7. Book CSV Import

The required workflow is:

```text
Librarian
   ↓
Upload CSV
   ↓
Backend validates CSV
   ↓
Backend derives department from authenticated librarian
   ↓
Books created/updated
   ↓
Books belong to librarian's department
```

The client must NOT be trusted to choose an arbitrary department.

Normal imports must NOT delete the entire database.

If replacement behavior is required, it must require an explicit destructive option.

---

# 8. Borrow Workflow

The workflow is:

```text
Student requests book
        ↓
Librarian reviews request
        ↓
Approve / Reject
        ↓
If approved:
    stock decreases atomically
        ↓
Student receives notification
        ↓
Student returns book
        ↓
stock increases atomically
        ↓
notification
```

Existing transaction/row-lock logic must be preserved unless there is a demonstrated bug.

Do not remove `transaction.atomic()` or `select_for_update()` from inventory operations without a replacement that provides equivalent safety.

---

# 9. Recommendation System

The recommendation system is an important project feature.

Keep the working recommendation pipeline.

Preferred architecture:

```text
Content-based
    TF-IDF
    +
Cosine Similarity

Collaborative Filtering
    +
Hybrid Recommendation
```

Recommendations MUST be department-scoped.

A student in Department A must not receive recommendations for books in Department B.

Do not add unnecessary ML frameworks.

Do not introduce additional recommendation algorithms unless they solve an actual problem.

Dead SVD/matrix-factorization code should not be retained merely for complexity.

---

# 10. Authentication

Authentication should remain simple.

Required:

```text
JWT
Email OTP
Google OAuth
Role-based authorization
Department-based authorization
Student approval state
```

Do not introduce another authentication system unless required.

The backend is authoritative for:

* role
* department
* approval state
* permissions

Never trust frontend role selection.

---

# 11. API Change Rule

Every backend feature change MUST be reviewed end-to-end.

When changing a feature, inspect all potentially affected layers:

```text
Model
 ↓
Migration
 ↓
Serializer
 ↓
Permission
 ↓
View / ViewSet
 ↓
URL
 ↓
API response
 ↓
Frontend API service
 ↓
Frontend component/page
 ↓
Authentication
 ↓
Department authorization
 ↓
Tests
```

If a layer is not affected, explicitly verify why it is not affected.

Never modify only the obvious file and assume the feature is complete.

---

# 12. API Contract Rule

Before changing an existing API:

1. Find all backend consumers.
2. Find all frontend consumers.
3. Find all tests.
4. Check serializers and response shapes.
5. Check authentication requirements.
6. Check department authorization.
7. Check whether the endpoint is documented.

Do not silently break an existing endpoint.

If an API must change, update all consumers in the same task.

---

# 13. Database Rules

PostgreSQL is the only intended database.

Do not add SQLite support.

Docker/PostgreSQL is responsible for:

```text
PostgreSQL server
Database
Database user
Database password
Initial database permissions
```

Django migrations are responsible for:

```text
Tables
Columns
Foreign keys
Indexes
Constraints
Schema changes
```

Do NOT put PostgreSQL user/database creation inside:

```text
manage.py
Django views
Django models
Django migrations
```

Migration files are source code and must be committed to Git.

Never automatically run `makemigrations` during application startup.

Startup should run:

```bash
python manage.py migrate
```

---

# 14. Data Initialization

Separate infrastructure from application data.

Infrastructure:

```text
PostgreSQL
Database
Database user
```

Application initialization:

```text
Migrations
Initial super admin
```

Optional demo data must be clearly separated from real application setup.

Initialization commands must be idempotent.

Running them twice must not create duplicates or destroy data.

---

# 15. Startup Rules

Normal startup must NOT:

* delete the database
* delete books
* delete users
* recreate the super admin
* recreate migrations
* wipe application data

Normal startup should be safe to run repeatedly.

Fresh setup:

```bash
./start.sh
```

Normal development:

```bash
docker compose up
```

Database reset:

```bash
./reset.sh
```

Reset is the only workflow allowed to intentionally destroy the PostgreSQL volume.

---

# 16. Docker Rules

Final architecture:

```text
docker-compose.yml

├── db
│   └── PostgreSQL
│
├── backend
│   └── Django
│
└── frontend
    └── React/Vite
```

Do not introduce:

* Kubernetes
* microservices
* Redis
* Celery
* Kafka
* RabbitMQ

unless the existing project genuinely requires them.

Inside Docker:

```text
backend → db:5432
frontend → backend:8000
```

Do NOT assume `localhost` refers to another container.

Use Docker Compose service names for container-to-container communication.

---

# 17. Code Simplification Rule

Before adding code, check whether existing code already solves the problem.

Prefer:

```text
simple existing solution
```

over:

```text
new abstraction
```

Avoid:

* duplicate services
* duplicate serializers
* duplicate views
* unnecessary repositories
* unnecessary factories
* unnecessary utility layers
* unnecessary state-management systems
* unnecessary dependencies

Delete genuinely dead code.

Do not preserve dead code merely because it might be useful someday.

---

# 18. Feature Freeze

MUST HAVE:

```text
Super Admin
Departments
Librarians
Department isolation
Student approval
Email OTP
Google OAuth
CSV book import
Book browsing/search
Hybrid recommendations
Borrow workflow
Return workflow
Deposit workflow
Notifications
Docker
PostgreSQL
```

NICE TO HAVE:

```text
Export reports
Advanced book filters
Dark mode
```

Do NOT expand the scope without explicit approval.

---

# 19. Change Safety Protocol

Before editing:

1. Read this file.
2. Inspect the current implementation.
3. Identify affected files.
4. Identify affected APIs.
5. Identify affected models/migrations.
6. Identify frontend consumers.
7. Identify authorization implications.
8. Identify tests that should change.

Then implement the smallest correct change.

After editing:

1. Run relevant tests.
2. Run Django system checks.
3. Run migrations checks if models changed.
4. Verify API endpoints.
5. Verify frontend compilation if frontend changed.
6. Check for broken imports.
7. Review `git diff`.
8. Check that unrelated features were not changed.

Do NOT mark the task complete if tests or required checks fail.

---

# 20. Regression Protection

Every completed task must preserve these invariants:

```text
Super admin can manage departments.
Librarians remain department-scoped.
Students remain approval-gated.
Students cannot access other departments.
Librarians cannot access other departments.
Books remain department-scoped.
Recommendations remain department-scoped.
Borrow stock remains atomic.
Notifications continue working.
JWT authentication continues working.
Google OAuth continues working.
Existing working APIs remain compatible unless explicitly changed.
```

---

# 21. Handling Mistakes

If an implementation breaks an existing feature:

1. Stop expanding the task.
2. Identify the regression.
3. Fix the regression.
4. Run the relevant tests again.
5. Re-check dependent APIs.
6. Only then continue.

Do not hide errors.

Do not suppress exceptions merely to make tests pass.

Do not use broad:

```python
except Exception:
    pass
```

to hide failures.

---

# 22. Task Boundary

The coding agent must work on ONE requested task at a time.

It may modify related files that are required to complete that task.

It must NOT:

* redesign unrelated modules
* add unrelated features
* rewrite the entire project
* change the database architecture unnecessarily
* change working authentication without being asked
* redesign the frontend unnecessarily
* introduce new dependencies without justification

---

# 23. Completion Report

After every task, report:

```text
TASK
What was requested.

FILES CHANGED
List every changed file.

FILES DELETED
List deleted files.

DATABASE CHANGES
Models/migrations affected.

API CHANGES
Endpoints added/removed/changed.

FRONTEND CHANGES
Pages/components/API services affected.

SECURITY CHANGES
Authorization/department implications.

TESTS RUN
Exact tests/checks executed.

RESULT
PASS / FAIL

KNOWN ISSUES
Anything remaining.

REGRESSION CHECK
Confirm the core business workflow remains intact.
```

Never claim success without verification.

---

# 24. Priority Order

When making decisions, prioritize:

1. Security
2. Correct business workflow
3. Data integrity
4. API correctness
5. Department isolation
6. Testability
7. Simplicity
8. Performance
9. UI polish
10. Optional features

Do not sacrifice security or data integrity for simplicity.

---

# 25. Final Definition of Done

The project is complete when:

```text
Fresh Docker startup
        ↓
PostgreSQL initializes
        ↓
Django migrations apply
        ↓
Initial super admin exists
        ↓
Super admin creates departments
        ↓
Super admin creates librarians
        ↓
Librarian manages own department
        ↓
Librarian uploads CSV
        ↓
Books belong to correct department
        ↓
Student registers via OTP/Google
        ↓
Student selects department
        ↓
Student becomes pending
        ↓
Correct librarian approves student
        ↓
Student accesses own department books
        ↓
ML recommendations are department-scoped
        ↓
Student requests borrow
        ↓
Librarian approves
        ↓
Stock changes atomically
        ↓
Notification sent
        ↓
Student returns book
        ↓
Stock restored
```

The entire system must run through Docker Compose and be deployable without requiring PostgreSQL, Python, or Node.js on the host.

