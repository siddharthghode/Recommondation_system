"""
Centralized Cache Key Management & Invalidation Helpers for Library Management System.
Uses Django's standard cache API with django-redis.
"""
import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)


# ==============================================================================
# 1. CACHE KEYS
# ==============================================================================

def department_list_key() -> str:
    """Master reference list of departments."""
    return "global:departments:list"


def categories_key(dept_id_or_all="all") -> str:
    """Book categories list, optionally scoped to a department."""
    dept = str(dept_id_or_all) if dept_id_or_all is not None else "all"
    return f"books:categories:dept:{dept}"


def similar_books_key(book_id: int, dept_id_or_all="all", limit: int = 6) -> str:
    """Content similarity recommendations for a specific book."""
    dept = str(dept_id_or_all) if dept_id_or_all is not None else "all"
    return f"books:similar:{book_id}:dept:{dept}:limit:{limit}"


def dashboard_key(scope: str) -> str:
    """Dashboard analytics for admin or a specific department."""
    return f"analytics:dashboard:scope:{scope}"


def recommendation_key(rec_type: str, user_id: int, dept_id_or_all="all", limit: int = 6) -> str:
    """Personalized recommendations for a specific student/user."""
    dept = str(dept_id_or_all) if dept_id_or_all is not None else "all"
    return f"recs:{rec_type}:user:{user_id}:dept:{dept}:limit:{limit}"


def book_detail_key(book_id: int) -> str:
    """Serialized detail metadata for a single book."""
    return f"book:detail:{book_id}"


def book_list_default_key(dept_id_or_all="all") -> str:
    """Default first page of books catalog (unfiltered, page 1)."""
    dept = str(dept_id_or_all) if dept_id_or_all is not None else "all"
    return f"books:list:page:1:dept:{dept}"


# ==============================================================================
# 2. PATTERN DELETE & RESILIENCE HELPERS
# ==============================================================================

def safe_cache_get(key: str, default=None):
    """Safely retrieve a value from cache; falls back to default if Redis is unreachable."""
    try:
        val = cache.get(key)
        return val if val is not None else default
    except Exception as e:
        logger.warning("safe_cache_get error on %s: %s", key, e)
        return default


def safe_cache_set(key: str, value, timeout: int = None):
    """Safely set a value into cache; silently ignores failure if Redis is unreachable."""
    try:
        cache.set(key, value, timeout)
    except Exception as e:
        logger.warning("safe_cache_set error on %s: %s", key, e)


def safe_delete_pattern(pattern: str) -> int:
    """
    Deletes keys matching a glob pattern using django-redis delete_pattern.
    Fails safely if Redis is down or if a backend without delete_pattern is used (e.g. LocMemCache).
    """
    if hasattr(cache, "delete_pattern"):
        try:
            return cache.delete_pattern(pattern)
        except Exception as e:
            logger.warning("Failed to execute delete_pattern(%s): %s", pattern, e)
            return 0
    return 0


# ==============================================================================
# 3. SPECIFIC INVALIDATION FUNCTIONS
# ==============================================================================

def invalidate_department_cache():
    """Invalidate global department list cache."""
    try:
        cache.delete(department_list_key())
    except Exception as e:
        logger.warning("Error invalidating department cache: %s", e)


def invalidate_categories_cache():
    """Invalidate all category caches (global and department-scoped)."""
    try:
        safe_delete_pattern("books:categories:*")
        # Explicit deletes for non-pattern backends (LocMemCache in tests)
        cache.delete(categories_key("all"))
        for i in range(1, 100):
            cache.delete(categories_key(i))
            cache.delete(categories_key(str(i)))
    except Exception as e:
        logger.warning("Error invalidating categories cache: %s", e)


def invalidate_book_cache(book_id: int = None):
    """
    Invalidate a specific book's detail and its similar book caches.
    Called when a book is updated, deleted, or borrowed/returned.
    """
    if not book_id:
        return
    try:
        cache.delete(book_detail_key(book_id))
        safe_delete_pattern(f"books:similar:{book_id}:*")
        for limit in (5, 6, 10, 15, 20, 50):
            for dept in ("all", "none"):
                cache.delete(f"books:similar:{book_id}:dept:{dept}:limit:{limit}")
            for i in range(1, 50):
                cache.delete(f"books:similar:{book_id}:dept:{i}:limit:{limit}")
                cache.delete(f"books:similar:{book_id}:dept:{str(i)}:limit:{limit}")
    except Exception as e:
        logger.warning("Error invalidating book cache for %s: %s", book_id, e)


def invalidate_catalog_cache():
    """Invalidate default catalog page caches."""
    try:
        safe_delete_pattern("books:list:*")
        cache.delete(book_list_default_key("all"))
        for i in range(1, 100):
            cache.delete(book_list_default_key(i))
            cache.delete(book_list_default_key(str(i)))
    except Exception as e:
        logger.warning("Error invalidating catalog cache: %s", e)


def invalidate_dashboard_cache(dept_id=None):
    """
    Invalidate librarian and admin dashboard caches.
    Called on book creation/deletion/import, borrow approval/return, student approval.
    """
    try:
        safe_delete_pattern("analytics:dashboard:*")
        cache.delete(dashboard_key("admin"))
        if dept_id:
            cache.delete(dashboard_key(f"dept:{dept_id}"))
        for i in range(1, 100):
            cache.delete(dashboard_key(f"dept:{i}"))
            cache.delete(dashboard_key(f"dept:{str(i)}"))
    except Exception as e:
        logger.warning("Error invalidating dashboard cache: %s", e)


def invalidate_user_recommendations(user_id: int, dept_id=None):
    """
    Invalidate all personalized recommendation caches for a given student.
    Called on interactions (view, like, rate, dwell time), borrow, or category preference update.
    """
    if not user_id:
        return
    try:
        safe_delete_pattern(f"recs:*:user:{user_id}:*")
        safe_delete_pattern(f"content_rec:user:{user_id}:*")
        safe_delete_pattern(f"interaction_rec:user:{user_id}:*")
        safe_delete_pattern(f"hybrid_rec:user:{user_id}:*")

        # Explicit fallback deletes for non-pattern backends (LocMemCache in tests)
        for rec_type in (
            "hybrid", "content", "interaction", "collaborative",
            "content_rec", "interaction_rec", "hybrid_rec"
        ):
            for limit in (5, 6, 10, 15, 20, 50):
                for d in ("all", dept_id):
                    if d is not None:
                        cache.delete(f"recs:{rec_type}:user:{user_id}:dept:{d}:limit:{limit}")
                        cache.delete(f"{rec_type}:user:{user_id}:dept:{d}:limit:{limit}")
    except Exception as e:
        logger.warning("Error invalidating user recommendations for %s: %s", user_id, e)
