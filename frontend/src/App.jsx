import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";

import Home from "./pages/Home";
import AboutUs from "./pages/AboutUs";
import Gallery from "./pages/Gallery";
import Books from "./pages/Books";
import Login from "./pages/Login";
import Recommendations from "./pages/Recommendations";
import MyBorrows from "./pages/MyBorrows";
import AccountDetails from "./pages/AccountDetails";
import Messages from "./pages/Messages";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBooks from "./pages/admin/AdminBooks";
import AdminStudents from "./pages/admin/AdminStudents";
import LibrarianDashboard from "./pages/LibrarianDashboard";
import ManageBooks from "./pages/ManageBooks";
import StudentsList from "./pages/StudentsList";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <RoutesWithAnimation />
    </BrowserRouter>
  );
}

function RoutesWithAnimation() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/about" element={<PageTransition><AboutUs /></PageTransition>} />
        <Route path="/gallery" element={<PageTransition><Gallery /></PageTransition>} />
        <Route path="/books" element={<PageTransition><Books /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/account" element={<PageTransition><ProtectedRoute><AccountDetails /></ProtectedRoute></PageTransition>} />
        <Route
          path="/recommendations"
          element={<PageTransition><ProtectedRoute><Recommendations /></ProtectedRoute></PageTransition>}
        />

        <Route
          path="/admin"
          element={<PageTransition><ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute></PageTransition>}
        />
        <Route
          path="/admin/books"
          element={<PageTransition><ProtectedRoute role="admin"><AdminBooks /></ProtectedRoute></PageTransition>}
        />
        <Route
          path="/admin/students"
          element={<PageTransition><ProtectedRoute role="admin"><AdminStudents /></ProtectedRoute></PageTransition>}
        />

        <Route
          path="/librarian"
          element={<PageTransition><ProtectedRoute role="librarian"><LibrarianDashboard /></ProtectedRoute></PageTransition>}
        />

        <Route
          path="/librarian/books"
          element={<PageTransition><ProtectedRoute role="librarian"><ManageBooks /></ProtectedRoute></PageTransition>}
        />

        <Route
          path="/librarian/students"
          element={<PageTransition><ProtectedRoute role="librarian"><StudentsList /></ProtectedRoute></PageTransition>}
        />

        <Route
          path="/my-borrows"
          element={<PageTransition><ProtectedRoute role="student"><MyBorrows /></ProtectedRoute></PageTransition>}
        />
        
        <Route
          path="/messages"
          element={<PageTransition><ProtectedRoute><Messages /></ProtectedRoute></PageTransition>}
        />
      </Routes>
    </AnimatePresence>
  );
}
