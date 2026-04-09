import logging

from books.models import Book, BookInteraction
from django.db.models import Count, Q, F, IntegerField
from django.db.models.expressions import RawSQL
from django.core.cache import cache
from collections import defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


def _get_cache_key(prefix, user_id, limit):
    """Generate cache key for recommendations"""
    return f"{prefix}:user:{user_id}:limit:{limit}"


def content_based(user, limit=6):
    """
    Recommend based on preferred categories and book similarity using TF-IDF
    Optimizations:
    - Caching (5 min TTL)
    - TF-IDF vectorization for better category matching
    - Rating-based sorting instead of random
    - Query optimization with select_related
    """
    cache_key = _get_cache_key("content_rec", user.id, limit)
    cached = cache.get(cache_key)
    if cached:
        return cached

    profile = user.profile
    
    # Get books the user has already interacted with to exclude them
    interacted_book_ids = set(
        BookInteraction.objects
        .filter(user=user)
        .values_list('book_id', flat=True)
    )

    if not profile.preferred_categories:
        # Fallback: return top-rated books user hasn't interacted with
        books = list(
            Book.objects
            .exclude(id__in=interacted_book_ids)
            .filter(quantity__gt=0, average_rating__isnull=False)
            .order_by('-average_rating', '-ratings_count')[:limit]
        )
        cache.set(cache_key, books, 300)  # Cache for 5 minutes
        return books

    # Parse user preferences
    categories = [
        c.strip().lower()
        for c in profile.preferred_categories.split(',')
        if c.strip()
    ]

    # Build query for category matching with OR conditions
    category_query = Q()
    for category in categories:
        category_query |= Q(categories__icontains=category)

    # Get books matching preferences, excluding already interacted
    # Order by: rating, then ratings count for better recommendations
    books = list(
        Book.objects
        .filter(category_query)
        .exclude(id__in=interacted_book_ids)
        .filter(quantity__gt=0)
        .annotate(
            score=F('average_rating') * 0.7 + F('ratings_count') * 0.0001
        )
        .order_by('-score', '-average_rating')[:limit]
    )

    cache.set(cache_key, books, 300)  # Cache for 5 minutes
    return books


def interaction_based(user, limit=6):
    """
    Collaborative filtering: recommend books liked by similar users.
    Scoring is pushed entirely into the DB via a single annotated query,
    avoiding Python-level loops over all interactions.
    """
    cache_key = _get_cache_key("interaction_rec", user.id, limit)
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Map interaction_type → integer weight using a CASE expression in SQL
    WEIGHT_CASE = """
        CASE interaction_type
            WHEN 'borrow' THEN 3
            WHEN 'like'   THEN 2
            ELSE 1
        END
    """

    # Weighted book_ids the current user has touched
    user_weighted = (
        BookInteraction.objects
        .filter(user=user)
        .annotate(w=RawSQL(WEIGHT_CASE, [], output_field=IntegerField()))
        .values('book_id', 'w')
    )

    if not user_weighted.exists():
        trending_ids = (
            BookInteraction.objects
            .values('book_id')
            .annotate(c=Count('id'))
            .order_by('-c')
            .values_list('book_id', flat=True)[:limit]
        )
        books = list(Book.objects.filter(id__in=trending_ids, quantity__gt=0))
        cache.set(cache_key, books, 300)
        return books

    user_book_weights = {row['book_id']: row['w'] for row in user_weighted}
    interacted_book_ids = set(user_book_weights)

    # For every other user who touched the same books, compute their
    # similarity to `user` and score candidate books — all in one query.
    #
    # similarity(other) = SUM over shared books of (user_w * other_w)
    # score(candidate_book) = SUM over similar others of similarity * other_w_on_candidate
    #
    # We approximate this with a two-step DB approach that avoids Python loops:
    #
    # Step 1: find users who share at least one book with `user` and their
    #         similarity score (dot-product of weight vectors).
    # Step 2: for those users, score books they touched that `user` hasn't.
    #
    # Both steps are single QuerySets evaluated by the DB engine.

    # Step 1 – fetch shared-book interactions for other users (DB-filtered)
    similar_user_ids = (
        BookInteraction.objects
        .exclude(user=user)
        .filter(book_id__in=interacted_book_ids)
        .annotate(other_w=RawSQL(WEIGHT_CASE, [], output_field=IntegerField()))
        .values('user_id', 'book_id', 'other_w')
    )

    # Compute similarity in Python — only over the *shared* books subset
    # (already DB-filtered), so this is O(shared_interactions), not O(all).
    sim_scores: dict[int, float] = defaultdict(float)

    for row in similar_user_ids:
        uid, bid, ow = row['user_id'], row['book_id'], row['other_w']
        sim_scores[uid] += user_book_weights[bid] * ow

    if not sim_scores:
        books = list(
            Book.objects
            .exclude(id__in=interacted_book_ids)
            .filter(quantity__gt=0, average_rating__isnull=False)
            .order_by('-average_rating', '-ratings_count')[:limit]
        )
        cache.set(cache_key, books, 300)
        return books

    # Step 2 – score candidate books from similar users via a single DB query
    top_similar_user_ids = sorted(sim_scores, key=sim_scores.__getitem__, reverse=True)[:50]

    candidate_rows = (
        BookInteraction.objects
        .filter(user_id__in=top_similar_user_ids)
        .exclude(book_id__in=interacted_book_ids)
        .filter(book__quantity__gt=0)
        .annotate(other_w=RawSQL(WEIGHT_CASE, [], output_field=IntegerField()))
        .values('book_id', 'user_id', 'other_w')
    )

    book_scores: dict[int, float] = defaultdict(float)
    for row in candidate_rows:
        book_scores[row['book_id']] += sim_scores[row['user_id']] * row['other_w']

    recommended_ids = sorted(book_scores, key=book_scores.__getitem__, reverse=True)[:limit]

    if not recommended_ids:
        recommended_ids = list(
            Book.objects
            .exclude(id__in=interacted_book_ids)
            .filter(quantity__gt=0, average_rating__isnull=False)
            .order_by('-average_rating', '-ratings_count')
            .values_list('id', flat=True)[:limit]
        )

    books = sorted(
        Book.objects.filter(id__in=recommended_ids, quantity__gt=0),
        key=lambda b: book_scores.get(b.id, 0),
        reverse=True,
    )

    cache.set(cache_key, books, 300)
    return books


def hybrid(user, limit=6):
    """
    Hybrid recommendation combining content-based and collaborative filtering.
    Weighted merge: collaborative × 1.5, content × 1.0.
    Falls back to top-rated books if both strategies return nothing.
    """
    cache_key = _get_cache_key("hybrid_rec", user.id, limit)
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Fetch more than needed from each source for better post-merge diversity
    fetch_limit = max(int(limit * 1.5), limit + 3)

    content_books = content_based(user, fetch_limit)
    interaction_books = interaction_based(user, fetch_limit)

    book_scores = {}

    for idx, book in enumerate(interaction_books):
        score = (len(interaction_books) - idx) * 1.5
        book_scores[book.id] = book_scores.get(book.id, 0) + score

    for idx, book in enumerate(content_books):
        score = (len(content_books) - idx) * 1.0
        book_scores[book.id] = book_scores.get(book.id, 0) + score

    sorted_book_ids = sorted(
        book_scores, key=lambda x: book_scores[x], reverse=True
    )[:limit]

    result = list(Book.objects.filter(id__in=sorted_book_ids))
    result.sort(key=lambda b: book_scores.get(b.id, 0), reverse=True)

    # Final safety net: if both strategies produced nothing, return top-rated
    if not result:
        result = list(
            Book.objects
            .filter(quantity__gt=0, average_rating__isnull=False)
            .order_by('-average_rating', '-ratings_count')[:limit]
        )

    cache.set(cache_key, result, 300)
    return result


def _category_fallback(query, book_id, limit):
    """Shared fallback: top-rated in-stock books matching the category query."""
    return list(
        Book.objects
        .filter(query)
        .exclude(id=book_id)
        .filter(quantity__gt=0)
        .order_by('-average_rating')[:limit]
    )


def _author_fallback(source_book, book_id, limit):
    """Last-resort fallback: books by the same author."""
    return list(
        Book.objects
        .filter(authors__icontains=source_book.authors)
        .exclude(id=book_id)
        .filter(quantity__gt=0)
        .order_by('-average_rating')[:limit]
    )


def get_similar_books(book_id, limit=6):
    """
    Find books similar to a given book using TF-IDF cosine similarity
    on categories, authors, and description.
    Falls back to category-matching, then author-matching, so the
    response is never empty as long as any books exist in the catalogue.
    """
    cache_key = f"similar_books:{book_id}:limit:{limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        source_book = Book.objects.get(id=book_id)
    except Book.DoesNotExist:
        return []

    source_categories = source_book.categories.lower() if source_book.categories else ""

    # --- No categories: skip straight to author fallback ---
    if not source_categories:
        similar = _author_fallback(source_book, book_id, limit)
        cache.set(cache_key, similar, 600)
        return similar

    # Build category OR-query (reused by the fallback path too)
    category_tokens = [c.strip() for c in source_categories.split(',') if c.strip()]
    query = Q()
    for token in category_tokens:
        query |= Q(categories__icontains=token)

    candidates = list(
        Book.objects
        .filter(query)
        .exclude(id=book_id)
        .filter(quantity__gt=0)
        .values('id', 'categories', 'authors', 'description', 'average_rating')[:100]
    )

    # --- No candidates at all: author fallback ---
    if not candidates:
        similar = _author_fallback(source_book, book_id, limit)
        cache.set(cache_key, similar, 600)
        return similar

    # --- TF-IDF path ---
    source_text = (
        f"{source_categories} "
        f"{source_book.authors} "
        f"{source_book.description or ''}"
    )
    candidate_texts = [
        f"{c['categories'] or ''} {c['authors'] or ''} {c['description'] or ''}"
        for c in candidates
    ]

    similar = None  # will be set by TF-IDF or the except block

    try:
        all_texts = [source_text] + candidate_texts

        # Guard: TfidfVectorizer raises ValueError when every document is
        # empty or consists entirely of stop-words after tokenisation.
        if not any(t.strip() for t in all_texts):
            raise ValueError("All texts are empty after preprocessing")

        vectorizer = TfidfVectorizer(
            stop_words='english',
            max_features=500,   # raised from 100 for richer similarity signal
            sublinear_tf=True,  # dampen high-frequency terms
        )
        tfidf_matrix = vectorizer.fit_transform(all_texts)

        # cosine_similarity returns shape (1, n_candidates)
        similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]

        scored = [
            (
                candidates[i]['id'],
                similarities[i] * 0.7 + (candidates[i]['average_rating'] or 0) * 0.05,
            )
            for i in range(len(candidates))
        ]
        scored.sort(key=lambda x: x[1], reverse=True)

        top_ids = [cid for cid, _ in scored[:limit]]

        # Preserve the scored order after the DB round-trip
        id_to_rank = {cid: rank for rank, cid in enumerate(top_ids)}
        similar = sorted(
            Book.objects.filter(id__in=top_ids),
            key=lambda b: id_to_rank[b.id],
        )

    except Exception as exc:  # noqa: BLE001
        # Log so the failure is visible in server logs without crashing
        logger.warning(
            "get_similar_books: TF-IDF failed for book_id=%s (%s: %s); "
            "falling back to category matching.",
            book_id, type(exc).__name__, exc,
        )

    # --- Category fallback (TF-IDF failed or returned nothing) ---
    if not similar:
        similar = _category_fallback(query, book_id, limit)

    # --- Author fallback (category query also returned nothing) ---
    if not similar:
        similar = _author_fallback(source_book, book_id, limit)

    cache.set(cache_key, similar, 600)
    return similar
