import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";

const ROLE_HOME = {
  student: "/account",
  librarian: "/librarian",
  admin: "/admin",
};

export default function ProtectedRoute({ children, role }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [userRole, setUserRole] = useState(() => localStorage.getItem("role"));

  // Keep state in sync when another tab clears localStorage (logout elsewhere)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "token")   setToken(e.newValue);
      if (e.key === "role")    setUserRole(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!token) return <Navigate to="/login" replace />;

  if (!role) return children;

  const allowed = Array.isArray(role) ? role : [role];

  if (userRole === "admin") return children;

  if (allowed.includes(userRole)) return children;

  return <Navigate to={ROLE_HOME[userRole] ?? "/"} replace />;
}
