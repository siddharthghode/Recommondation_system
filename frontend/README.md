# Frontend — React + Vite

Modern, responsive Single Page Application (SPA) built with React 19, Vite, Tailwind CSS 4, Framer Motion, and Recharts for the University Library Management and Recommendation System.

---

## 🚀 Quick Setup

### Option 1: Using Docker Compose (Recommended)
From the root repository directory:
```bash
cp .env.example .env
docker compose up --build -d
# Frontend is served via Nginx on http://localhost (or configured FRONTEND_PORT)
```

### Option 2: Local Development (Vite Dev Server)
```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Copy environment template (optional)
cp .env.example .env

# 3. Start development server with hot module replacement
npm run dev
# → http://localhost:5173
```

---

## 🛠️ Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite` | Starts local dev server at `http://localhost:5173` with proxy to backend |
| `npm run build` | `vite build` | Compiles optimized production bundle into `dist/` |
| `npm run lint` | `npx eslint .` | Runs ESLint check across all JSX and JS files |
| `npm run lint:fix` | `npx eslint . --fix` | Automatically fixes auto-fixable lint issues |
| `npm run preview` | `vite preview` | Locally serves the built production assets in `dist/` |

---

## ⚙️ Configuration & Environment

The frontend connects to the backend API via `src/services/api.js`:

```js
export const BASE_URL = import.meta.env.VITE_API_URL || "/api";
```

### Environment Variables (`.env`):
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` | Base API URL prefix (proxied to backend in both dev and prod) |
| `VITE_GOOGLE_CLIENT_ID` | `""` | Google OAuth Client ID for Google Sign-In & Registration |

In local development (`npm run dev`), `vite.config.js` proxies all requests starting with `/api` directly to `http://localhost:8000`.

---

## 🔐 Route Matrix & Access Control

Route permissions are enforced by `ProtectedRoute` and role checks:

| Route Path | Component | Target Role / Access |
|---|---|---|
| `/` | `Home` | Public |
| `/about` | `AboutUs` | Public |
| `/gallery` | `Gallery` | Public |
| `/books` | `Books` | Public |
| `/login` | `Login` | Public (includes student registration modal & OTP) |
| `/account` | `AccountDetails` | Authenticated (Student / Librarian / Admin) |
| `/recommendations` | `Recommendations` | Authenticated Student |
| `/my-borrows` | `MyBorrows` | Authenticated Student |
| `/librarian` | `LibrarianDashboard` | Librarian / Admin |
| `/librarian/books` | `ManageBooks` | Librarian / Admin |
| `/librarian/students` | `StudentsList` | Librarian / Admin |
| `/admin` | `AdminDashboard` | Admin |
| `/admin/books` | `AdminBooks` | Admin |
| `/admin/students` | `AdminStudents` | Admin |

> **Note**: Admins have global administrative privileges and can navigate across student, librarian, and admin views.

---

## 👥 Demo Logins

| Role | Username | Password | Notes |
|---|---|---|---|
| **Super Admin** | `admin` | `admin123` | Global system oversight |
| **Librarian** | `librarian_cs` | `test1234` | Computer Science department librarian |
| **Student** | `aarav_sharma` | `test1234` | Computer Science student (pre-approved) |
| **Student** | `priya_patil` | `test1234` | Computer Science student (pre-approved) |

---

## 🧩 Key Components

| Component | File Path | Purpose |
|---|---|---|
| `ProtectedRoute` | `src/components/ProtectedRoute.jsx` | Guards private routes and verifies user roles with cross-tab logout sync |
| `Navbar` | `src/components/Navbar.jsx` | Navigation header with user dropdown and notification badge |
| `Notifications` | `src/components/Notifications.jsx` | Dropdown panel with mark-as-read for borrow status updates |
| `BookCard` | `src/components/BookCard.jsx` | Book card with thumbnail, rating, availability badge, and interaction triggers |
| `BookDetail` | `src/components/BookDetail.jsx` | Modal displaying book metadata, borrow button, and dwell-time tracker |
| `InterestSelector` | `src/components/InterestSelector.jsx` | Category preference modal for onboarding students |
| `PageTransition` | `src/components/PageTransition.jsx` | Framer Motion wrapper for animated page transitions |

---

## 📡 API Service Layer (`src/services/api.js`)

All network requests are centralized in `src/services/api.js`. Key architectural patterns include:

1. **Automatic JWT Token Refresh**: `authenticatedFetch()` transparently refreshes expired access tokens using the refresh token before retrying failed requests.
2. **Cross-Tab Synchronization**: Logouts in one tab immediately synchronize across all open browser tabs using the `storage` event.
3. **Dwell Time Logging**: Time spent inspecting book modals is automatically recorded to fine-tune recommendation scoring.

---

## 🔧 Troubleshooting

### 1. API requests fail in local development
- Ensure the backend server is running on `http://localhost:8000`.
- Verify the Vite proxy setting in `vite.config.js` points to `http://localhost:8000`.

### 2. Clearing stale login session
Open your browser DevTools Console and execute:
```js
localStorage.clear();
window.location.reload();
```

### 3. Reinstalling dependencies
If you encounter package conflicts:
```bash
rm -rf node_modules package-lock.json
npm install
```
