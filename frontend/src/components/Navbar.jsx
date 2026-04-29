import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notifications from "./Notifications";

export default function Navbar() {
  const role = localStorage.getItem("role");
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("role");
    navigate("/login");
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="bg-gray-900 text-white relative">
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* Left: Library icon */}
        <Link to="/" className="flex items-center gap-3" onClick={closeMobileMenu}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="h-8 w-8 text-yellow-400"
          >
            <path d="M3 6a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6zm7 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V6zm7 0a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1h-1a1 1 0 01-1-1V6z" />
          </svg>
          <span className="font-semibold hidden sm:inline">Department Library</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-6">
          <Link to="/" className="hover:text-yellow-400 transition-colors">
            Home
          </Link>
          <Link to="/about" className="hover:text-yellow-400 transition-colors">
            About
          </Link>
          <Link to="/gallery" className="hover:text-yellow-400 transition-colors">
            Gallery
          </Link>
          <Link to="/books" className="hover:text-yellow-400 transition-colors">
            Books
          </Link>

          {token && role === "student" && (
            <>
              <Link to="/recommendations" className="hover:text-yellow-400 transition-colors">
                Recommendations
              </Link>
              <Link to="/my-borrows" className="hover:text-yellow-400 transition-colors">
                My Borrows
              </Link>
              <Link to="/account" className="hover:text-yellow-400 transition-colors">
                Account
              </Link>
            </>
          )}
          {token && role === "admin" && (
            <Link to="/admin" className="hover:text-yellow-400 transition-colors">
              Admin
            </Link>
          )}

          {token && <Notifications />}

          {token ? (
            <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 transition-colors min-h-[44px]">
              Logout
            </button>
          ) : (
            <Link to="/login" className="bg-yellow-500 px-4 py-2 rounded hover:bg-yellow-600 transition-colors flex items-center min-h-[44px]">
              Login
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        <div className="lg:hidden absolute top-full left-0 w-full bg-gray-900 border-t border-gray-700 shadow-xl z-50">
          <div className="flex flex-col py-2">
            <Link 
              to="/" 
              className="px-6 py-3 hover:bg-gray-800 transition-colors min-h-[44px] flex items-center"
              onClick={closeMobileMenu}
            >
              Home
            </Link>
            <Link 
              to="/about" 
              className="px-6 py-3 hover:bg-gray-800 transition-colors min-h-[44px] flex items-center"
              onClick={closeMobileMenu}
            >
              About
            </Link>
            <Link 
              to="/gallery" 
              className="px-6 py-3 hover:bg-gray-800 transition-colors min-h-[44px] flex items-center"
              onClick={closeMobileMenu}
            >
              Gallery
            </Link>
            <Link 
              to="/books" 
              className="px-6 py-3 hover:bg-gray-800 transition-colors min-h-[44px] flex items-center"
              onClick={closeMobileMenu}
            >
              Books
            </Link>

            {token && role === "student" && (
              <>
                <Link 
                  to="/recommendations" 
                  className="px-6 py-3 hover:bg-gray-800 transition-colors min-h-[44px] flex items-center"
                  onClick={closeMobileMenu}
                >
                  Recommendations
                </Link>
                <Link 
                  to="/my-borrows" 
                  className="px-6 py-3 hover:bg-gray-800 transition-colors min-h-[44px] flex items-center"
                  onClick={closeMobileMenu}
                >
                  My Borrows
                </Link>
                <Link 
                  to="/account" 
                  className="px-6 py-3 hover:bg-gray-800 transition-colors min-h-[44px] flex items-center"
                  onClick={closeMobileMenu}
                >
                  Account
                </Link>
              </>
            )}
            {token && role === "admin" && (
              <Link 
                to="/admin" 
                className="px-6 py-3 hover:bg-gray-800 transition-colors min-h-[44px] flex items-center"
                onClick={closeMobileMenu}
              >
                Admin
              </Link>
            )}

            {token ? (
              <button 
                onClick={handleLogout} 
                className="mx-6 my-2 bg-red-500 px-4 py-3 rounded hover:bg-red-600 transition-colors min-h-[44px] text-left"
              >
                Logout
              </button>
            ) : (
              <Link 
                to="/login" 
                className="mx-6 my-2 bg-yellow-500 px-4 py-3 rounded hover:bg-yellow-600 transition-colors min-h-[44px] flex items-center justify-center"
                onClick={closeMobileMenu}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
