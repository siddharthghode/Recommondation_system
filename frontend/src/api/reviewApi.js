import apiClient from "./axios";

export const getBookReviews = (bookId) =>
  apiClient.get(`/books/${bookId}/reviews/`).catch(() => []);

export const submitReview = (bookId, reviewData) =>
  apiClient.post(`/books/${bookId}/reviews/`, reviewData);

export const updateReview = (bookId, reviewId, reviewData) =>
  apiClient.put(`/books/${bookId}/reviews/${reviewId}/`, reviewData);

export const deleteReview = (bookId, reviewId) =>
  apiClient.delete(`/books/${bookId}/reviews/${reviewId}/`);
