import io
from unittest.mock import patch

import pytest
from django.core.cache import cache

from books.models import Book
from books.services.csv_importer import (
    _clean_str,
    _to_float,
    _to_int,
    import_books_from_csv,
)


class TestCSVImporterUnitHelpers:
    """Fast, deterministic Layer 1 unit tests for CSV helper conversion functions."""

    @pytest.mark.parametrize("val,default,expected", [
        (None, 0, 0),
        ("", 10, 10),
        ("   ", 5, 5),
        ("42", 0, 42),
        ("42.0", 0, 42),
        ("42.9", 0, 42),
        (100, 0, 100),
        ("not_a_number", -1, -1),
        ([], 99, 99),
    ])
    def test_to_int_conversion(self, val, default, expected):
        """_to_int safely parses valid integers and floats, falling back to default."""
        assert _to_int(val, default=default) == expected

    @pytest.mark.parametrize("val,default,expected", [
        (None, 0.0, 0.0),
        ("", 3.5, 3.5),
        ("   ", 1.0, 1.0),
        ("4.85", 0.0, 4.85),
        ("5", 0.0, 5.0),
        (4.2, 0.0, 4.2),
        ("invalid_float", 2.5, 2.5),
    ])
    def test_to_float_conversion(self, val, default, expected):
        """_to_float safely parses decimal strings, falling back to default."""
        assert _to_float(val, default=default) == expected

    def test_clean_str_truncation_and_strip(self):
        """_clean_str strips whitespace and enforces maximum length boundary."""
        assert _clean_str(None) == ""
        assert _clean_str("  clean text  ") == "clean text"
        long_str = "x" * 1000
        cleaned = _clean_str(long_str, max_len=100)
        assert len(cleaned) == 100
        assert cleaned == "x" * 100


@pytest.mark.django_db
class TestCSVImporterIntegration:
    """
    Layer 2 Integration tests for CSV catalog import:
    - Distributed concurrency lock per department
    - Multi-alias column resolution (Book_title, Creator, Stock, etc.)
    - Character encoding resilience (UTF-8-SIG, Latin-1)
    - Non-destructive updates vs new creation
    - Cache invalidation triggers
    """

    def test_import_without_department_fails(self):
        """Importing without a valid department is rejected."""
        f = io.BytesIO(b"title,authors\nTest,Author")
        res = import_books_from_csv(f, department=None)
        assert res["success"] is False
        assert "valid department is required" in res["error"]

    def test_import_distributed_lock_contention(self, cs_dept):
        """Concurrent imports for the same department are prevented by distributed lock."""
        lock_key = f"csv_import_dept_{cs_dept.id}"
        # Pre-acquire the lock
        cache.set(lock_key, "1", timeout=60)

        f = io.BytesIO(b"title,authors\nTest,Author")
        res = import_books_from_csv(f, department=cs_dept)
        assert res["success"] is False
        assert "already in progress" in res["error"]
        assert res["row_errors"] == ["Concurrent import conflict."]

        # Clean up lock
        cache.delete(lock_key)

    def test_import_various_column_aliases(self, cs_dept):
        """CSV parser supports common alias variations: 'Book_title', 'creator', 'stock'."""
        csv_data = (
            b"Book_title,creator,subjects,stock,publication_year,rating\n"
            b"Distributed Systems,Tanenbaum,Networks,7,2021,4.75\n"
        )

        f = io.BytesIO(csv_data)
        res = import_books_from_csv(f, department=cs_dept)
        assert res["success"] is True
        assert res["created"] == 1

        book = Book.objects.get(title="Distributed Systems", department=cs_dept)
        assert book.authors == "Tanenbaum"
        assert book.categories == "Networks"
        assert book.quantity == 7
        assert book.published_year == 2021
        assert float(book.average_rating) == 4.75

    def test_import_latin1_and_bom_encoding_fallback(self, cs_dept):
        """CSV with Latin-1 accents (e.g. René Descartes) imports smoothly."""
        # \xe9 is 'é' in latin-1
        latin1_bytes = "title,authors,quantity\nDiscours de la méthode,Ren\xe9 Descartes,3\n".encode('latin-1')

        f = io.BytesIO(latin1_bytes)
        res = import_books_from_csv(f, department=cs_dept)
        assert res["success"] is True
        assert res["created"] == 1

        book = Book.objects.get(department=cs_dept, title="Discours de la méthode")
        assert "René Descartes" in book.authors

    def test_import_updates_existing_book_fields(self, cs_dept):
        """Re-importing updated metadata updates existing book in place."""
        initial_book = Book.objects.create(
            title="Clean Architecture",
            authors="Robert C. Martin",
            categories="Software",
            quantity=2,
            published_year=2017,
            department=cs_dept
        )

        update_csv = (
            b"title,authors,categories,quantity,published_year,average_rating\n"
            b"Clean Architecture,Robert C. Martin,Software Craftsmanship,10,2018,4.9\n"
        )

        f = io.BytesIO(update_csv)
        res = import_books_from_csv(f, department=cs_dept)
        assert res["success"] is True
        assert res["updated"] == 1
        assert res["created"] == 0

        initial_book.refresh_from_db()
        assert initial_book.quantity == 10
        assert initial_book.categories == "Software Craftsmanship"
        assert initial_book.published_year == 2018
        assert float(initial_book.average_rating) == 4.9

    def test_import_empty_file_and_missing_title(self, cs_dept):
        """Empty files and headers missing a title column report helpful errors."""
        empty_f = io.BytesIO(b"   \n\n  ")
        r_empty = import_books_from_csv(empty_f, department=cs_dept)
        assert r_empty["success"] is False
        assert "empty" in r_empty["error"]

        no_title_f = io.BytesIO(b"author,genre,year\nKnuth,Math,1997\n")
        r_no_title = import_books_from_csv(no_title_f, department=cs_dept)
        assert r_no_title["success"] is False
        assert "Missing required CSV column" in r_no_title["error"]

    def test_import_cache_invalidation_triggers(self, cs_dept):
        """Successful import invalidates dashboard and catalog caches."""
        with patch("books.cache_utils.invalidate_catalog_cache") as mock_cat, \
             patch("books.cache_utils.invalidate_categories_cache") as mock_cats, \
             patch("books.cache_utils.invalidate_dashboard_cache") as mock_dash:

            csv_data = b"title,authors,quantity\nIntro to CS,Prof A,5\n"
            res = import_books_from_csv(io.BytesIO(csv_data), department=cs_dept)
            assert res["success"] is True

            mock_cat.assert_called_once()
            mock_cats.assert_called_once()
            mock_dash.assert_called_once_with(cs_dept.id)
