import apiClient from "./axios";

export const requestBorrow = (tokenOrBookId, maybeBookId) => {
  const bookId = maybeBookId !== undefined ? maybeBookId : tokenOrBookId;
  return apiClient.post("/borrows/request/", { book_id: bookId });
};

export const returnBook = (tokenOrBorrowId, maybeBorrowId) => {
  const borrowId = maybeBorrowId !== undefined ? maybeBorrowId : tokenOrBorrowId;
  return apiClient.post("/borrows/return/", { borrow_id: borrowId });
};

export const getMyBorrows = (tokenOrStatus = null, maybeStatus = null) => {
  let status = null;
  if (typeof tokenOrStatus === "string" && tokenOrStatus.length > 50) {
    status = maybeStatus;
  } else {
    status = tokenOrStatus;
  }

  return apiClient.get("/borrows/my/", {
    params: status ? { status } : {},
  });
};

export const getBorrowRequests = (_token = null) => {
  return apiClient.get("/borrows/pending/");
};

export const approveBorrow = (_tokenOrId, maybeId) => {
  const borrowId = maybeId !== undefined ? maybeId : _tokenOrId;
  return apiClient.post(`/borrows/approve/${borrowId}/`);
};

export const rejectBorrow = (_tokenOrId, idOrReason = "", maybeReason = "") => {
  let borrowId;
  let reason = "";

  if (maybeReason !== "") {
    // Called as (token, borrowId, reason)
    borrowId = idOrReason;
    reason = maybeReason;
  } else if (typeof idOrReason === "string" && idOrReason !== "") {
    // Called as (borrowId, reason)
    borrowId = _tokenOrId;
    reason = idOrReason;
  } else {
    borrowId = maybeReason !== "" ? idOrReason : _tokenOrId;
  }

  return apiClient.post(`/borrows/reject/${borrowId}/`, { reason });
};

export const getBorrowHistory = (_tokenOrStatus = null, maybeStatus = null) => {
  let status = null;
  if (typeof _tokenOrStatus === "string" && _tokenOrStatus.length > 50) {
    status = maybeStatus;
  } else {
    status = _tokenOrStatus;
  }
  return apiClient.get("/borrows/my/", {
    params: status ? { status } : {},
  });
};

export const getOverdueBooks = (_token = null) => {
  return apiClient.get("/borrows/my/?status=overdue").catch(() => []);
};
