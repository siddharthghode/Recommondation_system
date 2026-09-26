import apiClient from "./axios";

export const requestBorrow = (bookId) =>
  apiClient.post("/borrows/request/", { book_id: bookId });

export const returnBook = (borrowId) =>
  apiClient.post("/borrows/return/", { borrow_id: borrowId });

export const getMyBorrows = (status = null) =>
  apiClient.get("/borrows/my/", { params: status ? { status } : {} });

export const getBorrowRequests = () => apiClient.get("/borrows/pending/");

export const approveBorrow = (borrowId) =>
  apiClient.post(`/borrows/approve/${borrowId}/`);

export const rejectBorrow = (borrowId, reason = "") =>
  apiClient.post(`/borrows/reject/${borrowId}/`, { reason });

export const getBorrowHistory = (status = null) =>
  apiClient.get("/borrows/my/", { params: status ? { status } : {} });

export const getOverdueBooks = () =>
  apiClient.get("/borrows/my/?status=overdue").catch(() => []);

export const getDepartmentBorrows = (status = null) =>
  apiClient.get("/borrows/department/", { params: status ? { status } : {} });
