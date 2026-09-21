import { apiClient, BASE_URL } from "../api";

// Re-export everything from the new modular API layer
export * from "../api";

// ── Backward-compatibility shims ─────────────────────────────────────────────
// Several pages still call these with a token as the first argument (legacy
// pattern). The new API functions no longer accept a token — the axios
// interceptor handles auth automatically. These shims detect and drop the
// legacy token argument so callers need no changes.

import {
  fetchRecommendations as _fetchRecommendations,
  trackInteraction as _trackInteraction,
  trackDwellTime as _trackDwellTime,
} from "../api/recommendationApi";

import {
  getMyBorrows as _getMyBorrows,
  returnBook as _returnBook,
  requestBorrow as _requestBorrow,
  getBorrowRequests as _getBorrowRequests,
  approveBorrow as _approveBorrow,
  rejectBorrow as _rejectBorrow,
  getBorrowHistory as _getBorrowHistory,
  getOverdueBooks as _getOverdueBooks,
} from "../api/borrowApi";

import {
  createBook as _createBook,
  updateBook as _updateBook,
  deleteBook as _deleteBook,
  getCategories as _getCategories,
  createCategory as _createCategory,
  updateCategory as _updateCategory,
  deleteCategory as _deleteCategory,
  importBooksCSV as _importBooksCSV,
} from "../api/bookApi";

import {
  getStudents as _getStudents,
  getStudentList as _getStudentList,
  getPendingStudents as _getPendingStudents,
  getStudent as _getStudent,
  updateStudent as _updateStudent,
  deleteStudent as _deleteStudent,
  approveStudent as _approveStudent,
  rejectStudent as _rejectStudent,
  getStudentBorrows as _getStudentBorrows,
  getStudentAnalytics as _getStudentAnalytics,
  fetchLibrarianDashboard as _fetchLibrarianDashboard,
  getAdminStats as _getAdminStats,
  getAdminStudents as _getAdminStudents,
  getAdminBooks as _getAdminBooks,
  sendMessageToStudent as _sendMessageToStudent,
  getNotifications as _getNotifications,
  markNotificationRead as _markNotificationRead,
  markAllNotificationsRead as _markAllNotificationsRead,
  getPageContent as _getPageContent,
  listPageContents as _listPageContents,
  createPageContent as _createPageContent,
  updatePageContent as _updatePageContent,
  deletePageContent as _deletePageContent,
} from "../api/userApi";

const isLegacyToken = (v) => typeof v === "string" && v.length > 50;

export const fetchRecommendations = (tokenOrLimit, limitOrMethod, maybeMethod) => {
  if (isLegacyToken(tokenOrLimit)) {
    return _fetchRecommendations(
      typeof limitOrMethod === "number" ? limitOrMethod : 10,
      typeof maybeMethod === "string" ? maybeMethod : "hybrid"
    );
  }
  return _fetchRecommendations(tokenOrLimit, limitOrMethod);
};

export const trackInteraction = (tokenOrBookId, bookIdOrType, typeOrRating, maybeRating) => {
  if (isLegacyToken(tokenOrBookId)) {
    return _trackInteraction(bookIdOrType, typeOrRating || "view", maybeRating);
  }
  return _trackInteraction(tokenOrBookId, bookIdOrType, typeOrRating);
};

export const trackDwellTime = (tokenOrBookId, bookIdOrDuration, maybeDuration) => {
  if (isLegacyToken(tokenOrBookId)) {
    return _trackDwellTime(bookIdOrDuration, maybeDuration);
  }
  return _trackDwellTime(tokenOrBookId, bookIdOrDuration);
};

export const getMyBorrows = (tokenOrStatus, maybeStatus) => {
  if (isLegacyToken(tokenOrStatus)) return _getMyBorrows(maybeStatus);
  return _getMyBorrows(tokenOrStatus);
};

export const returnBook = (tokenOrBorrowId, maybeBorrowId) => {
  if (isLegacyToken(tokenOrBorrowId)) return _returnBook(maybeBorrowId);
  return _returnBook(tokenOrBorrowId);
};

export const requestBorrow = (tokenOrBookId, maybeBookId) => {
  if (isLegacyToken(tokenOrBookId)) return _requestBorrow(maybeBookId);
  return _requestBorrow(tokenOrBookId);
};

export const getBorrowRequests = (_token) => _getBorrowRequests();

export const approveBorrow = (tokenOrId, maybeId) => {
  if (isLegacyToken(tokenOrId)) return _approveBorrow(maybeId);
  return _approveBorrow(tokenOrId);
};

export const rejectBorrow = (tokenOrId, idOrReason = "", maybeReason = "") => {
  if (isLegacyToken(tokenOrId)) return _rejectBorrow(idOrReason, maybeReason);
  return _rejectBorrow(tokenOrId, idOrReason);
};

export const getStudents = (tokenOrStatus, maybeStatus) => {
  if (isLegacyToken(tokenOrStatus)) return _getStudents(maybeStatus);
  return _getStudents(tokenOrStatus);
};

export const approveStudent = (tokenOrId, maybeId) => {
  if (isLegacyToken(tokenOrId)) return _approveStudent(maybeId);
  return _approveStudent(tokenOrId);
};

export const rejectStudent = (tokenOrId, idOrReason = "", maybeReason = "") => {
  if (isLegacyToken(tokenOrId)) return _rejectStudent(idOrReason, maybeReason);
  return _rejectStudent(tokenOrId, idOrReason);
};

export const getStudentBorrows = (tokenOrId, maybeId) => {
  if (isLegacyToken(tokenOrId)) return _getStudentBorrows(maybeId);
  return _getStudentBorrows(tokenOrId);
};

export const getStudentAnalytics = (tokenOrId, maybeId) => {
  if (isLegacyToken(tokenOrId)) return _getStudentAnalytics(maybeId);
  return _getStudentAnalytics(tokenOrId);
};

export const fetchLibrarianDashboard = (_token) => _fetchLibrarianDashboard();

export const getNotifications = (tokenOrIsRead, maybeIsRead) => {
  if (isLegacyToken(tokenOrIsRead)) return _getNotifications(maybeIsRead);
  return _getNotifications(tokenOrIsRead);
};

export const markNotificationRead = (tokenOrId, maybeId) => {
  if (isLegacyToken(tokenOrId)) return _markNotificationRead(maybeId);
  return _markNotificationRead(tokenOrId);
};

export const markAllNotificationsRead = (_token) => _markAllNotificationsRead();

export const getBorrowHistory = (tokenOrStatus, maybeStatus) => {
  if (isLegacyToken(tokenOrStatus)) return _getBorrowHistory(maybeStatus);
  return _getBorrowHistory(tokenOrStatus);
};

export const getOverdueBooks = (_token) => _getOverdueBooks();

export const createBook = (tokenOrData, maybeData) => {
  const data = maybeData !== undefined ? maybeData : tokenOrData;
  return _createBook(data);
};

export const updateBook = (tokenOrId, idOrData, maybeData) => {
  const id = maybeData !== undefined ? idOrData : tokenOrId;
  const data = maybeData !== undefined ? maybeData : idOrData;
  return _updateBook(id, data);
};

export const deleteBook = (tokenOrId, maybeId) => {
  const id = maybeId !== undefined ? maybeId : tokenOrId;
  return _deleteBook(id);
};

export const getCategories = (_token) => _getCategories();

export const createCategory = (tokenOrData, maybeData) => {
  const data = maybeData !== undefined ? maybeData : tokenOrData;
  return _createCategory(data);
};

export const updateCategory = (tokenOrId, idOrData, maybeData) => {
  const id = maybeData !== undefined ? idOrData : tokenOrId;
  const data = maybeData !== undefined ? maybeData : idOrData;
  return _updateCategory(id, data);
};

export const deleteCategory = (tokenOrId, maybeId) => {
  const id = maybeId !== undefined ? maybeId : tokenOrId;
  return _deleteCategory(id);
};

export const importBooksCSV = (tokenOrFile, maybeFile) => {
  const file = maybeFile !== undefined ? maybeFile : tokenOrFile;
  return _importBooksCSV(file);
};

export const getStudentList = (_token) => _getStudentList();
export const getPendingStudents = (_token) => _getPendingStudents();

export const getStudent = (tokenOrId, maybeId) => {
  const id = maybeId !== undefined ? maybeId : tokenOrId;
  return _getStudent(id);
};

export const updateStudent = (tokenOrId, idOrData, maybeData) => {
  const id = maybeData !== undefined ? idOrData : tokenOrId;
  const data = maybeData !== undefined ? maybeData : idOrData;
  return _updateStudent(id, data);
};

export const deleteStudent = (tokenOrId, maybeId) => {
  const id = maybeId !== undefined ? maybeId : tokenOrId;
  return _deleteStudent(id);
};

export const getAdminStats = (_token) => _getAdminStats();
export const getAdminStudents = (_token) => _getAdminStudents();
export const getAdminBooks = (_token) => _getAdminBooks();

export const sendMessageToStudent = (tokenOrId, idOrTitle, titleOrMessage, maybeMessage) => {
  let studentId;
  let title;
  let message;
  if (maybeMessage !== undefined) {
    studentId = idOrTitle;
    title = titleOrMessage;
    message = maybeMessage;
  } else {
    studentId = tokenOrId;
    title = idOrTitle;
    message = titleOrMessage;
  }
  return _sendMessageToStudent(studentId, title, message);
};

export const getPageContent = (page) => _getPageContent(page);
export const listPageContents = (_token) => _listPageContents();

export const createPageContent = (tokenOrData, maybeData) => {
  const data = maybeData !== undefined ? maybeData : tokenOrData;
  return _createPageContent(data);
};

export const updatePageContent = (tokenOrPage, pageOrData, maybeData) => {
  const page = maybeData !== undefined ? pageOrData : tokenOrPage;
  const data = maybeData !== undefined ? maybeData : pageOrData;
  return _updatePageContent(page, data);
};

export const deletePageContent = (tokenOrPage, maybePage) => {
  const page = maybePage !== undefined ? maybePage : tokenOrPage;
  return _deletePageContent(page);
};

// ── Legacy authenticatedFetch wrapper ────────────────────────────────────────
export const authenticatedFetch = async (url, options = {}) => {
  const method = (options.method || "GET").toLowerCase();
  let data;
  if (options.body) {
    try {
      data = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    } catch {
      data = options.body;
    }
  }
  const relativeUrl = url.startsWith(BASE_URL) ? url.slice(BASE_URL.length) : url;
  try {
    const resData = await apiClient({ method, url: relativeUrl, headers: options.headers || {}, signal: options.signal, data });
    return { ok: true, status: 200, json: async () => resData, text: async () => JSON.stringify(resData), data: resData };
  } catch (err) {
    const errorStatus = err?.response?.status || err?.status || 500;
    const errorData = err?.response?.data || err;
    return { ok: false, status: errorStatus, json: async () => errorData, text: async () => typeof errorData === "string" ? errorData : JSON.stringify(errorData), data: errorData };
  }
};

export { BASE_URL };
export default apiClient;
