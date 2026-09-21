import apiClient from "./axios";

export const fetchBooks = (params = {}) =>
  apiClient.get("/books/", { params: { page_size: 100, ...params } });

export const getBookCategories = (department = null) =>
  apiClient.get("/books/categories/", { params: department ? { department } : {} }).catch(() => []);

export const getCategories = () =>
  apiClient.get("/books/categories/").catch(() => []);

export const createCategory = (categoryData) =>
  apiClient.post("/books/categories/", categoryData);

export const updateCategory = (categoryId, categoryData) =>
  apiClient.put(`/books/categories/${categoryId}/`, categoryData);

export const deleteCategory = (categoryId) =>
  apiClient.delete(`/books/categories/${categoryId}/`);

export const createBook = (bookData) =>
  apiClient.post("/books/manage/", bookData);

export const updateBook = (bookId, bookData) =>
  apiClient.put(`/books/manage/${bookId}/`, bookData);

export const deleteBook = (bookId) =>
  apiClient.delete(`/books/manage/${bookId}/`);

export const importBooksCSV = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post("/books/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getSimilarBooks = (bookId) =>
  apiClient.get(`/books/${bookId}/similar/`);
