# Frontend — React + Vite

## Requirements

- Node.js 18+
- npm

---

## Setup

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Production build (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## Configuration

The API base URL is defined at the top of `src/services/api.js`:

```js
export const BASE_URL = "http://localhost:8000/api";
```

Change this for staging or production deployments.

---

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Student | `student1` | `test1234` |
| Librarian | `librarian_cs` | `test1234` |
| Admin | `admin` | `admin123` |

---

## Routes

| Path | Component | Access |
|------|-----------|--------|
| `/` | `Home` | public |
| `/about` | `AboutUs` | public |
| `/gallery` | `Gallery` | public |
| `/books` | `Books` | public |
| `/login` | `Login` | public |
| `/account` | `AccountDetails` | authenticated |
| `/recommendations` | `Recommendations` | authenticated |
| `/my-borrows` | `MyBorrows` | student only |
| `/messages` | `Messages` | authenticated |
| `/librarian` | `LibrarianDashboard` | librarian only |
| `/librarian/books` | `ManageBooks` | librarian only |
| `/librarian/students` | `StudentsList` | librarian only |
| `/admin` | `AdminDashboard` | admin only |
| `/admin/books` | `AdminBooks` | admin only |
| `/admin/students` | `AdminStudents` | admin only |

Route access is enforced by `ProtectedRoute`, which accepts an optional `role` prop (`"student"`, `"librarian"`, `"admin"`). All route transitions are animated via `PageTransition` (Framer Motion).

---

## Pages

| Page | Description |
|------|-------------|
| `Home` | Landing page with dynamic CMS content (`/api/pages/home/`) |
| `AboutUs` | Static about page |
| `Gallery` | Image gallery with lightbox |
| `Books` | Book catalogue with search, category filter, and pagination |
| `Login` | JWT login (username trimmed automatically before submit) |
| `AccountDetails` | View and update profile, preferred categories |
| `Recommendations` | Personalised recommendations (hybrid/content/interaction) |
| `MyBorrows` | Student's borrow history with status tracking |
| `Messages` | In-app messaging |
| `LibrarianDashboard` | Department-scoped stats, pending borrows, approve/reject |
| `ManageBooks` | Librarian book management (create, update, delete) |
| `StudentsList` | Librarian view of department students |
| `AdminDashboard` | Global borrow management and system stats |
| `AdminBooks` | Admin book management |
| `AdminStudents` | Admin student management |

---

## Components

| Component | Description |
|-----------|-------------|
| `Navbar` | Top navigation bar with user menu and notification bell |
| `Sidebar` | Side navigation (role-aware links) |
| `ProtectedRoute` | Auth + role guard; redirects to `/login` if unauthorised |
| `PageTransition` | Framer Motion wrapper for animated route transitions |
| `BookCard` | Book thumbnail card used in catalogue and recommendation lists |
| `BookDetail` | Modal showing full book info + "Because You Read…" similar books |
| `BooksList` | Virtualised list of books (react-window) |
| `BookListItem` | Single row in the virtualised list |
| `InterestSelector` | Onboarding modal for new students to pick preferred categories |
| `Notifications` | Dropdown notification panel with mark-read support |
| `Layout` | Shared page wrapper (Navbar + content area) |
| `Lightbox` | Full-screen image viewer for the gallery |
| `ConfirmModal` | Generic confirmation dialog |
| `Loading` | Spinner / skeleton loader |
| `ErrorMessage` | Inline error display |
| `Toast` | Transient success/error notification |

---

## Service Layer (`src/services/api.js`)

All backend communication is centralised here. Key utilities:

- `authenticatedFetch(url, options)` — wraps `fetch` with automatic JWT refresh on 401; redirects to `/login` on refresh failure
- `refreshToken()` — exchanges the stored refresh token for a new access token; clears `localStorage` on failure

Function groups:

| Group | Functions |
|-------|-----------|
| Auth | `login`, `register`, `refreshToken` |
| Books | `fetchBooks`, `getSimilarBooks` |
| Recommendations | `fetchRecommendations` |
| Interactions | `trackInteraction` |
| Borrowing | `requestBorrow`, `returnBook`, `getMyBorrows`, `approveBorrow`, `rejectBorrow`, `getBorrowRequests` |
| Analytics | `fetchLibrarianDashboard`, `getStudents`, `getStudentBorrows`, `getStudentAnalytics` |
| Notifications | `getNotifications`, `markNotificationRead`, `markAllNotificationsRead` |
| Messaging | via `authenticatedFetch` to `/api/messages/` |

---

## State Management

| Concern | Mechanism |
|---------|-----------|
| Auth state | React Context API |
| Token persistence | `localStorage` (`token`, `refreshToken`, `role`) |
| Local UI state | `useState` / `useEffect` hooks |
| URL-driven state | Query params (search, category, page) |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.0 | UI library |
| react-dom | 19.2.0 | DOM rendering |
| react-router-dom | 7.11.0 | Client-side routing |
| tailwindcss | 4.1.18 | Utility-first CSS |
| framer-motion | 12.24.10 | Page and component animations |
| recharts | 3.6.0 | Dashboard charts |
| lucide-react | 0.562.0 | Icon set |
| react-window | 2.2.4 | Virtualised list rendering |
| papaparse | 5.5.3 | CSV parsing (client-side) |

---

## Troubleshooting

**Frontend can't reach the backend**
- Ensure the backend is running on `http://localhost:8000`
- Check that `CORS_ALLOWED_ORIGINS` in `backend/book_recommondation/settings.py` includes `http://localhost:5173`

**Books page is empty**
- Confirm books have been imported: `python manage.py import_books`
- Check the browser network tab for API errors

**Stale auth / login loop**
```js
// Run in browser console to clear stored tokens
localStorage.clear()
```

**Dependency issues**
```bash
rm -rf node_modules package-lock.json
npm install
```
