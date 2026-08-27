import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const ROLE_HOME = {
  student: "/books",
  librarian: "/librarian",
  admin: "/librarian",
};

export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, role: userRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
          <p className="mt-4 text-slate-400 text-sm">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    return children;
  }

  const allowed = Array.isArray(role) ? role : [role];

  // Super admin / admin has access
  if (userRole === "admin") {
    return children;
  }

  if (allowed.includes(userRole)) {
    return children;
  }

  return <Navigate to={ROLE_HOME[userRole] ?? "/"} replace />;
}
