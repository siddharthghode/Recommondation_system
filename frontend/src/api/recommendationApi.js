import apiClient from "./axios";

export const fetchRecommendations = (limit = 10, method = "hybrid") =>
  apiClient.get("/books/recommendations/", {
    params: { limit, type: method },
    timeout: 30000,
  });

export const trackInteraction = (bookId, interactionType = "view", rating = null) =>
  apiClient.post("/interactions/", { book_id: bookId, interaction_type: interactionType, rating });

export const trackDwellTime = (bookId, durationSeconds) =>
  apiClient.post("/dwell-time/", { book_id: bookId, duration_seconds: durationSeconds });
