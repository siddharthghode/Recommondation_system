import apiClient from "./axios";

export const getStudents = (_tokenOrStatus = null, maybeStatus = null) => {
  let status = null;
  if (typeof _tokenOrStatus === "string" && _tokenOrStatus.length > 50) {
    status = maybeStatus;
  } else {
    status = _tokenOrStatus;
  }

  return apiClient.get("/analytics/students/", {
    params: status && status !== "all" ? { status } : {},
  });
};

export const getStudentList = (_token = null) => {
  return apiClient.get("/analytics/students/");
};

export const getPendingStudents = (_token = null) => {
  return apiClient.get("/analytics/students/pending/");
};

export const getStudent = (_tokenOrId, maybeId) => {
  const studentId = maybeId !== undefined ? maybeId : _tokenOrId;
  return apiClient.get(`/analytics/students/${studentId}/`);
};

export const updateStudent = (_tokenOrId, idOrData, maybeData) => {
  const studentId = maybeData !== undefined ? idOrData : _tokenOrId;
  const studentData = maybeData !== undefined ? maybeData : idOrData;
  return apiClient.put(`/analytics/students/${studentId}/`, studentData);
};

export const deleteStudent = (_tokenOrId, maybeId) => {
  const studentId = maybeId !== undefined ? maybeId : _tokenOrId;
  return apiClient.delete(`/analytics/students/${studentId}/`);
};

export const approveStudent = (_tokenOrId, maybeId) => {
  const studentId = maybeId !== undefined ? maybeId : _tokenOrId;
  return apiClient.post(`/analytics/students/${studentId}/approve/`);
};

export const rejectStudent = (_tokenOrId, idOrReason = "", maybeReason = "") => {
  let studentId;
  let reason = "";

  if (maybeReason !== "") {
    studentId = idOrReason;
    reason = maybeReason;
  } else if (typeof idOrReason === "string" && idOrReason !== "") {
    studentId = _tokenOrId;
    reason = idOrReason;
  } else {
    studentId = maybeReason !== "" ? idOrReason : _tokenOrId;
  }

  return apiClient.post(`/analytics/students/${studentId}/reject/`, { reason });
};

export const getStudentBorrows = (_tokenOrId, maybeId) => {
  const studentId = maybeId !== undefined ? maybeId : _tokenOrId;
  return apiClient.get(`/analytics/students/${studentId}/borrows/`);
};

export const getStudentAnalytics = (_tokenOrId, maybeId) => {
  const studentId = maybeId !== undefined ? maybeId : _tokenOrId;
  return apiClient.get(`/analytics/students/${studentId}/analytics/`);
};

// Analytics & Dashboard (replaces dead /admin/stats/ and /admin/students-list/)
export const fetchLibrarianDashboard = (_token = null) => {
  return apiClient.get("/analytics/librarian-dashboard/");
};

export const getAdminStats = (_token = null) => {
  return apiClient.get("/analytics/librarian-dashboard/");
};

export const getAdminStudents = (_token = null) => {
  return apiClient.get("/analytics/students/");
};

export const getAdminBooks = (_token = null) => {
  return apiClient.get("/books/", { params: { page_size: 100 } });
};

// Messaging: routes to real /api/messages/ endpoint with correct payload format
export const sendMessageToStudent = (
  _tokenOrId,
  idOrTitle,
  titleOrMessage,
  maybeMessage
) => {
  let studentId;
  let title;
  let message;

  if (maybeMessage !== undefined) {
    // Called as (token, studentId, title, message)
    studentId = idOrTitle;
    title = titleOrMessage;
    message = maybeMessage;
  } else {
    // Called as (studentId, title, message)
    studentId = _tokenOrId;
    title = idOrTitle;
    message = titleOrMessage;
  }

  return apiClient.post("/messages/", {
    recipient: studentId,
    subject: title,
    body: message,
  });
};

// Notifications
export const getNotifications = (_tokenOrIsRead = null, maybeIsRead = null) => {
  let isRead = null;
  if (typeof _tokenOrIsRead === "string" && _tokenOrIsRead.length > 50) {
    isRead = maybeIsRead;
  } else {
    isRead = _tokenOrIsRead;
  }

  return apiClient.get("/auth/notifications/", {
    params: isRead !== null ? { is_read: isRead } : {},
  });
};

export const markNotificationRead = (_tokenOrId, maybeId) => {
  const notificationId = maybeId !== undefined ? maybeId : _tokenOrId;
  return apiClient.post("/auth/notifications/mark-read/", {
    notification_id: notificationId,
  });
};

export const markAllNotificationsRead = (_token = null) => {
  return apiClient.post("/auth/notifications/mark-all-read/");
};

// Static Page Content (CMS fallbacks)
export const getPageContent = (page) => {
  return apiClient.get(`/pages/${page}/`).catch(() => null);
};

export const listPageContents = (_token = null) => {
  return apiClient.get("/admin/pages/").catch(() => []);
};

export const createPageContent = (_tokenOrData, maybeData) => {
  const pageData = maybeData !== undefined ? maybeData : _tokenOrData;
  return apiClient.post("/admin/pages/create/", pageData).catch(() => ({}));
};

export const updatePageContent = (_tokenOrPage, pageOrData, maybeData) => {
  const page = maybeData !== undefined ? pageOrData : _tokenOrPage;
  const pageData = maybeData !== undefined ? maybeData : pageOrData;
  return apiClient.put(`/admin/pages/${page}/`, pageData).catch(() => ({}));
};

export const deletePageContent = (_tokenOrPage, maybePage) => {
  const page = maybePage !== undefined ? maybePage : _tokenOrPage;
  return apiClient.delete(`/admin/pages/${page}/`).catch(() => ({}));
};
