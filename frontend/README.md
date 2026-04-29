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
| Student | `aarav_sharma` | `test1234` |
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
| `/librarian` | `LibrarianDashboard` | librarian only |
| `/librarian/books` | `ManageBooks` | librarian only |
| `/librarian/students` | `StudentsList` | librarian only |
| `/admin` | `AdminDashboard` | admin only |
| `/admin/books` | `AdminBooks` | admin only |
| `/admin/students` | `AdminStudents` | admin only |

Route access is enforced by `ProtectedRoute`. Admins bypass all role checks and can access every route. Authenticated users hitting an unauthorised route are redirected to their own home (`ROLE_HOME`) rather than `/login`.

---

## Pages

| Page | Description |
|------|-------------|
| `Home` | Landing page |
| `AboutUs` | Static about page |
| `Gallery` | Image gallery |
| `Books` | Book catalogue — search, category filter, pagination (20/page, 6k+ books) |
| `Login` | JWT login + student registration; loading spinner on submit; role-based redirect |
| `AccountDetails` | View/edit profile (name, email, dept dropdown, year, student ID); borrow stats; hybrid recommendations |
| `Recommendations` | Personalised recommendations (hybrid/content/interaction tabs) |
| `MyBorrows` | Student borrow history with status badges |
| `Messages` | ~~Removed~~ | ~~authenticated~~ | Removed |
| `LibrarianDashboard` | Action-first: pending requests table with inline approve/reject, stat cards, borrow trend chart, top books, students list |
| `ManageBooks` | Librarian book management (create, update, delete) |
| `StudentsList` | Librarian view of department students |
| `AdminDashboard` | Global borrow management and system stats |
| `AdminBooks` | Admin book management |
| `AdminStudents` | Admin student management |

---

## Key Components

| Component | Description |
|-----------|-------------|
| `ProtectedRoute` | Auth + role guard. Uses `useState` + `storage` event listener for cross-tab logout sync. Admins bypass all role checks. |
| `PageTransition` | Framer Motion wrapper for animated route transitions |
| `BookCard` | Book thumbnail card used in catalogue and recommendation lists |
| `BookDetail` | Side-panel / modal with full book info, borrow button, and dwell-time tracking |
| `BooksList` | Paginated book list with `loading: true` initial state (prevents flash of empty content) |
| `Navbar` | Top navigation with user menu and notification bell |
| `Notifications` | Dropdown notification panel with mark-read support |
| `InterestSelector` | Onboarding modal for new students to pick preferred categories |
| `Loading` | Spinner / skeleton loader |
| `ErrorMessage` | Inline error display |
| `Toast` | Transient success/error notification (used in LibrarianDashboard) |
| `LibrarianDashboard` | Single-file action-first dashboard. Real API data only — no fake fallback for requests. |

---

## Service Layer (`src/services/api.js`)

All backend communication is centralised here.

### Key utilities

- `authenticatedFetch(url, options)` — flat two-step pattern: one initial fetch, one conditional retry after token refresh. Never recurses. Redirects to `/login` on refresh failure.
- `refreshToken()` — exchanges stored refresh token for new access token; clears `localStorage` on failure.
- `fetchBooks(params)` — accepts query params, defaults to `page_size=100`.

### Function groups

| Group | Functions |
|-------|-----------|
| Auth | `login`, `register`, `refreshToken` |
| Books | `fetchBooks`, `getSimilarBooks` |
| Recommendations | `fetchRecommendations` |
| Interactions | `trackInteraction`, `trackDwellTime` |
| Borrowing | `requestBorrow`, `returnBook`, `getMyBorrows`, `approveBorrow`, `rejectBorrow`, `getBorrowRequests` |
| Analytics | `fetchLibrarianDashboard`, `getStudents`, `getStudentBorrows`, `getStudentAnalytics` |
| Notifications | `getNotifications`, `markNotificationRead`, `markAllNotificationsRead` |
| Admin | `getAdminStats`, `getAdminStudents`, `getAdminBooks`, `createBook`, `updateBook`, `deleteBook` |

---

## State Management

| Concern | Mechanism |
|---------|-----------|
| Auth state | `localStorage` (`token`, `refreshToken`, `role`) |
| Cross-tab logout | `window.addEventListener('storage', ...)` in `ProtectedRoute` |
| Local UI state | `useState` / `useEffect` / `useCallback` hooks |
| Form pre-fill | Three-layer sync: `loadProfile` → `useEffect([profile])` → `handleReset` |
| URL-driven state | Query params (search, category, page) in `Books.jsx` |

---

## Known Patterns & Bug Fixes

### `loading: true` initial state (BooksList)
All list components initialise `loading` as `true` to prevent a flash of "No books found" before the first fetch completes.

### Form state sync (AccountDetails)
`formData` is populated in three places to handle all edge cases:
1. Inside `loadProfile()` immediately after the API response
2. A `useEffect` watching `[profile]` for external profile changes
3. `handleReset` (Cancel button) restores last-fetched server state

### Department field
The department input is a `<select>` dropdown (not free text) to ensure only valid `Department` FK values are submitted.

### Token refresh (api.js)
`authenticatedFetch` uses a flat two-step pattern — never recursive — to prevent infinite refresh loops on persistent 401s.

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------| 
| react | 19.2.0 | UI library |
| react-dom | 19.2.0 | DOM rendering |
| react-router-dom | 7.11.0 | Client-side routing |
| tailwindcss | 4.1.18 | Utility-first CSS |
| framer-motion | 12.24.10 | Page and component animations |
| recharts | 3.6.0 | Dashboard charts (AreaChart, BarChart) |
| lucide-react | latest | Icon set |

---

## Troubleshooting

**Frontend can't reach the backend**
- Ensure backend is running on `http://localhost:8000`
- Check `CORS_ALLOWED_ORIGINS` in `settings.py` includes `http://localhost:5173`

**Books page is empty**
- Run: `python manage.py import_books`
- Check browser network tab for API errors

**Librarian dashboard shows no data**
- Run: `python manage.py seed_demo` (requires books to be imported first)

**Stale auth / login loop**
```js
// Run in browser console
localStorage.clear()
```

**Dependency issues**
```bash
rm -rf node_modules package-lock.json
npm install
```
