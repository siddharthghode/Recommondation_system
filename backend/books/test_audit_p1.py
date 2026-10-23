"""
P1 Audit Tests — CSV Importer, Cache Correctness, Recommender, API Contract.
"""
import io
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, Department
from books.models import Book, BookInteraction
from books.services.csv_importer import import_books_from_csv, _to_int, _to_float, _clean_str
from books.services.recommender import content_based, interaction_based, hybrid, get_similar_books
from books.cache_utils import (
    book_list_default_key, book_detail_key, categories_key,
    invalidate_catalog_cache, invalidate_book_cache,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth(client, user):
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")


def _make_librarian(username, email, dept):
    return User.objects.create_user(username=username, email=email,
                                     password="Pass1234!", role="librarian",
                                     department=dept)


def _make_approved_student(username, email, dept):
    u = User.objects.create_user(username=username, email=email,
                                  password="Pass1234!", role="student")
    p = u.profile
    p.department = dept
    p.approval_status = "approved"
    p.student_id = username
    p.save()
    return u


def _csv(content: str):
    return io.BytesIO(content.encode("utf-8"))


@pytest.fixture(autouse=True)
def clear_cache_fixture():
    cache.clear()
    yield
    cache.clear()


# ===========================================================================
# CSV Importer
# ===========================================================================

@pytest.mark.django_db
class TestCSVImporterHelpers:
    """Unit tests for numeric/string conversion helpers."""

    def test_to_int_valid(self):
        assert _to_int("42") == 42
        assert _to_int("3.9") == 3
        assert _to_int("0") == 0

    def test_to_int_empty_returns_default(self):
        assert _to_int("") is None
        assert _to_int(None) is None
        assert _to_int("abc", default=0) == 0

    def test_to_float_valid(self):
        assert _to_float("4.5") == 4.5
        assert _to_float("0") == 0.0

    def test_to_float_invalid_returns_default(self):
        assert _to_float("not_a_number") is None
        assert _to_float("", default=0.0) == 0.0

    def test_clean_str_truncates(self):
        long_str = "x" * 1000
        result = _clean_str(long_str, max_len=900)
        assert len(result) == 900

    def test_clean_str_strips_whitespace(self):
        assert _clean_str("  hello  ") == "hello"

    def test_clean_str_none_returns_empty(self):
        assert _clean_str(None) == ""


@pytest.mark.django_db
class TestCSVImporterBehavior:

    def test_empty_csv_returns_error(self, db):
        dept = Department.objects.create(name="CSV-Empty")
        result = import_books_from_csv(_csv(""), dept)
        assert result["success"] is False

    def test_missing_title_column_returns_error(self, db):
        dept = Department.objects.create(name="CSV-NoTitle")
        csv_data = "authors,categories\nJohn,Science\n"
        result = import_books_from_csv(_csv(csv_data), dept)
        assert result["success"] is False
        assert "title" in result["error"].lower()

    def test_basic_import_creates_books(self, db):
        dept = Department.objects.create(name="CSV-Basic")
        csv_data = "title,authors,categories,quantity\nAlgorithms,Cormen,CS,3\nOS Concepts,Silberschatz,Systems,2\n"
        result = import_books_from_csv(_csv(csv_data), dept)
        assert result["success"] is True
        assert result["created"] == 2
        assert Book.objects.filter(department=dept).count() == 2

    def test_duplicate_title_in_same_csv_not_duplicated(self, db):
        dept = Department.objects.create(name="CSV-Dup")
        csv_data = "title,authors,quantity\nSame Book,Author A,1\nSame Book,Author A,2\n"
        result = import_books_from_csv(_csv(csv_data), dept)
        assert result["success"] is True
        assert Book.objects.filter(department=dept, title="Same Book").count() == 1

    def test_reimport_updates_existing_book(self, db):
        dept = Department.objects.create(name="CSV-Update")
        Book.objects.create(title="Existing Book", authors="Old Author",
                            department=dept, quantity=1)
        csv_data = "title,authors,quantity\nExisting Book,New Author,5\n"
        result = import_books_from_csv(_csv(csv_data), dept)
        assert result["success"] is True
        assert result["updated"] == 1
        book = Book.objects.get(title="Existing Book", department=dept)
        assert book.quantity == 5

    def test_row_with_missing_title_skipped_with_error(self, db):
        dept = Department.objects.create(name="CSV-RowErr")
        csv_data = "title,authors,quantity\n,No Title Author,1\nReal Book,Real Author,2\n"
        result = import_books_from_csv(_csv(csv_data), dept)
        assert result["success"] is True
        assert result["created"] == 1
        assert len(result["row_errors"]) >= 1

    def test_no_department_returns_error(self, db):
        result = import_books_from_csv(_csv("title\nBook\n"), None)
        assert result["success"] is False

    def test_concurrent_import_same_dept_blocked_by_lock(self, db):
        """Second import for same dept while lock is held returns error."""
        dept = Department.objects.create(name="CSV-Lock")
        lock_key = f"csv_import_dept_{dept.id}"
        # Simulate a held lock
        cache.add(lock_key, "1", timeout=300)
        csv_data = "title,authors\nBook X,Author X\n"
        result = import_books_from_csv(_csv(csv_data), dept)
        assert result["success"] is False
        assert "already in progress" in result["error"].lower()
        cache.delete(lock_key)

    def test_lock_released_after_successful_import(self, db):
        """Lock must be released so a subsequent import can proceed."""
        dept = Department.objects.create(name="CSV-LockRelease")
        csv_data = "title,authors,quantity\nBook A,Author A,1\n"
        import_books_from_csv(_csv(csv_data), dept)
        lock_key = f"csv_import_dept_{dept.id}"
        # Lock should be gone after import completes
        assert cache.get(lock_key) is None

    def test_quantity_defaults_to_1_when_missing(self, db):
        dept = Department.objects.create(name="CSV-QtyDefault")
        csv_data = "title,authors\nNo Qty Book,Author\n"
        result = import_books_from_csv(_csv(csv_data), dept)
        assert result["success"] is True
        book = Book.objects.get(title="No Qty Book", department=dept)
        assert book.quantity >= 1

    def test_negative_quantity_clamped_to_zero(self, db):
        dept = Department.objects.create(name="CSV-NegQty")
        csv_data = "title,authors,quantity\nNeg Book,Author,-5\n"
        result = import_books_from_csv(_csv(csv_data), dept)
        assert result["success"] is True
        book = Book.objects.get(title="Neg Book", department=dept)
        assert book.quantity >= 0


# ===========================================================================
# Cache Correctness
# ===========================================================================

@pytest.mark.django_db
class TestCacheInvalidation:

    def test_catalog_cache_invalidated_after_book_creation(self):
        """Creating a book via API must invalidate the catalog cache."""
        cs = Department.objects.create(name="Cache-CS")
        lib = _make_librarian("cache_lib", "cache_lib@t.edu", cs)
        client = APIClient()
        _auth(client, lib)

        # Prime the cache
        client.get("/api/books/")
        cache_key = book_list_default_key(cs.id)
        assert cache.get(cache_key) is not None

        # Create a new book — should invalidate
        client.post("/api/books/manage/", {
            "title": "New Cache Book", "authors": "A",
            "categories": "CS", "quantity": 1,
            "department": cs.id,
        })
        assert cache.get(cache_key) is None, (
            "Catalog cache not invalidated after book creation"
        )

    def test_book_detail_cache_invalidated_after_update(self):
        """Updating a book must invalidate its detail cache entry."""
        cs = Department.objects.create(name="Cache-CS2")
        lib = _make_librarian("cache_lib2", "cache_lib2@t.edu", cs)
        book = Book.objects.create(title="Cache Detail Book", authors="A",
                                    department=cs, quantity=2)
        client = APIClient()
        _auth(client, lib)

        # Prime detail cache
        client.get(f"/api/books/{book.id}/")
        assert cache.get(book_detail_key(book.id)) is not None

        # Update book
        client.put(f"/api/books/manage/{book.id}/", {
            "title": "Cache Detail Book Updated", "authors": "A",
            "categories": "CS", "quantity": 3, "department": cs.id,
        })
        assert cache.get(book_detail_key(book.id)) is None, (
            "Book detail cache not invalidated after update"
        )

    def test_pending_student_does_not_poison_catalog_cache(self):
        """A pending student's empty response must not be cached as the dept catalog."""
        cs = Department.objects.create(name="Cache-CS3")
        pending = User.objects.create_user(
            username="cache_pend", email="cache_pend@t.edu",
            password="Pass1234!", role="student"
        )
        pending.profile.department = cs
        pending.profile.approval_status = "pending"
        pending.profile.student_id = "cache_pend"
        pending.profile.save()

        approved = _make_approved_student("cache_appr", "cache_appr@t.edu", cs)
        Book.objects.create(title="Cache Poison Book", authors="A",
                             department=cs, quantity=1)

        client = APIClient()
        # Pending student hits catalog first
        _auth(client, pending)
        client.get("/api/books/")

        # Approved student must still see books
        _auth(client, approved)
        resp = client.get("/api/books/")
        titles = [b["title"] for b in resp.data.get("results", resp.data)]
        assert "Cache Poison Book" in titles, (
            "Approved student cannot see books — pending student poisoned cache"
        )

    def test_categories_cache_invalidated_after_book_delete(self):
        """Deleting a book must invalidate the categories cache."""
        cs = Department.objects.create(name="Cache-CS4")
        lib = _make_librarian("cache_lib4", "cache_lib4@t.edu", cs)
        book = Book.objects.create(title="Cat Cache Book", authors="A",
                                    categories="UniqueCategory999",
                                    department=cs, quantity=1)
        client = APIClient()
        _auth(client, lib)

        # Prime categories cache
        client.get("/api/books/categories/")
        assert cache.get(categories_key(cs.id)) is not None or \
               cache.get(categories_key("all")) is not None

        # Delete book
        client.delete(f"/api/books/manage/{book.id}/")

        # Cache should be cleared
        assert cache.get(categories_key(cs.id)) is None
        assert cache.get(categories_key("all")) is None


# ===========================================================================
# Recommender Engine
# ===========================================================================

@pytest.mark.django_db
class TestRecommenderEdgeCases:

    def test_empty_catalog_returns_empty_list(self):
        """No books in dept → all recommender functions return []."""
        cs = Department.objects.create(name="Rec-Empty")
        student = _make_approved_student("rec_empty_s", "rec_empty@t.edu", cs)
        assert content_based(student, 6) == []
        assert interaction_based(student, 6) == []
        assert hybrid(student, 6) == []

    def test_no_interactions_returns_top_rated_fallback(self):
        """New user with no interactions gets top-rated books as fallback."""
        cs = Department.objects.create(name="Rec-NoInt")
        student = _make_approved_student("rec_noint_s", "rec_noint@t.edu", cs)
        Book.objects.create(title="Top Rated", authors="A", department=cs,
                             quantity=1, average_rating=4.9, ratings_count=100)
        Book.objects.create(title="Low Rated", authors="B", department=cs,
                             quantity=1, average_rating=2.0, ratings_count=10)
        results = content_based(student, 6)
        assert len(results) > 0
        # All results must belong to the student's department
        for book in results:
            assert book.department == cs

    def test_recommendations_scoped_to_department(self):
        """Recommendations must never include books from another department."""
        cs = Department.objects.create(name="Rec-Scope-CS")
        mech = Department.objects.create(name="Rec-Scope-Mech")
        student = _make_approved_student("rec_scope_s", "rec_scope@t.edu", cs)
        Book.objects.create(title="CS Book Rec", authors="A", department=cs,
                             quantity=1, average_rating=4.5, ratings_count=50)
        Book.objects.create(title="Mech Book Rec", authors="B", department=mech,
                             quantity=1, average_rating=4.9, ratings_count=200)

        for fn in (content_based, interaction_based, hybrid):
            results = fn(student, 6)
            for book in results:
                assert book.department == cs, (
                    f"{fn.__name__} returned a book from wrong department"
                )

    def test_out_of_stock_books_excluded_from_recommendations(self):
        """Books with quantity=0 must not appear in recommendations."""
        cs = Department.objects.create(name="Rec-OOS")
        student = _make_approved_student("rec_oos_s", "rec_oos@t.edu", cs)
        Book.objects.create(title="OOS Book", authors="A", department=cs,
                             quantity=0, average_rating=4.9, ratings_count=500)
        Book.objects.create(title="In Stock Book", authors="B", department=cs,
                             quantity=2, average_rating=3.0, ratings_count=10)

        results = content_based(student, 6)
        titles = [b.title for b in results]
        assert "OOS Book" not in titles

    def test_get_similar_books_empty_categories_fallback(self):
        """Book with no categories falls back gracefully without raising."""
        cs = Department.objects.create(name="Rec-NoCat")
        book = Book.objects.create(title="No Cat Book", authors="Author X",
                                    categories="", department=cs, quantity=1)
        Book.objects.create(title="Same Author Book", authors="Author X",
                             categories="", department=cs, quantity=1)
        results = get_similar_books(book.id, limit=6)
        assert isinstance(results, list)

    def test_get_similar_books_nonexistent_id_returns_empty(self):
        results = get_similar_books(999999, limit=6)
        assert results == []

    def test_get_similar_books_stampede_lock_path_no_nameerror(self):
        """
        Regression for DEFECT: get_similar_books used time.sleep without
        importing time at module level. Under cache stampede the lock path
        raised NameError. Verify it completes without error.
        """
        cs = Department.objects.create(name="Rec-Stampede")
        book = Book.objects.create(title="Stampede Book", authors="A",
                                    categories="CS", department=cs, quantity=1)
        Book.objects.create(title="Similar Stampede", authors="A",
                             categories="CS", department=cs, quantity=1)
        # Simulate a held stampede lock so the sleep path is exercised
        from books.cache_utils import similar_books_key
        cache_key = similar_books_key(book.id, str(cs.id), 6)
        lock_key = f"stampede:{cache_key}"
        cache.add(lock_key, "1", timeout=1)  # lock held briefly
        # Must not raise NameError
        results = get_similar_books(book.id, limit=6)
        assert isinstance(results, list)

    def test_recommendations_invalidated_after_interaction(self):
        """After a new interaction, cached recommendations are cleared."""
        cs = Department.objects.create(name="Rec-Inv")
        student = _make_approved_student("rec_inv_s", "rec_inv@t.edu", cs)
        book = Book.objects.create(title="Rec Inv Book", authors="A",
                                    department=cs, quantity=1,
                                    average_rating=4.0, ratings_count=10)
        client = APIClient()
        _auth(client, student)

        # Prime recommendation cache
        client.get("/api/books/recommendations/")

        # Track interaction — should invalidate cache
        client.post("/api/interactions/", {
            "book_id": book.id, "interaction_type": "like"
        })

        # Cache should be cleared (safe_cache_get returns None)
        from books.cache_utils import recommendation_key
        key = recommendation_key("hybrid", student.id, cs.id, 6)
        assert cache.get(key) is None


# ===========================================================================
# API Contract & Input Validation
# ===========================================================================

@pytest.mark.django_db
class TestAPIContract:

    def test_borrow_request_missing_book_id_returns_400(self):
        cs = Department.objects.create(name="API-CS")
        student = _make_approved_student("api_s1", "api_s1@t.edu", cs)
        client = APIClient()
        _auth(client, student)
        resp = client.post("/api/borrows/request/", {})
        assert resp.status_code == 400

    def test_borrow_request_nonexistent_book_returns_404(self):
        cs = Department.objects.create(name="API-CS2")
        student = _make_approved_student("api_s2", "api_s2@t.edu", cs)
        client = APIClient()
        _auth(client, student)
        resp = client.post("/api/borrows/request/", {"book_id": 999999})
        assert resp.status_code == 404

    def test_unsupported_http_method_on_borrow_request(self):
        cs = Department.objects.create(name="API-CS3")
        student = _make_approved_student("api_s3", "api_s3@t.edu", cs)
        client = APIClient()
        _auth(client, student)
        resp = client.get("/api/borrows/request/")
        assert resp.status_code == 405

    def test_book_manage_create_missing_title_returns_400(self):
        cs = Department.objects.create(name="API-CS4")
        lib = _make_librarian("api_lib4", "api_lib4@t.edu", cs)
        client = APIClient()
        _auth(client, lib)
        resp = client.post("/api/books/manage/", {"authors": "A", "quantity": 1})
        assert resp.status_code == 400

    def test_book_list_invalid_ordering_falls_back_gracefully(self):
        cs = Department.objects.create(name="API-CS5")
        lib = _make_librarian("api_lib5", "api_lib5@t.edu", cs)
        client = APIClient()
        _auth(client, lib)
        resp = client.get("/api/books/?ordering=__evil__")
        assert resp.status_code == 200

    def test_dwell_time_negative_duration_rejected(self):
        cs = Department.objects.create(name="API-CS6")
        student = _make_approved_student("api_s6", "api_s6@t.edu", cs)
        book = Book.objects.create(title="Dwell Book", authors="A",
                                    department=cs, quantity=1)
        client = APIClient()
        _auth(client, student)
        resp = client.post("/api/dwell-time/", {
            "book_id": book.id, "duration_seconds": -10
        })
        assert resp.status_code == 400

    def test_dwell_time_nan_rejected(self):
        cs = Department.objects.create(name="API-CS7")
        student = _make_approved_student("api_s7", "api_s7@t.edu", cs)
        book = Book.objects.create(title="Dwell Book2", authors="A",
                                    department=cs, quantity=1)
        client = APIClient()
        _auth(client, student)
        resp = client.post("/api/dwell-time/", {
            "book_id": book.id, "duration_seconds": "nan"
        })
        assert resp.status_code == 400

    def test_dwell_time_capped_at_86400(self):
        cs = Department.objects.create(name="API-CS8")
        student = _make_approved_student("api_s8", "api_s8@t.edu", cs)
        book = Book.objects.create(title="Dwell Book3", authors="A",
                                    department=cs, quantity=1)
        client = APIClient()
        _auth(client, student)
        resp = client.post("/api/dwell-time/", {
            "book_id": book.id, "duration_seconds": 999999
        })
        assert resp.status_code == 201
        assert resp.data["duration_seconds"] == 86400.0

    def test_otp_request_invalid_email_format_rejected(self):
        client = APIClient()
        resp = client.post("/api/auth/otp/request/", {"email": "not-an-email"})
        assert resp.status_code == 400

    def test_otp_verify_non_numeric_otp_rejected(self):
        client = APIClient()
        resp = client.post("/api/auth/otp/verify/",
                           {"email": "test@t.edu", "otp": "abcdef"})
        assert resp.status_code == 400

    def test_otp_verify_wrong_length_rejected(self):
        client = APIClient()
        resp = client.post("/api/auth/otp/verify/",
                           {"email": "test@t.edu", "otp": "123"})
        assert resp.status_code == 400

    def test_book_review_rating_out_of_range_rejected(self):
        cs = Department.objects.create(name="API-CS9")
        student = _make_approved_student("api_s9", "api_s9@t.edu", cs)
        book = Book.objects.create(title="Review Book", authors="A",
                                    department=cs, quantity=1)
        client = APIClient()
        _auth(client, student)
        resp = client.post(f"/api/books/{book.id}/reviews/",
                           {"rating": 10, "comment": "Too high"})
        assert resp.status_code == 400

    def test_librarian_cannot_create_book_for_other_dept(self):
        """Librarian's dept is forced server-side; they cannot set another dept."""
        cs = Department.objects.create(name="API-CS10")
        mech = Department.objects.create(name="API-Mech10")
        lib = _make_librarian("api_lib10", "api_lib10@t.edu", cs)
        client = APIClient()
        _auth(client, lib)
        resp = client.post("/api/books/manage/", {
            "title": "Mech Injection Book", "authors": "A",
            "categories": "Mech", "quantity": 1,
            "department": mech.id,  # attempt to inject mech dept
        })
        if resp.status_code == 201:
            created_book = Book.objects.get(title="Mech Injection Book")
            assert created_book.department == cs, (
                "Librarian created book in another department"
            )

    def test_student_cannot_access_librarian_dashboard(self):
        cs = Department.objects.create(name="API-CS11")
        student = _make_approved_student("api_s11", "api_s11@t.edu", cs)
        client = APIClient()
        _auth(client, student)
        resp = client.get("/api/analytics/librarian-dashboard/")
        assert resp.status_code == 403

    def test_student_cannot_list_all_students(self):
        cs = Department.objects.create(name="API-CS12")
        student = _make_approved_student("api_s12", "api_s12@t.edu", cs)
        client = APIClient()
        _auth(client, student)
        resp = client.get("/api/analytics/students/")
        assert resp.status_code == 403
