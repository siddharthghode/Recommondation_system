import logging

from books.models import Book, BookInteraction, BookDwellTime
from django.db.models import Count, Q, F, IntegerField
from django.db.models.expressions import RawSQL
from django.core.cache import cache
from collections import defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


def _get_department_for_user(user):
    """Return the Department instance for a scoped user, or None for admin/superuser or unapproved students."""
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    if getattr(user, 'is_superuser', False) or getattr(user, 'role', '') == 'admin':
        return None
    if getattr(user, 'role', '') == 'student':
        if hasattr(user, 'profile') and user.profile.approval_status == 'approved' and user.profile.department:
            return user.profile.department
        return None
    if getattr(user, 'role', '') == 'librarian':
        return getattr(user, 'department', None)
    return getattr(user, 'department', None)


def _get_cache_key(prefix, user_id, limit, dept_id='all'):
    """Generate cache key for recommendations including department scope"""
    return f"{prefix}:user:{user_id}:dept:{dept_id}:limit:{limit}"


def invalidate_user_recommendations(user_id, dept_id='all'):
    """Invalidate recommendation caches for a specific user."""
    for prefix in ("content_rec", "interaction_rec", "hybrid_rec"):
        for limit in (5, 6, 10, 15, 20):
            cache.delete(_get_cache_key(prefix, user_id, limit, dept_id))
            cache.delete(_get_cache_key(prefix, user_id, limit, 'all'))


def invalidate_book_similar_cache(book_id, dept_id='none'):
    """Invalidate cached similar books for a specific book."""
    for limit in (5, 6, 10, 15, 20):
        cache.delete(f"similar_books:{book_id}:dept:{dept_id}:limit:{limit}")
        cache.delete(f"similar_books:{book_id}:dept:none:limit:{limit}")


def content_based(user, limit=6):
    """
    Recommend based on preferred categories and book similarity using TF-IDF.
    Strictly scoped to user's department.
    """
    dept = _get_department_for_user(user)
    is_scoped = getattr(user, 'role', '') in ('student', 'librarian') and not getattr(user, 'is_superuser', False)
    if is_scoped and not dept:
        return []

    dept_id = dept.id if dept else 'all'
    cache_key = _get_cache_key("content_rec", user.id, limit, dept_id)
    cached = cache.get(cache_key)
    if cached:
        return cached

    base_books = Book.objects.all()
    if dept:
        base_books = base_books.filter(department=dept)

    profile = getattr(user, 'profile', None)
    
    interacted_book_ids = set(
        BookInteraction.objects
        .filter(user=user)
        .values_list('book_id', flat=True)
    )

    if not profile or not profile.preferred_categories:
        books = list(
            base_books
            .exclude(id__in=interacted_book_ids)
            .filter(quantity__gt=0, average_rating__isnull=False)
            .order_by('-average_rating', '-ratings_count')[:limit]
        )
        cache.set(cache_key, books, 300)
        return books

    categories = [
        c.strip().lower()
        for c in profile.preferred_categories.split(',')
        if c.strip()
    ]

    category_query = Q()
    for category in categories:
        category_query |= Q(categories__icontains=category)

    books = list(
        base_books
        .filter(category_query)
        .exclude(id__in=interacted_book_ids)
        .filter(quantity__gt=0)
        .annotate(
            score=F('average_rating') * 0.7 + F('ratings_count') * 0.0001
        )
        .order_by('-score', '-average_rating')[:limit]
    )

    cache.set(cache_key, books, 300)
    return books


def interaction_based(user, limit=6):
    """
    Collaborative filtering: recommend books liked by similar users.
    Strictly scoped to user's department.
    """
    dept = _get_department_for_user(user)
    is_scoped = getattr(user, 'role', '') in ('student', 'librarian') and not getattr(user, 'is_superuser', False)
    if is_scoped and not dept:
        return []

    dept_id = dept.id if dept else 'all'
    cache_key = _get_cache_key("interaction_rec", user.id, limit, dept_id)
    cached = cache.get(cache_key)
    if cached:
        return cached

    base_books = Book.objects.all()
    if dept:
        base_books = base_books.filter(department=dept)

    WEIGHT_CASE = """
        CASE interaction_type
            WHEN 'borrow' THEN 3
            WHEN 'rate'   THEN 3
            WHEN 'like'   THEN 2
            ELSE 1
        END
    """

    user_weighted = (
        BookInteraction.objects
        .filter(user=user)
        .annotate(w=RawSQL(WEIGHT_CASE, [], output_field=IntegerField()))
        .values('book_id', 'w')
    )

    user_book_weights = {row['book_id']: row['w'] for row in user_weighted}

    # Factor in dwell time (reading interest: >= 20s)
    dwell_records = BookDwellTime.objects.filter(user=user, duration_seconds__gte=20).values('book_id', 'duration_seconds')
    for d in dwell_records:
        bid = d['book_id']
        dwell_bonus = 2 if d['duration_seconds'] >= 60 else 1
        user_book_weights[bid] = max(user_book_weights.get(bid, 0), dwell_bonus)

    if not user_book_weights:
        trending_query = BookInteraction.objects.all()
        if dept:
            trending_query = trending_query.filter(book__department=dept)
        trending_ids = list(
            trending_query
            .values('book_id')
            .annotate(c=Count('id'))
            .order_by('-c')
            .values_list('book_id', flat=True)[:limit]
        )
        books = list(base_books.filter(id__in=trending_ids, quantity__gt=0))
        if not books:
            books = list(
                base_books
                .filter(quantity__gt=0)
                .order_by('-average_rating', '-ratings_count')[:limit]
            )
        cache.set(cache_key, books, 300)
        return books

    interacted_book_ids = set(user_book_weights)

    similar_user_ids = (
        BookInteraction.objects
        .exclude(user=user)
        .filter(book_id__in=interacted_book_ids)
        .annotate(other_w=RawSQL(WEIGHT_CASE, [], output_field=IntegerField()))
        .values('user_id', 'book_id', 'other_w')
    )

    sim_scores: dict[int, float] = defaultdict(float)

    for row in similar_user_ids:
        uid, bid, ow = row['user_id'], row['book_id'], row['other_w']
        sim_scores[uid] += user_book_weights[bid] * ow

    if not sim_scores:
        books = list(
            base_books
            .exclude(id__in=interacted_book_ids)
            .filter(quantity__gt=0, average_rating__isnull=False)
            .order_by('-average_rating', '-ratings_count')[:limit]
        )
        cache.set(cache_key, books, 300)
        return books

    top_similar_user_ids = sorted(sim_scores, key=sim_scores.__getitem__, reverse=True)[:50]

    candidate_interactions = BookInteraction.objects.filter(user_id__in=top_similar_user_ids)
    if dept:
        candidate_interactions = candidate_interactions.filter(book__department=dept)

    candidate_rows = (
        candidate_interactions
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
            base_books
            .exclude(id__in=interacted_book_ids)
            .filter(quantity__gt=0, average_rating__isnull=False)
            .order_by('-average_rating', '-ratings_count')
            .values_list('id', flat=True)[:limit]
        )

    books = sorted(
        base_books.filter(id__in=recommended_ids, quantity__gt=0),
        key=lambda b: book_scores.get(b.id, 0),
        reverse=True,
    )

    cache.set(cache_key, books, 300)
    return books


def hybrid(user, limit=6):
    """
    Hybrid recommendation combining content-based and collaborative filtering.
    Strictly scoped to user's department.
    """
    dept = _get_department_for_user(user)
    is_scoped = getattr(user, 'role', '') in ('student', 'librarian') and not getattr(user, 'is_superuser', False)
    if is_scoped and not dept:
        return []

    dept_id = dept.id if dept else 'all'
    cache_key = _get_cache_key("hybrid_rec", user.id, limit, dept_id)
    cached = cache.get(cache_key)
    if cached:
        return cached

    fetch_limit = max(int(limit * 1.5), limit + 3)

    content_books = content_based(user, fetch_limit)
    interaction_books = interaction_based(user, fetch_limit)

    base_books = Book.objects.all()
    if dept:
        base_books = base_books.filter(department=dept)

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

    result = list(base_books.filter(id__in=sorted_book_ids))
    result.sort(key=lambda b: book_scores.get(b.id, 0), reverse=True)

    if not result:
        result = list(
            base_books
            .filter(quantity__gt=0, average_rating__isnull=False)
            .order_by('-average_rating', '-ratings_count')[:limit]
        )

    cache.set(cache_key, result, 300)
    return result


def _category_fallback(query, book_id, limit, department=None):
    """Shared fallback: top-rated in-stock books matching the category query in department."""
    qs = Book.objects.filter(query).exclude(id=book_id).filter(quantity__gt=0)
    if department:
        qs = qs.filter(department=department)
    return list(qs.order_by('-average_rating')[:limit])


def _author_fallback(source_book, book_id, limit, department=None):
    """Last-resort fallback: books by the same author in department."""
    qs = Book.objects.filter(authors__icontains=source_book.authors).exclude(id=book_id).filter(quantity__gt=0)
    if department:
        qs = qs.filter(department=department)
    return list(qs.order_by('-average_rating')[:limit])


def get_similar_books(book_id, limit=6):
    """
    Find books similar to a given book using TF-IDF cosine similarity
    on categories, authors, and description.
    Scoped to the department of the source book.
    """
    try:
        source_book = Book.objects.select_related('department').get(id=book_id)
    except Book.DoesNotExist:
        return []

    dept = source_book.department
    cache_key = f"similar_books:{book_id}:dept:{dept.id if dept else 'none'}:limit:{limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    source_categories = source_book.categories.lower() if source_book.categories else ""

    if not source_categories:
        similar = _author_fallback(source_book, book_id, limit, department=dept)
        cache.set(cache_key, similar, 600)
        return similar

    category_tokens = [c.strip() for c in source_categories.split(',') if c.strip()]
    query = Q()
    for token in category_tokens:
        query |= Q(categories__icontains=token)

    candidates_qs = Book.objects.filter(query).exclude(id=book_id).filter(quantity__gt=0)
    if dept:
        candidates_qs = candidates_qs.filter(department=dept)

    candidates = list(
        candidates_qs.values('id', 'categories', 'authors', 'description', 'average_rating')[:100]
    )

    if not candidates:
        similar = _author_fallback(source_book, book_id, limit, department=dept)
        cache.set(cache_key, similar, 600)
        return similar

    source_text = (
        f"{source_categories} "
        f"{source_book.authors} "
        f"{source_book.description or ''}"
    )
    candidate_texts = [
        f"{c['categories'] or ''} {c['authors'] or ''} {c['description'] or ''}"
        for c in candidates
    ]

    similar = None

    try:
        all_texts = [source_text] + candidate_texts

        if not any(t.strip() for t in all_texts):
            raise ValueError("All texts are empty after preprocessing")

        vectorizer = TfidfVectorizer(
            stop_words='english',
            max_features=500,
            sublinear_tf=True,
        )
        tfidf_matrix = vectorizer.fit_transform(all_texts)

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

        id_to_rank = {cid: rank for rank, cid in enumerate(top_ids)}
        result_qs = Book.objects.filter(id__in=top_ids)
        if dept:
            result_qs = result_qs.filter(department=dept)

        similar = sorted(
            result_qs,
            key=lambda b: id_to_rank.get(b.id, 0),
        )

    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "get_similar_books: TF-IDF failed for book_id=%s (%s: %s); "
            "falling back to category matching.",
            book_id, type(exc).__name__, exc,
        )

    if not similar:
        similar = _category_fallback(query, book_id, limit, department=dept)

    if not similar:
        similar = _author_fallback(source_book, book_id, limit, department=dept)

    cache.set(cache_key, similar, 600)
    return similar
