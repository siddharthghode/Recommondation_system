# Technical Blueprint Report
## Library Management System with Intelligent Book Recommendations

> **Classification:** Principal Architect Reference Document  
> **Purpose:** Complete system reconstruction guide — covers every architectural decision, algorithm, and design pattern in the codebase.

---

## Table of Contents

1. [Executive Architecture Summary](#1-executive-architecture-summary)
2. [Core Logic Deep-Dive](#2-core-logic-deep-dive)
   - 2.1 [Recommendation Engine](#21-recommendation-engine)
   - 2.2 [Atomic Transactions & Stock Management](#22-atomic-transactions--stock-management)
3. [Database Schema (ERD Logic)](#3-database-schema-erd-logic)
4. [Authentication Flow](#4-authentication-flow)
5. [Frontend State & Rendering](#5-frontend-state--rendering)
   - 5.1 [AccountDetails.jsx — Form State Synchronization](#51-accountdetailsjsx--form-state-synchronization)
   - 5.2 [BooksList.jsx — The Cascading Render Bug](#52-bookslistjsx--the-cascading-render-bug)
6. [Deployment & Environment](#6-deployment--environment)

---

## 1. Executive Architecture Summary

### System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│   React 19 + Vite (localhost:5173)                              │
│   React Router 7 · Tailwind CSS 4 · Framer Motion · Recharts   │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP/JSON  (CORS: localhost:5173 allowed)
                         │  Authorization: Bearer <JWT>
┌────────────────────────▼────────────────────────────────────────┐
│                       API LAYER                                 │
│   Django 6.0.1 + Django REST Framework 3.16.1                   │
│   djangorestframework-simplejwt 5.5.1                           │
│   django-cors-headers 4.0.0                                     │
│   Root URL: /api/...                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │  Django ORM (psycopg2-binary)
┌────────────────────────▼────────────────────────────────────────┐
│                      DATA LAYER                                 │
│   PostgreSQL (ERP-scale)                                        │
│   django.contrib.postgres enabled (ArrayField, full-text)       │
│   SQLite used only for local unit tests (testserver)            │
└─────────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                       ML LAYER                                  │
│   scikit-learn 1.6.1 · NumPy 2.4.1 · Pandas 2.3.3              │
│   TF-IDF Vectorizer + Cosine Similarity (in-process)            │
│   Django cache (5–10 min TTL) prevents re-computation           │
└─────────────────────────────────────────────────────────────────┘
```

### Request Lifecycle (Happy Path)

```
Browser                  React (Vite)              Django (DRF)           PostgreSQL
  │                          │                          │                      │
  │── GET /books ──────────► │                          │                      │
  │                          │── fetch /api/books/ ───► │                      │
  │                          │   Authorization: Bearer  │── SELECT * FROM ───► │
  │                          │                          │◄─ rows ──────────── │
  │                          │◄─ 200 JSON ─────────────│                      │
  │◄─ rendered BookCard[] ── │                          │                      │
```

### Django App Decomposition

| App | Responsibility |
|-----|---------------|
| `accounts` | Custom `User` (AbstractUser), `UserProfile`, `Department`, `Notification` |
| `books` | `Book`, `BookInteraction`, `BookDwellTime`, `SearchHistory`, recommendation views |
| `borrows` | `Borrow` lifecycle: requested → approved → returned/rejected |
| `analytics` | Librarian/admin dashboard aggregations |
| `messaging` | DRF ViewSet for inter-user messaging |
| `book_recommondation` | Django project settings, root URL conf |

### Why PostgreSQL for ERP Scale

- `django.contrib.postgres` is explicitly installed, enabling `ArrayField` (used for `Book.embedding`) and PostgreSQL-native full-text search.
- `select_for_update()` (row-level locking) is a PostgreSQL/MySQL feature — it is **not available on SQLite**, making PostgreSQL a hard architectural requirement for the borrow approval flow.
- The `ALLOWED_HOSTS` list includes `testserver` (Django test client), which allows SQLite to be used in automated tests while production runs PostgreSQL.

---

## 2. Core Logic Deep-Dive

### 2.1 Recommendation Engine

**File:** `backend/books/services/recommender.py`

The engine exposes three public functions: `content_based`, `interaction_based`, and `hybrid`. All three are cache-wrapped with a 5-minute TTL using Django's cache framework.

---

#### 2.1.1 Content-Based Filtering (`content_based`)

**Goal:** Recommend books whose categories match the user's stated preferences.

**Algorithm:**

```
1. Read user.profile.preferred_categories  (comma-separated string)
2. Build a Django Q() OR-query across all category tokens
3. Annotate each candidate book with a composite score:

   score = (average_rating × 0.7) + (ratings_count × 0.0001)

4. ORDER BY score DESC, return top `limit` books
5. Exclude books the user has already interacted with
```

The `0.7` weight on rating vs `0.0001` on count is a deliberate design choice: a highly-rated niche book (few ratings) ranks above a mediocre popular one, but a book with thousands of ratings gets a small popularity boost.

**Fallback:** If `preferred_categories` is empty, return top-rated in-stock books the user hasn't touched.

---

#### 2.1.2 TF-IDF Cosine Similarity (`get_similar_books`)

**Goal:** Given a single book, find the most textually similar books in the catalogue ("Because You Read…" feature).

**The Math:**

**Step 1 — Build the corpus**

For the source book and up to 100 category-matched candidates, construct a text document per book:

```
doc = f"{categories} {authors} {description}"
```

**Step 2 — TF-IDF Vectorization**

```
TfidfVectorizer(
    stop_words='english',
    max_features=500,
    sublinear_tf=True,
)
```

- **TF (Term Frequency):** `tf(t, d) = count(t in d) / total_terms(d)`
- **sublinear_tf=True** applies `tf = 1 + log(tf)`, dampening the effect of very frequent terms (e.g., "book", "story").
- **IDF (Inverse Document Frequency):** `idf(t) = log((1 + n) / (1 + df(t))) + 1`  where `n` = corpus size, `df(t)` = documents containing term `t`. Rare, distinctive terms get higher IDF weight.
- **TF-IDF weight:** `tfidf(t, d) = tf(t, d) × idf(t)`
- `max_features=500` caps the vocabulary to the 500 highest-IDF terms, preventing memory explosion on a 6k-book corpus.

The result is a sparse matrix of shape `(1 + n_candidates, 500)`.

**Step 3 — Cosine Similarity**

```python
similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
```

Cosine similarity between two vectors **A** and **B**:

```
cos(θ) = (A · B) / (‖A‖ × ‖B‖)
```

Range: `[0, 1]`. A score of `1.0` means identical term distributions; `0.0` means no shared vocabulary. This metric is length-invariant — a short description and a long one are compared fairly.

**Step 4 — Composite Scoring**

```python
final_score = cosine_similarity_score × 0.7 + average_rating × 0.05
```

The `0.7` weight on textual similarity ensures the primary signal is content relevance. The `0.05` rating weight acts as a tiebreaker between equally similar books.

**Fallback Chain:**

```
TF-IDF succeeds?
    YES → return top scored books
    NO  → _category_fallback()  (top-rated books sharing any category token)
              │
              └── still empty? → _author_fallback()  (books by same author)
```

This three-tier fallback guarantees the API never returns an empty list as long as any books exist.

---

#### 2.1.3 Collaborative Filtering (`interaction_based`)

**Goal:** "Users like you also borrowed…" — find users with similar interaction histories and recommend what they liked.

**Interaction Weights (SQL CASE expression):**

```sql
CASE interaction_type
    WHEN 'borrow' THEN 3
    WHEN 'like'   THEN 2
    ELSE 1          -- 'view'
END
```

A borrow is the strongest signal (user committed to reading), a like is moderate, a view is weak.

**Similarity Computation (Dot-Product of Weight Vectors):**

```
similarity(user_A, user_B) = Σ  weight_A(book_i) × weight_B(book_i)
                              i ∈ shared_books
```

This is a sparse dot-product. It is computed in Python **only over the shared-book subset** (already DB-filtered), keeping it O(shared_interactions) rather than O(all_interactions).

**Candidate Scoring:**

```
score(candidate_book) = Σ  similarity(current_user, other_user) × weight_other(candidate_book)
                         other_user ∈ top_50_similar_users
```

Books touched by highly similar users with high interaction weights rank highest.

**Fallback:** If the user has no interactions, return trending books (most total interactions).

---

#### 2.1.4 Hybrid Fusion (`hybrid`)

**Goal:** Combine both signals for the best of both worlds.

```python
# Positional scoring: rank 1 = highest score
interaction_score(book) = (n_interaction_books - rank) × 1.5
content_score(book)     = (n_content_books    - rank) × 1.0

final_score(book) = interaction_score + content_score
```

The `1.5` multiplier on collaborative scores reflects the architectural decision that **behavioural signals** (what users actually borrowed) are more reliable than **stated preferences** (category checkboxes). Books appearing in both lists get a combined score and naturally float to the top.

---

### 2.2 Atomic Transactions & Stock Management

**File:** `backend/borrows/views.py` — `ApproveBorrowView.post()`

The critical section is the borrow approval. Without locking, two librarians approving the last copy simultaneously would both read `quantity=1`, both decrement to `0`, and the book would be "borrowed" twice with `quantity=-1`.

**The Fix — `select_for_update()`:**

```python
with transaction.atomic():
    # Issues: SELECT ... FOR UPDATE on the book row
    # All other transactions trying to touch this row BLOCK here
    book = Book.objects.select_for_update().get(id=borrow.book.id)

    if book.quantity <= 0:
        return Response({"error": "Out of stock"}, status=400)

    # Safe: only one transaction reaches this line at a time
    book.quantity = book.quantity - 1
    book.save()
    borrow.status = 'approved'
    borrow.save()
```

**Flow Diagram:**

```
Librarian A                          Librarian B
    │                                    │
    │── BEGIN TRANSACTION ───────────────│
    │── SELECT FOR UPDATE (book #42) ──► DB acquires row lock
    │                                    │── BEGIN TRANSACTION
    │                                    │── SELECT FOR UPDATE (book #42) ──► BLOCKS (waiting)
    │── quantity check: 1 > 0 ✓          │
    │── quantity = 0, borrow = approved  │
    │── COMMIT ──────────────────────────│
    │                                    │── lock released, query returns
    │                                    │── quantity check: 0 > 0 ✗
    │                                    │── return 400 "Out of stock"
    │                                    │── ROLLBACK
```

**Additional Safety Net:** `Book.save()` overrides the model's save method to clamp `quantity` to `0` if it somehow goes negative — a defensive application-layer guard below the DB lock.

**Borrow State Machine:**

```
[requested] ──approve──► [approved] ──return──► [returned]
     │
     └──reject──► [rejected]
```

---

## 3. Database Schema (ERD Logic)

### Entity Relationships

```
Department (1) ──────────────────────────────── (N) Book
     │                                                │
     │ (1)                                            │ (N)
     │                                                │
   User (AbstractUser)                         BookInteraction
     │  role: student|librarian|admin          user FK → User
     │  department FK → Department (librarian) book FK → Book
     │                                         interaction_type: view|like|borrow
     │ (1)
     │
  UserProfile (1:1 with User)
     student_id (unique)
     department FK → Department  ← student's academic dept
     year
     preferred_categories (CSV text)
     │
     │ (1)
     │
   Borrow
     user FK → User
     book FK → Book
     status: requested|approved|returned|rejected
     requested_at, approved_at, borrow_date, due_date, return_date
     rejection_reason
```

### Key Design Decisions

**Why `Department` appears twice:**

| Model | `department` FK | Meaning |
|-------|----------------|---------|
| `User` | → `Department` | The librarian's **operational scope** — they can only see/approve borrows from this department |
| `UserProfile` | → `Department` | The student's **academic department** — used to route their borrow requests to the correct librarian |

This dual-FK design is the core of the multi-tenant scoping. When a librarian opens `PendingBorrowsView`, the query is:

```python
Borrow.objects.filter(
    status='requested',
    user__profile__department=request.user.department
)
```

This traverses: `Borrow → User → UserProfile → Department`, matching the student's academic department to the librarian's operational department. Without this, a CS librarian would see Physics students' requests.

**`BookInteraction` as the ML data source:**

`BookInteraction` is the bridge between the library system and the ML engine. Every view, like, and borrow is recorded here. The recommender reads this table exclusively — it never touches `Borrow` directly. This separation means the recommendation engine works even for books a user viewed but never borrowed.

**`BookDwellTime`:** Records how many seconds a user spent on a book's detail page. This is a passive engagement signal that can be incorporated into future recommendation scoring without changing the interaction model.

**`Book.embedding`:** Stored as `ArrayField(FloatField)` on PostgreSQL (falls back to `JSONField` on SQLite). This field is reserved for future dense vector similarity (e.g., sentence-transformers), complementing the current sparse TF-IDF approach.

---

## 4. Authentication Flow

### JWT Lifecycle

```
POST /api/auth/login/
  Body: { username, password }
  Response: { access: "<60min JWT>", refresh: "<1day JWT>", role: "student|librarian|admin" }
                │
                ├── localStorage.setItem("token", access)
                ├── localStorage.setItem("refreshToken", refresh)
                └── localStorage.setItem("role", role)
```

**Token Configuration (`settings.py`):**

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'SIGNING_KEY': os.getenv('JWT_SIGNING_KEY', None) or SECRET_KEY,
}
```

The signing key is read from `JWT_SIGNING_KEY` env var in production, keeping it out of source control.

### Auto-Refresh Flow (`api.js` — `authenticatedFetch`)

```
authenticatedFetch(url)
    │
    ├── Attach: Authorization: Bearer <token>
    │
    ├── Response 401?
    │       │
    │       └── POST /api/auth/refresh/ { refresh: <refreshToken> }
    │               │
    │               ├── 200 OK → store new access token → RETRY original request
    │               │
    │               └── FAIL → clear all localStorage tokens → redirect to /login
    │
    └── Other status → return response as-is
```

This transparent retry means components never need to handle token expiry manually. The 30-second `AbortController` timeout on `fetchRecommendations` prevents the ML computation from hanging the UI.

### Role-Based Access Control (`ProtectedRoute.jsx`)

```
<ProtectedRoute role="librarian">
    <LibrarianDashboard />
</ProtectedRoute>
```

**Decision Tree:**

```
token in localStorage?
    NO  → <Navigate to="/login" />
    YES →
        role prop provided?
            NO  → render children (any authenticated user)
            YES →
                userRole === "admin"?
                    YES → render children (admins bypass all role checks)
                    NO  →
                        userRole in allowed[]?
                            YES → render children
                            NO  → <Navigate to={ROLE_HOME[userRole]} />
```

**`ROLE_HOME` mapping** prevents an authenticated user from seeing a blank page on unauthorized access — they are redirected to their own dashboard:

```javascript
const ROLE_HOME = {
  student:   "/account",
  librarian: "/librarian",
  admin:     "/admin",
};
```

**Route Map (`App.jsx`):**

| Path | Required Role | Component |
|------|--------------|-----------|
| `/` | none | `Home` |
| `/books` | none | `Books` |
| `/account` | any auth | `AccountDetails` |
| `/recommendations` | any auth | `Recommendations` |
| `/my-borrows` | `student` | `MyBorrows` |
| `/librarian` | `librarian` | `LibrarianDashboard` |
| `/librarian/books` | `librarian` | `ManageBooks` |
| `/librarian/students` | `librarian` | `StudentsList` |
| `/admin` | `admin` | `AdminDashboard` |
| `/admin/books` | `admin` | `AdminBooks` |
| `/admin/students` | `admin` | `AdminStudents` |
| `/messages` | any auth | `Messages` |

All routes are wrapped in `<PageTransition>` (Framer Motion) and `<AnimatePresence mode="wait">` for smooth page-change animations keyed by `location.pathname`.

---

## 5. Frontend State & Rendering

### 5.1 `AccountDetails.jsx` — Form State Synchronization

**The Problem:** When a user clicks "Edit Profile", the form must be pre-filled with their current data. If `formData` is initialized as `{}` and the profile loads asynchronously, the form renders with empty fields.

**The Solution — Three-Layer Sync:**

**Layer 1:** `formData` is populated inside `loadProfile()` immediately after the API response:

```javascript
const data = await res.json();
setProfile(data);
setFormData({
  first_name: data.first_name || "",
  // ...
});
```

**Layer 2:** A dedicated `useEffect` re-syncs `formData` whenever `profile` changes (handles edge cases where profile is updated externally):

```javascript
useEffect(() => {
  if (profile) {
    setFormData({ first_name: profile.first_name || "", ... });
  }
}, [profile]);
```

**Layer 3:** A loading guard in the JSX prevents the form from rendering before `formData` is populated:

```jsx
{Object.keys(formData).length === 0 ? (
  <LoadingSpinner />
) : (
  <form>...</form>
)}
```

**`handleReset`** uses `useCallback` with `[profile]` dependency, so "Cancel" always restores the last-fetched server state, not a stale closure value.

**After a successful `PUT /api/profile/`**, the component calls `await loadProfile()` before closing edit mode — this ensures the display view immediately reflects the saved data without a page refresh.

---

### 5.2 `BooksList.jsx` — The Cascading Render Bug

**The Bug:** If `loading` is initialized as `false`:

```javascript
// WRONG
const [loading, setLoading] = useState(false);
```

The component renders on mount with `loading=false` and `books=[]`, which immediately hits the `books.length === 0` branch and displays "No books found" — before the `useEffect` fetch has even started. When the fetch completes and `setBooks(list)` fires, React re-renders, causing a visible flash from "No books found" → actual book list. This is the **cascading render** (also called a flash of empty content).

**The Fix — `loading: true` as initial state:**

```javascript
// CORRECT
const [loading, setLoading] = useState(true);
```

Now the render sequence is:

```
Mount → loading=true  → renders "Loading books..."
         │
         └── useEffect fires → fetch() → .finally(() => setLoading(false))
                                              │
                                              └── loading=false, books=[...] → renders list
```

The user sees a loading indicator, never an empty state that immediately disappears.

**Mounted flag pattern** prevents `setState` calls on unmounted components (React memory leak warning):

```javascript
useEffect(() => {
  let mounted = true;
  fetchBooks()
    .then(data => { if (mounted) setBooks(list); })
    .finally(() => mounted && setLoading(false));

  return () => { mounted = false };  // cleanup on unmount
}, []);
```

**API response normalization** handles both paginated and flat responses from DRF:

```javascript
const list = Array.isArray(data) ? data : (data.results || data.items || []);
```

---

## 6. Deployment & Environment

### Required `.env` Variables

Create `backend/.env` with the following:

```env
# Django
DJANGO_SECRET_KEY=<generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">

# JWT (optional — falls back to DJANGO_SECRET_KEY if not set)
JWT_SIGNING_KEY=<separate strong random string for JWT signing>

# PostgreSQL
POSTGRES_DB=library_erp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your_db_password>
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

### Why `psycopg2-binary`

`psycopg2-binary` is the Python adapter that bridges Django's ORM to PostgreSQL. It is a self-contained binary wheel — no system-level `libpq-dev` installation required. This is the correct choice for development and containerized deployments. For bare-metal production, `psycopg2` (compiled from source against the system's libpq) is preferred for performance and security patch control.

Without this package, `django.db.backends.postgresql` raises `ImproperlyConfigured` on startup.

### Password Hashing

```python
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',  # primary
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',  # fallback
    ...
]
```

Argon2 (winner of the Password Hashing Competition) is used as the primary hasher, requiring `argon2-cffi==23.1.0`. Existing PBKDF2 hashes are transparently upgraded to Argon2 on next login.

### CORS Configuration

```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',   # Vite dev server
    'http://127.0.0.1:5173',
]
CORS_ALLOW_CREDENTIALS = True
```

`CorsMiddleware` must be the **first** middleware in the stack to intercept preflight `OPTIONS` requests before Django's CSRF or auth middleware processes them.

### Production Hardening Checklist

| Item | Current State | Production Action |
|------|--------------|-------------------|
| `DEBUG` | `True` | Set `DEBUG=False` via env var |
| `SECRET_KEY` | Insecure default in code | Always override via `DJANGO_SECRET_KEY` env var |
| `ALLOWED_HOSTS` | `localhost`, `127.0.0.1` | Add production domain |
| `CORS_ALLOWED_ORIGINS` | Vite dev server | Replace with production frontend URL |
| Database | PostgreSQL (already correct) | Add connection pooling (pgBouncer) |
| Static files | `STATIC_URL = 'static/'` | Configure `STATIC_ROOT` + run `collectstatic` + serve via nginx/S3 |
| JWT signing key | Falls back to `SECRET_KEY` | Set dedicated `JWT_SIGNING_KEY` |

### Startup Command Sequence

```bash
# Backend
cd backend
python -m venv bookenv && source bookenv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # creates demo users + departments
python manage.py ensure_profiles    # creates UserProfile for all users
python manage.py import_books       # imports ~6k books from data/books_6k.csv
python manage.py runserver 0.0.0.0:8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

*End of Blueprint Report. This document was generated by static analysis of the full source tree and reflects the exact implementation as of the analyzed commit.*
