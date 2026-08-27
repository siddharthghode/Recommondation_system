import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Notifications from '../components/Notifications';

export default function LibrarianLayout() {
  const { user, department, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/librarian', label: 'Dashboard', icon: '🏠', end: true },
    { to: '/librarian/books', label: 'Manage Books', icon: '📚' },
    { to: '/librarian/students', label: 'Students & Approvals', icon: '👥' },
    { to: '/librarian/borrowing', label: 'Borrowing Circulation', icon: '📖' },
    { to: '/librarian/returns', label: 'Return Management', icon: '↩' },
    { to: '/librarian/reports', label: 'Analytics & Reports', icon: '📊' },
  ];

  // Helper to extract page title based on current path
  const getPageTitle = () => {
    const p = location.pathname;
    if (p === '/librarian') return 'Dashboard Overview';
    if (p.startsWith('/librarian/books')) return 'Department Book Catalog';
    if (p.startsWith('/librarian/students')) return 'Student Management & Approvals';
    if (p.startsWith('/librarian/borrowing')) return 'Borrow Requests & Circulation';
    if (p.startsWith('/librarian/returns')) return 'Return Tracking';
    if (p.startsWith('/librarian/reports')) return 'Department Analytics';
    return 'Librarian Portal';
  };

  const deptLabel = department || user?.department || 'Department Library';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* ── Sidebar (Desktop) ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col bg-slate-900 border-r border-slate-800 shrink-0 select-none">
        {/* Top Branding Section */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-950/60 border border-indigo-500/30">
              <span className="text-xl">📚</span>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">UniLib</span>
              <h1 className="text-base font-extrabold text-white tracking-tight leading-none">Librarian Portal</h1>
            </div>
          </div>

          {/* Department Highlight Card */}
          <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <span>🏛</span>
              <span>Managing Department</span>
            </div>
            <p className="text-sm font-bold text-indigo-300 truncate" title={deptLabel}>
              {deptLabel}
            </p>
          </div>
        </div>

        {/* Navigation Menu Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-950 font-semibold border border-indigo-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout (Bottom) */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                {(user?.first_name?.[0] || user?.username?.[0] || 'L').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username || 'Librarian'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email || 'Staff'}</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 border border-slate-700/80 hover:border-red-800/60 transition-all text-xs font-semibold"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Container (Top Header + Page Content) ────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 min-h-screen">
        {/* Top Application Header */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          {/* Left: Mobile hamburger & current page title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              aria-label="Toggle Navigation"
            >
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-none">{getPageTitle()}</h2>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                {deptLabel} Management
              </span>
            </div>
          </div>

          {/* Right: Notifications & Department Tag */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
              <span>🏛</span>
              <span className="max-w-[180px] truncate">{deptLabel}</span>
            </div>

            <Notifications />

            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-slate-300 hover:text-red-300 border border-slate-700 text-xs font-semibold transition-colors"
            >
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {mobileOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-4 space-y-2">
            <div className="p-3 bg-slate-800 rounded-xl mb-3">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Department</span>
              <span className="text-xs font-bold text-indigo-300">{deptLabel}</span>
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm ${
                    isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="w-full mt-2 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Main Content Body */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 bg-slate-950 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
