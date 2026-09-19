import pytest
from unittest.mock import patch
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from accounts.models import Department
from books.models import Book, BookInteraction
from borrows.models import Borrow
from books.cache_utils import (
    BOOK_CACHE_TTL,
    BOOK_DETAIL_CACHE_TTL,
    BOOK_LIST_CACHE_TTL,
    SIMILAR_BOOKS_CACHE_TTL,
    CATEGORIES_CACHE_TTL,
    department_list_key,
    categories_key,
    book_detail_key,
    book_list_default_key,
    similar_books_key,
    dashboard_key,
    recommendation_key,
)


@pytest.fixture(autouse=True)
def clear_cache_before_each_test():
    """Ensure a completely clean cache before each test."""
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestCacheMissHitLifecycle:
    """Verify Cache MISS -> DB Query -> Cache SET -> Cache HIT lifecycle across cached endpoints."""

    def test_departments_cache_miss_then_hit(self, api_client, cs_dept, mech_dept):
        key = department_list_key()
        assert cache.get(key) is None

        # 1. Cache MISS - fetches from DB and stores in cache
        res1 = api_client.get("/api/auth/departments/")
        assert res1.status_code == 200
        cached_data = cache.get(key)
        assert cached_data is not None
        assert len(cached_data) == 2

        # 2. Cache HIT - served from cache without DB queries for departments
        with CaptureQueriesContext(connection) as ctx:
            res2 = api_client.get("/api/auth/departments/")
        assert res2.status_code == 200
        assert res2.data == res1.data
        # Verify no query was run on accounts_department
        dept_queries = [q["sql"] for q in ctx.captured_queries if "accounts_department" in q["sql"]]
        assert len(dept_queries) == 0

    def test_book_categories_cache_miss_then_hit(self, api_client, approved_cs_student, cs_sample_books, auth_headers):
        headers = auth_headers(approved_cs_student)
        dept_id = approved_cs_student.profile.department.id
        key = categories_key(dept_id)
        assert cache.get(key) is None

        # 1. Cache MISS
        res1 = api_client.get("/api/books/categories/", **headers)
        assert res1.status_code == 200
        cached_data = cache.get(key)
        assert cached_data is not None
        assert "Algorithms" in cached_data

        # 2. Cache HIT
        with CaptureQueriesContext(connection) as ctx:
            res2 = api_client.get("/api/books/categories/", **headers)
        assert res2.status_code == 200
        assert res2.data == res1.data
        # Verify no query was executed on books_book
        book_queries = [q["sql"] for q in ctx.captured_queries if "books_book" in q["sql"]]
        assert len(book_queries) == 0

    def test_book_detail_cache_miss_then_hit(self, api_client, approved_cs_student, cs_sample_books, auth_headers):
        book = cs_sample_books[0]
        headers = auth_headers(approved_cs_student)
        key = book_detail_key(book.id)
        assert cache.get(key) is None

        # 1. Cache MISS
        res1 = api_client.get(f"/api/books/{book.id}/", **headers)
        assert res1.status_code == 200
        assert cache.get(key) is not None

        # 2. Cache HIT
        with CaptureQueriesContext(connection) as ctx:
            res2 = api_client.get(f"/api/books/{book.id}/", **headers)
        assert res2.status_code == 200
        assert res2.data == res1.data
        book_queries = [q["sql"] for q in ctx.captured_queries if "books_book" in q["sql"]]
        assert len(book_queries) == 0

    def test_book_list_default_page_cached_but_search_bypasses(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        headers = auth_headers(approved_cs_student)
        dept_id = approved_cs_student.profile.department.id
        key = book_list_default_key(dept_id)
        assert cache.get(key) is None

        # 1. Default page 1: Cache MISS -> Cache SET
        res1 = api_client.get("/api/books/", **headers)
        assert res1.status_code == 200
        assert cache.get(key) is not None

        # 2. Default page 1: Cache HIT
        with CaptureQueriesContext(connection) as ctx:
            res2 = api_client.get("/api/books/", **headers)
        assert res2.status_code == 200
        assert res2.data == res1.data
        book_queries = [q["sql"] for q in ctx.captured_queries if "books_book" in q["sql"]]
        assert len(book_queries) == 0

        # 3. Filtered/Search query: Bypasses cache
        search_key = book_list_default_key(dept_id)
        res3 = api_client.get("/api/books/?search=Algorithms", **headers)
        assert res3.status_code == 200
        # Cache key for default page remains untouched
        assert cache.get(search_key) is not None

    def test_librarian_dashboard_cache_miss_then_hit(
        self, api_client, cs_librarian, cs_sample_books, auth_headers
    ):
        headers = auth_headers(cs_librarian)
        key = dashboard_key(f"dept:{cs_librarian.department.id}")
        assert cache.get(key) is None

        # 1. Cache MISS
        res1 = api_client.get("/api/analytics/librarian-dashboard/", **headers)
        assert res1.status_code == 200
        assert cache.get(key) is not None
        assert res1.data["books"]["total"] == 3

        # 2. Cache HIT
        with CaptureQueriesContext(connection) as ctx:
            res2 = api_client.get("/api/analytics/librarian-dashboard/", **headers)
        assert res2.status_code == 200
        assert res2.data == res1.data
        # Aggregation queries on books or borrows skipped
        queries = [q["sql"] for q in ctx.captured_queries if "books_book" in q["sql"] or "borrows_borrow" in q["sql"]]
        assert len(queries) == 0

    def test_similar_books_cache_miss_then_hit(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        book = cs_sample_books[0]
        headers = auth_headers(approved_cs_student)
        dept_id = approved_cs_student.profile.department.id
        key = similar_books_key(book.id, dept_id, limit=6)
        assert cache.get(key) is None

        # 1. Cache MISS
        res1 = api_client.get(f"/api/books/{book.id}/similar/", **headers)
        assert res1.status_code == 200
        assert cache.get(key) is not None

        # 2. Cache HIT
        with CaptureQueriesContext(connection) as ctx:
            res2 = api_client.get(f"/api/books/{book.id}/similar/", **headers)
        assert res2.status_code == 200
        assert res2.data == res1.data
        book_queries = [q["sql"] for q in ctx.captured_queries if "books_book" in q["sql"]]
        assert len(book_queries) == 0

    def test_recommendations_cache_miss_then_hit(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        headers = auth_headers(approved_cs_student)
        dept_id = approved_cs_student.profile.department.id
        key = recommendation_key("hybrid", approved_cs_student.id, dept_id, limit=6)
        assert cache.get(key) is None

        # 1. Cache MISS
        res1 = api_client.get("/api/books/recommendations/?type=hybrid", **headers)
        assert res1.status_code == 200
        assert cache.get(key) is not None

        # 2. Cache HIT
        with CaptureQueriesContext(connection) as ctx:
            res2 = api_client.get("/api/books/recommendations/?type=hybrid", **headers)
        assert res2.status_code == 200
        assert res2.data == res1.data
        book_queries = [q["sql"] for q in ctx.captured_queries if "books_book" in q["sql"]]
        assert len(book_queries) == 0


@pytest.mark.django_db
class TestCacheInvalidation:
    """Verify cache keys are automatically invalidated on mutation events."""

    def test_department_mutation_invalidates_cache(self, api_client, cs_dept):
        # Warm cache
        api_client.get("/api/auth/departments/")
        assert cache.get(department_list_key()) is not None

        # Create new department triggers post_save signal
        Department.objects.create(name="Civil Engineering")
        assert cache.get(department_list_key()) is None

        # Warm again and delete
        api_client.get("/api/auth/departments/")
        assert cache.get(department_list_key()) is not None
        Department.objects.filter(name="Civil Engineering").delete()
        assert cache.get(department_list_key()) is None

    def test_book_update_invalidates_detail_and_dashboard(
        self, api_client, cs_librarian, cs_sample_books, auth_headers
    ):
        book = cs_sample_books[0]
        headers = auth_headers(cs_librarian)
        detail_key = book_detail_key(book.id)
        dash_key = dashboard_key(f"dept:{cs_librarian.department.id}")

        # Warm caches
        api_client.get(f"/api/books/{book.id}/", **headers)
        api_client.get("/api/analytics/librarian-dashboard/", **headers)
        assert cache.get(detail_key) is not None
        assert cache.get(dash_key) is not None

        # Update book title via BookManageView
        update_data = {
            "title": "Introduction to Algorithms - Updated 4th Edition",
            "authors": book.authors,
            "quantity": 10,
        }
        res = api_client.put(f"/api/books/manage/{book.id}/", update_data, format="json", **headers)
        assert res.status_code == 200

        # Caches must be invalidated
        assert cache.get(detail_key) is None
        assert cache.get(dash_key) is None

    def test_borrow_approval_and_return_invalidates_cache(
        self, api_client, cs_librarian, approved_cs_student, cs_sample_books, auth_headers
    ):
        book = cs_sample_books[0]
        lib_headers = auth_headers(cs_librarian)
        student_headers = auth_headers(approved_cs_student)

        # 1. Student creates borrow request
        borrow = Borrow.objects.create(
            user=approved_cs_student,
            book=book,
            status="requested",
        )

        # Warm caches: book detail and librarian dashboard
        api_client.get(f"/api/books/{book.id}/", **student_headers)
        api_client.get("/api/analytics/librarian-dashboard/", **lib_headers)
        assert cache.get(book_detail_key(book.id)) is not None
        assert cache.get(dashboard_key(f"dept:{cs_librarian.department.id}")) is not None

        # 2. Librarian approves borrow
        res = api_client.post(f"/api/borrows/approve/{borrow.id}/", **lib_headers)
        assert res.status_code == 200

        # Detail cache invalidated because quantity decremented; dashboard invalidated
        assert cache.get(book_detail_key(book.id)) is None
        assert cache.get(dashboard_key(f"dept:{cs_librarian.department.id}")) is None

        # Re-warm caches
        api_client.get(f"/api/books/{book.id}/", **student_headers)
        api_client.get("/api/analytics/librarian-dashboard/", **lib_headers)
        assert cache.get(book_detail_key(book.id)) is not None
        assert cache.get(dashboard_key(f"dept:{cs_librarian.department.id}")) is not None

        # 3. Student returns book
        return_res = api_client.post(
            "/api/borrows/return/",
            {"borrow_id": borrow.id},
            format="json",
            **student_headers,
        )
        assert return_res.status_code == 200

        # Detail cache and dashboard invalidated because quantity incremented & borrow status updated
        assert cache.get(book_detail_key(book.id)) is None
        assert cache.get(dashboard_key(f"dept:{cs_librarian.department.id}")) is None

    def test_student_approval_invalidates_dashboard_cache(
        self, api_client, cs_librarian, pending_cs_student, auth_headers
    ):
        lib_headers = auth_headers(cs_librarian)
        dash_key = dashboard_key(f"dept:{cs_librarian.department.id}")

        # Warm dashboard cache
        api_client.get("/api/analytics/librarian-dashboard/", **lib_headers)
        assert cache.get(dash_key) is not None

        # Approve student
        res = api_client.post(f"/api/analytics/students/{pending_cs_student.id}/approve/", **lib_headers)
        assert res.status_code == 200

        # Dashboard cache invalidated
        assert cache.get(dash_key) is None

    def test_interaction_invalidates_user_recommendations(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        book = cs_sample_books[0]
        student_headers = auth_headers(approved_cs_student)
        dept_id = approved_cs_student.profile.department.id
        rec_key = recommendation_key("hybrid", approved_cs_student.id, dept_id, limit=6)

        # Warm recommendations cache
        api_client.get("/api/books/recommendations/?type=hybrid", **student_headers)
        assert cache.get(rec_key) is not None

        # Student tracks a view on a book
        res = api_client.post(f"/api/books/track/{book.id}/", **student_headers)
        assert res.status_code == 200

        # Recommendation cache is invalidated
        assert cache.get(rec_key) is None


@pytest.mark.django_db
class TestDepartmentAndUserIsolation:
    """Verify strict multi-tenant cache separation between departments and individual users."""

    def test_department_scoped_category_isolation(
        self, api_client, approved_cs_student, approved_mech_student, cs_sample_books, mech_sample_books, auth_headers
    ):
        cs_headers = auth_headers(approved_cs_student)
        mech_headers = auth_headers(approved_mech_student)

        cs_dept_id = approved_cs_student.profile.department.id
        mech_dept_id = approved_mech_student.profile.department.id

        # CS Student request
        res_cs = api_client.get("/api/books/categories/", **cs_headers)
        assert res_cs.status_code == 200
        cs_cached = cache.get(categories_key(cs_dept_id))
        assert "Algorithms" in cs_cached
        assert "Thermodynamics" not in cs_cached

        # Mech Student request
        res_mech = api_client.get("/api/books/categories/", **mech_headers)
        assert res_mech.status_code == 200
        mech_cached = cache.get(categories_key(mech_dept_id))
        assert "Thermodynamics" in mech_cached
        assert "Algorithms" not in mech_cached

        # Confirm distinct keys
        assert categories_key(cs_dept_id) != categories_key(mech_dept_id)

    def test_dashboard_scope_isolation_between_librarians_and_admin(
        self, api_client, cs_librarian, mech_librarian, super_admin, cs_sample_books, mech_sample_books, auth_headers
    ):
        cs_headers = auth_headers(cs_librarian)
        admin_headers = auth_headers(super_admin)

        res_cs = api_client.get("/api/analytics/librarian-dashboard/", **cs_headers)
        assert res_cs.status_code == 200
        assert res_cs.data["books"]["total"] == 3

        res_admin = api_client.get("/api/analytics/librarian-dashboard/", **admin_headers)
        assert res_admin.status_code == 200
        assert res_admin.data["books"]["total"] == 4  # 3 CS + 1 Mech

        # Isolated keys
        assert cache.get(dashboard_key(f"dept:{cs_librarian.department.id}"))["books"]["total"] == 3
        assert cache.get(dashboard_key("admin"))["books"]["total"] == 4

    def test_user_recommendations_cache_isolation(
        self, api_client, approved_cs_student, approved_mech_student, cs_sample_books, mech_sample_books, auth_headers
    ):
        cs_headers = auth_headers(approved_cs_student)
        mech_headers = auth_headers(approved_mech_student)

        res_cs = api_client.get("/api/books/recommendations/?type=hybrid", **cs_headers)
        assert res_cs.status_code == 200

        res_mech = api_client.get("/api/books/recommendations/?type=hybrid", **mech_headers)
        assert res_mech.status_code == 200

        key_cs = recommendation_key("hybrid", approved_cs_student.id, approved_cs_student.profile.department.id, limit=6)
        key_mech = recommendation_key("hybrid", approved_mech_student.id, approved_mech_student.profile.department.id, limit=6)

        assert key_cs != key_mech
        assert cache.get(key_cs) is not None
        assert cache.get(key_mech) is not None


@pytest.mark.django_db
class TestRedisFailureGracefulFallback:
    """Verify application fails open gracefully without 500 Internal Server Error when Redis throws errors."""

    def test_categories_fallback_when_cache_raises_exception(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        headers = auth_headers(approved_cs_student)

        # Mock cache.get and cache.set to simulate Redis downtime/timeout
        with patch.object(cache, "get", side_effect=Exception("Redis Connection Refused")):
            with patch.object(cache, "set", side_effect=Exception("Redis Connection Refused")):
                res = api_client.get("/api/books/categories/", **headers)
                assert res.status_code == 200
                assert "Algorithms" in res.data

    def test_book_detail_fallback_when_cache_fails(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        book = cs_sample_books[0]
        headers = auth_headers(approved_cs_student)

        with patch.object(cache, "get", side_effect=Exception("Redis Connection Error")):
            with patch.object(cache, "set", side_effect=Exception("Redis Connection Error")):
                res = api_client.get(f"/api/books/{book.id}/", **headers)
                assert res.status_code == 200
                assert res.data["id"] == book.id

    def test_dashboard_fallback_when_cache_fails(
        self, api_client, cs_librarian, cs_sample_books, auth_headers
    ):
        headers = auth_headers(cs_librarian)

        with patch.object(cache, "get", side_effect=Exception("Redis Timeout")):
            with patch.object(cache, "set", side_effect=Exception("Redis Timeout")):
                res = api_client.get("/api/analytics/librarian-dashboard/", **headers)
                assert res.status_code == 200
                assert res.data["books"]["total"] == 3


@pytest.mark.django_db
class TestBookCacheTTL:
    """Verify book cache TTL constants and ensure endpoints set cache with 3-4 days TTL."""

    def test_ttl_constants_in_3_to_4_days_range(self):
        min_ttl = 3 * 86400  # 3 days = 259,200 seconds
        max_ttl = 4 * 86400  # 4 days = 345,600 seconds
        for ttl, name in [
            (BOOK_CACHE_TTL, "BOOK_CACHE_TTL"),
            (BOOK_DETAIL_CACHE_TTL, "BOOK_DETAIL_CACHE_TTL"),
            (BOOK_LIST_CACHE_TTL, "BOOK_LIST_CACHE_TTL"),
            (SIMILAR_BOOKS_CACHE_TTL, "SIMILAR_BOOKS_CACHE_TTL"),
            (CATEGORIES_CACHE_TTL, "CATEGORIES_CACHE_TTL"),
        ]:
            assert min_ttl <= ttl <= max_ttl, f"{name} ({ttl}s) is not within 3-4 days ({min_ttl}-{max_ttl}s)"

    def test_book_detail_sets_cache_with_3_to_4_day_ttl(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        book = cs_sample_books[0]
        headers = auth_headers(approved_cs_student)

        with patch("books.views.safe_cache_set") as mock_set:
            res = api_client.get(f"/api/books/{book.id}/", **headers)
            assert res.status_code == 200
            mock_set.assert_called_once()
            call_args = mock_set.call_args[0]
            # call signature: safe_cache_set(key, data, timeout)
            assert call_args[0] == book_detail_key(book.id)
            assert call_args[2] == BOOK_DETAIL_CACHE_TTL
            assert call_args[2] >= 3 * 86400

    def test_book_list_sets_cache_with_3_to_4_day_ttl(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        headers = auth_headers(approved_cs_student)
        dept_id = approved_cs_student.profile.department.id

        with patch("books.views.safe_cache_set") as mock_set:
            res = api_client.get("/api/books/", **headers)
            assert res.status_code == 200
            mock_set.assert_called_once()
            call_args = mock_set.call_args[0]
            assert call_args[0] == book_list_default_key(dept_id)
            assert call_args[2] == BOOK_LIST_CACHE_TTL
            assert call_args[2] >= 3 * 86400

    def test_similar_books_sets_cache_with_3_to_4_day_ttl(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        book = cs_sample_books[0]
        headers = auth_headers(approved_cs_student)
        dept_id = approved_cs_student.profile.department.id

        with patch("books.views.safe_cache_set") as mock_set:
            res = api_client.get(f"/api/books/{book.id}/similar/", **headers)
            assert res.status_code == 200
            mock_set.assert_called_once()
            call_args = mock_set.call_args[0]
            assert call_args[0] == similar_books_key(book.id, dept_id, 6)
            assert call_args[2] == SIMILAR_BOOKS_CACHE_TTL
            assert call_args[2] >= 3 * 86400

    def test_categories_sets_cache_with_3_to_4_day_ttl(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        headers = auth_headers(approved_cs_student)
        dept_id = approved_cs_student.profile.department.id

        with patch("books.views.safe_cache_set") as mock_set:
            res = api_client.get("/api/books/categories/", **headers)
            assert res.status_code == 200
            mock_set.assert_called_once()
            call_args = mock_set.call_args[0]
            assert call_args[0] == categories_key(dept_id)
            assert call_args[2] == CATEGORIES_CACHE_TTL
            assert call_args[2] >= 3 * 86400
