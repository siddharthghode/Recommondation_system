export const BASE_URL = "http://localhost:8000/api";

export const register = (userData) =>
  fetch(`${BASE_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  }).then(async res => {
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      console.error("Non-JSON response from server:", text.substring(0, 500));
      throw new Error(`Server error: ${res.status} ${res.statusText}. ${text.substring(0, 200)}`);
    }
    const data = await res.json();
    if (!res.ok) {
      console.error("Registration error response:", data);
      throw data;
    }
    return data;
  });

export const login = (username, password) =>
  fetch(`${BASE_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data.error || data.detail || "Login failed");
      error.data = data;
      throw error;
    }
    return data;
  });

export const fetchBooks = (params = {}) => {
  const query = new URLSearchParams({
    page_size: 100,
    ...params,
  }).toString();
  return fetch(`${BASE_URL}/books/?${query}`).then(res => res.json());
};

export const fetchRecommendations = async (token, n = 10, method = "hybrid") => {
  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  const url = `${BASE_URL}/books/recommendations/?limit=${n}&type=${method}`;

  // Ensure authenticatedFetch uses the passed token.
  localStorage.setItem("token", token);

  try {
    const res = await authenticatedFetch(url, { signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;
    return data;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Request timeout - recommendations are taking too long");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const trackInteraction = async (
  token,
  bookId,
  interactionType = "view",
  rating = null
) => {
  localStorage.setItem("token", token);

  const res = await authenticatedFetch(`${BASE_URL}/interactions/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book_id: bookId,
      interaction_type: interactionType,
      rating: rating,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
};

// Dwell-time tracking (how long a user stays on a book)
export const trackDwellTime = async (token, bookId, durationSeconds) => {
  if (!token) throw new Error("token is required to track dwell time");
  if (!bookId) throw new Error("bookId is required to track dwell time");
  if (durationSeconds == null) throw new Error("durationSeconds is required to track dwell time");

  // Ensure the authenticatedFetch wrapper uses the right token.
  localStorage.setItem("token", token);

  const res = await authenticatedFetch(`${BASE_URL}/dwell-time/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book_id: bookId,
      duration: durationSeconds,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
};

// Helper function to get auth headers
const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
});

// Token refresh helper
export const refreshToken = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }
  
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    
    if (!res.ok) {
      throw new Error("Token refresh failed");
    }
    
    const data = await res.json();
    localStorage.setItem("token", data.access);
    if (data.refresh) {
      localStorage.setItem("refreshToken", data.refresh);
    }
    return data.access;
  } catch (err) {
    // Clear tokens on refresh failure
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("role");
    throw err;
  }
};

// Enhanced fetch with automatic token refresh
export const authenticatedFetch = async (url, options = {}) => {
  const initialToken = localStorage.getItem("token");

  const doFetch = (tokenToUse) =>
    fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${tokenToUse}` },
    });

  const res = await doFetch(initialToken);

  // Only attempt refresh on 401 from the *first* request (not a retry)
  if (res.status === 401) {
    try {
      const newToken = await refreshToken(); // updates localStorage internally
      return doFetch(newToken);              // single retry — never recurses
    } catch {
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }
  }

  return res;
};

// Student Borrow/Return APIs
export const requestBorrow = async (token, bookId) => {
  localStorage.setItem("token", token);

  const res = await authenticatedFetch(`${BASE_URL}/borrows/request/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book_id: bookId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
};

export const returnBook = async (token, borrowId) => {
  localStorage.setItem("token", token);

  const res = await authenticatedFetch(`${BASE_URL}/borrows/return/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ borrow_id: borrowId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
};

export const getMyBorrows = async (token, status = null) => {
  const url = status 
    ? `${BASE_URL}/borrows/my/?status=${status}`
    : `${BASE_URL}/borrows/my/`;
  localStorage.setItem("token", token);

  const res = await authenticatedFetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw data;
  return data;
};

// Admin APIs (borrow management)
export const getBorrowRequests = (token, status = 'pending') =>
  fetch(`${BASE_URL}/borrows/pending/`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }).then(async res => {
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      console.error('getBorrowRequests error:', errorData);
      throw errorData;
    }
    const data = await res.json();
    console.log('getBorrowRequests success:', data);
    return data;
  });

export const approveBorrow = (token, borrowId) =>
  fetch(`${BASE_URL}/borrows/approve/${borrowId}/`, {
    method: 'POST',
    headers: getAuthHeaders(token)
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const rejectBorrow = (token, borrowId, reason = '') =>
  fetch(`${BASE_URL}/borrows/reject/${borrowId}/`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ reason })
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const getBorrowHistory = (token, status = null) => {
  const url = status
    ? `${BASE_URL}/admin/borrow-history/?status=${status}`
    : `${BASE_URL}/admin/borrow-history/`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });
};

export const getOverdueBooks = (token) =>
  fetch(`${BASE_URL}/admin/overdue-books/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const getStudentList = (token) =>
  fetch(`${BASE_URL}/admin/students/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const getStudent = (token, studentId) =>
  fetch(`${BASE_URL}/admin/students/${studentId}/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const updateStudent = (token, studentId, studentData) =>
  fetch(`${BASE_URL}/admin/students/${studentId}/`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(studentData)
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const deleteStudent = (token, studentId) =>
  fetch(`${BASE_URL}/admin/students/${studentId}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    if (res.status === 204) return { success: true };
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const sendMessageToStudent = (token, studentId, title, message) =>
  fetch(`${BASE_URL}/librarian/message/`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ student_id: studentId, title, message })
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

// Admin APIs
export const createBook = (token, bookData) =>
  fetch(`${BASE_URL}/admin/books/`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(bookData)
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const updateBook = (token, bookId, bookData) =>
  fetch(`${BASE_URL}/admin/books/${bookId}/`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(bookData)
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const deleteBook = (token, bookId) =>
  fetch(`${BASE_URL}/admin/books/${bookId}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    if (res.status === 204) return { success: true };
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

// Category APIs
export const getCategories = (token) =>
  fetch(`${BASE_URL}/categories/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const createCategory = (token, categoryData) =>
  fetch(`${BASE_URL}/categories/`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(categoryData)
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const updateCategory = (token, categoryId, categoryData) =>
  fetch(`${BASE_URL}/categories/${categoryId}/`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(categoryData)
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const deleteCategory = (token, categoryId) =>
  fetch(`${BASE_URL}/categories/${categoryId}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    if (res.status === 204) return { success: true };
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

// Notification APIs
export const getNotifications = (token, isRead = null) => {
  const url = isRead !== null
    ? `${BASE_URL}/auth/notifications/?is_read=${isRead}`
    : `${BASE_URL}/auth/notifications/`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });
};

export const markNotificationRead = (token, notificationId) =>
  fetch(`${BASE_URL}/auth/notifications/mark-read/`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ notification_id: notificationId })
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const markAllNotificationsRead = (token) =>
  fetch(`${BASE_URL}/auth/notifications/mark-all-read/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

// Page Content APIs (Public & Admin)
export const getPageContent = (page) =>
  fetch(`${BASE_URL}/pages/${page}/`).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const listPageContents = (token) =>
  fetch(`${BASE_URL}/admin/pages/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const createPageContent = (token, pageData) =>
  fetch(`${BASE_URL}/admin/pages/create/`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(pageData)
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const updatePageContent = (token, page, pageData) =>
  fetch(`${BASE_URL}/admin/pages/${page}/`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(pageData)
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const deletePageContent = (token, page) =>
  fetch(`${BASE_URL}/admin/pages/${page}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    if (res.status === 204) return { success: true };
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

// Admin Data APIs
export const getAdminStats = (token) =>
  fetch(`${BASE_URL}/admin/stats/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const getAdminStudents = (token) =>
  fetch(`${BASE_URL}/admin/students-list/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const getAdminBooks = (token) =>
  fetch(`${BASE_URL}/admin/books-list/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

// Similar Books API
export const getSimilarBooks = (bookId) =>
  fetch(`${BASE_URL}/books/${bookId}/similar/`).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

//fetchLibrarianDashboar
export async function fetchLibrarianDashboard(token) {
  const res = await fetch(`${BASE_URL}/analytics/librarian-dashboard/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to load dashboard");
  }

  return res.json();
}

// Students API for librarian
export const getStudents = (token) =>
  fetch(`${BASE_URL}/analytics/students/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const getStudentBorrows = (token, studentId) =>
  fetch(`${BASE_URL}/analytics/students/${studentId}/borrows/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

export const getStudentAnalytics = (token, studentId) =>
  fetch(`${BASE_URL}/analytics/students/${studentId}/analytics/`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });
