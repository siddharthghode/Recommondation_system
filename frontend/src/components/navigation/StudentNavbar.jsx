import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import Notifications from "../Notifications";

export default function StudentNavbar() {
  const { user, department, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    closeMobileMenu();
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-slate-900 text-white relative border-b border-slate-800 shadow-md z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        {/* Left: UniLib Brand Logo & Department badge */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5" onClick={closeMobileMenu}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-900/30">
              <span className="text-xl">📚</span>
            </div>
            <div>
              <span className="font-extrabold text-lg text-white tracking-tight block leading-tight">UniLib</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-blue-400 block -mt-0.5">
                Student Portal
              </span>
            </div>
          </Link>

          {department && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-blue-300 border border-slate-700">
              <span>🏛</span>
              <span className="truncate max-w-[200px]">{department}</span>
            </span>
          )}
        </div>

        {/* Center: Desktop Student Navigation */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/") ? "bg-slate-800 text-blue-400 font-semibold" : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Home
          </Link>
          <Link
            to="/books"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/books") ? "bg-slate-800 text-blue-400 font-semibold" : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Books
          </Link>
          <Link
            to="/recommendations"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/recommendations") ? "bg-slate-800 text-blue-400 font-semibold" : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Recommendations
          </Link>
          <Link
            to="/my-borrows"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/my-borrows") ? "bg-slate-800 text-blue-400 font-semibold" : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            My Borrows
          </Link>
        </div>

        {/* Right: Notifications & Profile */}
        <div className="hidden md:flex items-center gap-3">
          <Notifications />

          <Link
            to="/account"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold ${
              isActive("/account")
                ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750 hover:text-white"
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {(user?.first_name?.[0] || user?.username?.[0] || "S").toUpperCase()}
            </div>
            <span className="truncate max-w-[120px]">
              {user?.first_name ? `${user.first_name}` : user?.username || "Account"}
            </span>
          </Link>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm"
          >
            Logout
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <Notifications />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-slate-900 border-t border-slate-800 shadow-2xl z-50">
          <div className="flex flex-col p-4 space-y-1.5">
            {department && (
              <div className="px-4 py-2 bg-slate-800/80 rounded-lg text-xs text-blue-300 flex items-center gap-2 mb-1">
                <span>🏛</span>
                <span>Department: <strong>{department}</strong></span>
              </div>
            )}
            <Link to="/" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
              Home
            </Link>
            <Link to="/books" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
              Books
            </Link>
            <Link to="/recommendations" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
              Recommendations
            </Link>
            <Link to="/my-borrows" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
              My Borrows
            </Link>
            <Link to="/account" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
              Profile & Account
            </Link>

            <div className="pt-3 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
