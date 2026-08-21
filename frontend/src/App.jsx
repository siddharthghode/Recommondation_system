import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";

// Layouts
import PublicLayout from "./layouts/PublicLayout";
import StudentLayout from "./layouts/StudentLayout";
import LibrarianLayout from "./layouts/LibrarianLayout";

// Public Pages
import Home from "./pages/Home";
import AboutUs from "./pages/AboutUs";
import Gallery from "./pages/Gallery";
import Books from "./pages/Books";
import Login from "./pages/Login";

// Student Protected Pages
import Recommendations from "./pages/Recommendations";
import MyBorrows from "./pages/MyBorrows";
import AccountDetails from "./pages/AccountDetails";

// Librarian Protected Pages
import LibrarianDashboard from "./pages/LibrarianDashboard";
import ManageBooks from "./pages/ManageBooks";
import StudentsList from "./pages/StudentsList";
import LibrarianBorrowing from "./pages/librarian/LibrarianBorrowing";
import LibrarianReturns from "./pages/librarian/LibrarianReturns";
import LibrarianReports from "./pages/librarian/LibrarianReports";

// Admin Protected Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBooks from "./pages/admin/AdminBooks";
import AdminStudents from "./pages/admin/AdminStudents";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public Layout Routes (Home, Books, About, Gallery, Login) ── */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<PageTransition><Home /></PageTransition>} />
            <Route path="/about" element={<PageTransition><AboutUs /></PageTransition>} />
            <Route path="/gallery" element={<PageTransition><Gallery /></PageTransition>} />
            <Route path="/books" element={<PageTransition><Books /></PageTransition>} />
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
          </Route>

          {/* ── Student Protected Layout Routes (Account, Recommendations, My Borrows) ── */}
          <Route
            element={
              <ProtectedRoute role="student">
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/account" element={<PageTransition><AccountDetails /></PageTransition>} />
            <Route path="/recommendations" element={<PageTransition><Recommendations /></PageTransition>} />
            <Route path="/my-borrows" element={<PageTransition><MyBorrows /></PageTransition>} />
          </Route>

          {/* ── Librarian Protected Layout Routes (Dashboard, Catalog, Students, Circulation) ── */}
          <Route
            element={
              <ProtectedRoute role={["librarian", "admin"]}>
                <LibrarianLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/librarian" element={<PageTransition><LibrarianDashboard /></PageTransition>} />
            <Route path="/librarian/books" element={<PageTransition><ManageBooks /></PageTransition>} />
            <Route path="/librarian/students" element={<PageTransition><StudentsList /></PageTransition>} />
            <Route path="/librarian/borrowing" element={<PageTransition><LibrarianBorrowing /></PageTransition>} />
            <Route path="/librarian/returns" element={<PageTransition><LibrarianReturns /></PageTransition>} />
            <Route path="/librarian/reports" element={<PageTransition><LibrarianReports /></PageTransition>} />

            {/* Admin Specific Routes (can also be rendered inside Librarian/Admin portal) */}
            <Route path="/admin" element={<PageTransition><AdminDashboard /></PageTransition>} />
            <Route path="/admin/books" element={<PageTransition><AdminBooks /></PageTransition>} />
            <Route path="/admin/students" element={<PageTransition><AdminStudents /></PageTransition>} />
          </Route>

          {/* ── Catch-all Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
