import apiClient from "./axios";

export const fetchBooks = (params = {}) => {
  return apiClient.get("/books/", {
    params: {
      page_size: 100,
      ...params,
    },
  });
};

export const getBookCategories = (department = null) => {
  return apiClient
    .get("/books/categories/", {
      params: department ? { department } : {},
    })
    .catch(() => []);
};

// Aliases for categories matching live backend endpoints
export const getCategories = (_token = null) => {
  return apiClient.get("/books/categories/").catch(() => []);
};

export const createCategory = (_tokenOrData, data) => {
  const categoryData = data !== undefined ? data : _tokenOrData;
  return apiClient.post("/books/categories/", categoryData);
};

export const updateCategory = (_tokenOrId, idOrData, maybeData) => {
  const categoryId = maybeData !== undefined ? idOrData : _tokenOrId;
  const categoryData = maybeData !== undefined ? maybeData : idOrData;
  return apiClient.put(`/books/categories/${categoryId}/`, categoryData);
};

export const deleteCategory = (_tokenOrId, maybeId) => {
  const categoryId = maybeId !== undefined ? maybeId : _tokenOrId;
  return apiClient.delete(`/books/categories/${categoryId}/`);
};

// Manage Books CRUD (mapped to /books/manage/ instead of dead /admin/books/)
export const createBook = (_tokenOrData, maybeData) => {
  const bookData = maybeData !== undefined ? maybeData : _tokenOrData;
  return apiClient.post("/books/manage/", bookData);
};

export const updateBook = (_tokenOrId, idOrData, maybeData) => {
  const bookId = maybeData !== undefined ? idOrData : _tokenOrId;
  const bookData = maybeData !== undefined ? maybeData : idOrData;
  return apiClient.put(`/books/manage/${bookId}/`, bookData);
};

export const deleteBook = (_tokenOrId, maybeId) => {
  const bookId = maybeId !== undefined ? maybeId : _tokenOrId;
  return apiClient.delete(`/books/manage/${bookId}/`);
};

export const importBooksCSV = (_tokenOrFile, maybeFile) => {
  const file = maybeFile !== undefined ? maybeFile : _tokenOrFile;
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post("/books/import/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const getSimilarBooks = (bookId) => {
  return apiClient.get(`/books/${bookId}/similar/`);
};
