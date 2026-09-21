import apiClient from "./axios";

// Students
export const getStudents = (status = null) =>
  apiClient.get("/analytics/students/", {
    params: status && status !== "all" ? { status } : {},
  });

export const getStudentList = () => apiClient.get("/analytics/students/");

export const getPendingStudents = () => apiClient.get("/analytics/students/pending/");

export const getStudent = (studentId) =>
  apiClient.get(`/analytics/students/${studentId}/`);

export const updateStudent = (studentId, studentData) =>
  apiClient.put(`/analytics/students/${studentId}/`, studentData);

export const deleteStudent = (studentId) =>
  apiClient.delete(`/analytics/students/${studentId}/`);

export const approveStudent = (studentId) =>
  apiClient.post(`/analytics/students/${studentId}/approve/`);

export const rejectStudent = (studentId, reason = "") =>
  apiClient.post(`/analytics/students/${studentId}/reject/`, { reason });

export const getStudentBorrows = (studentId) =>
  apiClient.get(`/analytics/students/${studentId}/borrows/`);

export const getStudentAnalytics = (studentId) =>
  apiClient.get(`/analytics/students/${studentId}/analytics/`);

// Dashboard & Analytics
export const fetchLibrarianDashboard = () =>
  apiClient.get("/analytics/librarian-dashboard/");

export const getAdminStats = () => apiClient.get("/analytics/librarian-dashboard/");

export const getAdminStudents = () => apiClient.get("/analytics/students/");

export const getAdminBooks = () =>
  apiClient.get("/books/", { params: { page_size: 100 } });

// Messaging
export const sendMessageToStudent = (studentId, title, message) =>
  apiClient.post("/messages/", { recipient: studentId, subject: title, body: message });

// Notifications
export const getNotifications = (isRead = null) =>
  apiClient.get("/auth/notifications/", {
    params: isRead !== null ? { is_read: isRead } : {},
  });

export const markNotificationRead = (notificationId) =>
  apiClient.post("/auth/notifications/mark-read/", { notification_id: notificationId });

export const markAllNotificationsRead = () =>
  apiClient.post("/auth/notifications/mark-all-read/");

// Static Page Content (CMS fallbacks)
export const getPageContent = (page) =>
  apiClient.get(`/pages/${page}/`).catch(() => null);

export const listPageContents = () =>
  apiClient.get("/admin/pages/").catch(() => []);

export const createPageContent = (pageData) =>
  apiClient.post("/admin/pages/create/", pageData).catch(() => ({}));

export const updatePageContent = (page, pageData) =>
  apiClient.put(`/admin/pages/${page}/`, pageData).catch(() => ({}));

export const deletePageContent = (page) =>
  apiClient.delete(`/admin/pages/${page}/`).catch(() => ({}));
