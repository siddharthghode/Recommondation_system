from __future__ import annotations

from collections.abc import Iterable

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import svds
from sklearn.metrics.pairwise import cosine_similarity

from books.models import Book


def train_matrix_factorization(
    user_item_matrix: csr_matrix,
    latent_factors: int = 50,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Train a matrix-factorization model using sparse SVD.

    Returns (U, S, VT). This is intentionally a skeleton so downstream
    training orchestration (normalization, persistence, scheduling) can be
    plugged in without breaking the API.
    """
    if user_item_matrix is None or user_item_matrix.shape[0] == 0 or user_item_matrix.shape[1] == 0:
        raise ValueError("user_item_matrix must be a non-empty sparse matrix")

    k = max(1, min(latent_factors, min(user_item_matrix.shape) - 1))
    u, s, vt = svds(user_item_matrix, k=k)

    # Sort singular values in descending order for deterministic output.
    order = np.argsort(s)[::-1]
    return u[:, order], s[order], vt[order, :]


def get_semantic_recommendations(
    query_text: str,
    query_embedding: Iterable[float] | None = None,
    limit: int = 10,
) -> list[Book]:
    """
    Prepare cosine-similarity recommendations against stored book embeddings.

    query_embedding is optional by design so a future text->embedding pipeline
    can be plugged in without changing callers.
    """
    if not query_text and query_embedding is None:
        return []

    # Placeholder: in production, generate embedding from query_text.
    if query_embedding is None:
        return []

    query_vec = np.asarray(list(query_embedding), dtype=np.float32).reshape(1, -1)

    candidates = list(
        Book.objects.exclude(embedding__isnull=True)
        .exclude(embedding=[])
        .only("id", "title", "authors", "embedding")
    )
    if not candidates:
        return []

    candidate_vectors = np.asarray([book.embedding for book in candidates], dtype=np.float32)
    similarities = cosine_similarity(query_vec, candidate_vectors)[0]

    ranked = sorted(
        zip(candidates, similarities, strict=False),
        key=lambda item: item[1],
        reverse=True,
    )[:limit]
    return [book for book, _ in ranked]
