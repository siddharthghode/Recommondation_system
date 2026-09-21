import apiClient from "./axios";

export const fetchRecommendations = (
  limitOrToken = 10,
  methodOrLimit = "hybrid",
  maybeMethod = "hybrid"
) => {
  let limit = 10;
  let method = "hybrid";

  if (typeof limitOrToken === "string" && limitOrToken.length > 50) {
    // Legacy call: (token, n, method)
    limit = typeof methodOrLimit === "number" ? methodOrLimit : 10;
    method = typeof maybeMethod === "string" ? maybeMethod : "hybrid";
  } else if (typeof limitOrToken === "number") {
    limit = limitOrToken;
    method = typeof methodOrLimit === "string" ? methodOrLimit : "hybrid";
  }

  return apiClient.get("/books/recommendations/", {
    params: {
      limit,
      type: method,
    },
    timeout: 30000,
  });
};

export const trackInteraction = (
  tokenOrBookId,
  bookIdOrType = "view",
  typeOrRating = null,
  maybeRating = null
) => {
  let bookId;
  let interactionType = "view";
  let rating = null;

  if (typeof tokenOrBookId === "string" && tokenOrBookId.length > 50) {
    // Legacy signature: (token, bookId, interactionType, rating)
    bookId = bookIdOrType;
    interactionType = typeOrRating || "view";
    rating = maybeRating;
  } else {
    // Modern signature: (bookId, interactionType, rating)
    bookId = tokenOrBookId;
    interactionType = typeof bookIdOrType === "string" ? bookIdOrType : "view";
    rating = typeOrRating;
  }

  return apiClient.post("/interactions/", {
    book_id: bookId,
    interaction_type: interactionType,
    rating,
  });
};

export const trackDwellTime = (
  tokenOrBookId,
  bookIdOrDuration,
  maybeDuration
) => {
  let bookId;
  let durationSeconds;

  if (typeof tokenOrBookId === "string" && tokenOrBookId.length > 50) {
    // Legacy signature: (token, bookId, durationSeconds)
    bookId = bookIdOrDuration;
    durationSeconds = maybeDuration;
  } else {
    // Modern signature: (bookId, durationSeconds)
    bookId = tokenOrBookId;
    durationSeconds = bookIdOrDuration;
  }

  return apiClient.post("/dwell-time/", {
    book_id: bookId,
    duration_seconds: durationSeconds,
  });
};

export const getSimilarBooks = (bookId) => {
  return apiClient.get(`/books/${bookId}/similar/`);
};
