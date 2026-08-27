import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import Notifications from "../Notifications";

export default function PublicNavbar() {
  const { isAuthenticated, role, user, logout } = useAuth();
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
    <nav className="bg-slate-900 text-white relative border-b border-slate-800 shadow-sm z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <Link to="/" className="flex items-center gap-3" onClick={closeMobileMenu}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
            <span className="text-xl">📚</span>
          </div>
          <div>
            <span className="font-extrabold text-lg text-white tracking-tight block leading-tight">UniLib</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block -mt-0.5">
              Department Library
            </span>
          </div>
        </Link>

        {/* Center/Right: Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
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
            to="/about"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/about") ? "bg-slate-800 text-blue-400 font-semibold" : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            About
          </Link>
          <Link
            to="/gallery"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/gallery") ? "bg-slate-800 text-blue-400 font-semibold" : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Gallery
          </Link>

          {/* If logged in as student */}
          {isAuthenticated && role === "student" && (
            <>
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
              <Link
                to="/account"
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/account") ? "bg-slate-800 text-blue-400 font-semibold" : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                Account
              </Link>
            </>
          )}

          {/* If logged in as librarian */}
          {isAuthenticated && (role === "librarian" || role === "admin") && (
            <Link
              to="/librarian"
              className="ml-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/50 transition-colors flex items-center gap-1.5"
            >
              <span>🏛</span>
              <span>Librarian Portal</span>
            </Link>
          )}
        </div>

        {/* Desktop Auth Controls */}
        <div className="hidden lg:flex items-center gap-3">
          {isAuthenticated && <Notifications />}

          {isAuthenticated ? (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-700">
              <span className="text-xs text-slate-300 font-medium hidden xl:inline">
                {user?.first_name || user?.username || "Logged in"}
              </span>
              <button
                onClick={handleLogout}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 shadow-md shadow-blue-900/30 flex items-center gap-1.5"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-blue-600 hover:bg-blue-700 !text-white text-white text-sm font-bold px-4 py-2 rounded-lg transition-all duration-200 shadow-md shadow-blue-900/20 flex items-center gap-1.5"
            >
              <span className="!text-white text-white">Sign In</span>
              <svg className="w-4 h-4 !text-white text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
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

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-slate-900 border-t border-slate-800 shadow-2xl z-50">
          <div className="flex flex-col p-4 space-y-1.5">
            <Link to="/" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
              Home
            </Link>
            <Link to="/books" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
              Books
            </Link>
            <Link to="/about" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
              About
            </Link>
            <Link to="/gallery" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
              Gallery
            </Link>

            {isAuthenticated && role === "student" && (
              <>
                <div className="h-px bg-slate-800 my-2" />
                <Link to="/recommendations" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
                  Recommendations
                </Link>
                <Link to="/my-borrows" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
                  My Borrows
                </Link>
                <Link to="/account" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800">
                  Account
                </Link>
              </>
            )}

            {isAuthenticated && (role === "librarian" || role === "admin") && (
              <>
                <div className="h-px bg-slate-800 my-2" />
                <Link to="/librarian" onClick={closeMobileMenu} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-indigo-300 bg-indigo-900/30">
                  🏛 Librarian Portal
                </Link>
              </>
            )}

            <div className="pt-3 border-t border-slate-800">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm"
                >
                  Logout
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={closeMobileMenu}
                  className="w-full bg-blue-600 hover:bg-blue-700 !text-white text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-all duration-200 shadow-md shadow-blue-900/20"
                >
                  <span className="!text-white text-white">Sign In</span>
                  <svg className="w-4 h-4 !text-white text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
