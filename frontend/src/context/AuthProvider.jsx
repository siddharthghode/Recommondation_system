import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContextCore';
import { BASE_URL, refreshToken as apiRefreshToken } from '../services/api';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [role, setRole] = useState(() => localStorage.getItem('role') || null);
  const [approvalStatus, setApprovalStatus] = useState(() => localStorage.getItem('approval_status') || null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch full user profile from backend
  const fetchUserProfile = useCallback(async (authToken) => {
    if (!authToken) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const res = await fetch(`${BASE_URL}/auth/me/`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.status === 401) {
        // Attempt one token refresh
        try {
          const newToken = await apiRefreshToken();
          if (newToken) {
            setToken(newToken);
            return fetchUserProfile(newToken);
          }
        } catch {
          logout();
          return null;
        }
      }

      if (!res.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data = await res.json();
      setUser(data);

      const userRole = data.is_superuser || data.is_staff ? 'admin' : (data.role || 'student');
      const userApproval = data.profile?.approval_status || data.approval_status || 'approved';
      
      setRole(userRole);
      setApprovalStatus(userApproval);

      localStorage.setItem('role', userRole);
      localStorage.setItem('approval_status', userApproval);
      if (data.department) {
        localStorage.setItem('dept', data.department);
      } else if (data.profile?.department) {
        localStorage.setItem('dept', data.profile.department);
      }

      return data;
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      fetchUserProfile(storedToken);
    } else {
      setIsLoading(false);
    }

    // Cross-tab sync
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        setToken(e.newValue);
        if (e.newValue) {
          fetchUserProfile(e.newValue);
        } else {
          setUser(null);
          setRole(null);
          setApprovalStatus(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchUserProfile]);

  const login = async (authData) => {
    const { access, refresh, role: authRole, approval_status: authApproval } = authData;

    if (access) {
      localStorage.setItem('token', access);
      setToken(access);
    }
    if (refresh) {
      localStorage.setItem('refreshToken', refresh);
    }
    if (authRole) {
      localStorage.setItem('role', authRole);
      setRole(authRole);
    }
    if (authApproval) {
      localStorage.setItem('approval_status', authApproval);
      setApprovalStatus(authApproval);
    }

    // Immediately fetch full profile to have department and student_id populated
    if (access) {
      await fetchUserProfile(access);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('role');
    localStorage.removeItem('approval_status');
    localStorage.removeItem('dept');

    setToken(null);
    setRole(null);
    setApprovalStatus(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      return fetchUserProfile(currentToken);
    }
    return null;
  };

  // Derive department helper
  const departmentName = user?.department || user?.profile?.department || localStorage.getItem('dept') || '';

  const value = {
    user,
    token,
    role,
    approvalStatus,
    department: departmentName,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
