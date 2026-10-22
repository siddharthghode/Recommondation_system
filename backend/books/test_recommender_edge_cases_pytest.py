
import pytest
from accounts.models import User

from books.models import Book, BookInteraction
from books.services.recommender import (
    _acquire_stampede_lock,
    _release_stampede_lock,
    content_based,
    get_similar_books,
    hybrid,
    interaction_based,
)


@pytest.mark.django_db
class TestRecommenderEdgeCasesAndInvariants:
    """
    Tests covering boundary conditions, department barriers, cold start,
    and stampede lock handling in the recommendation engine.
    """

    def test_unapproved_student_without_department_returns_empty(self, db):
        """Unapproved student or student without department gets empty recommendations."""
        user = User.objects.create_user(
            username="unassigned_student",
            email="unassigned@univ.edu",
            password="Password123!",
            role="student"
        )
        assert content_based(user) == []
        assert interaction_based(user) == []
        assert hybrid(user) == []

    def test_student_with_no_preferred_categories_falls_back_to_top_rated(self, db, cs_dept, cs_sample_books):
        """When a student has no category preferences, top-rated department books are suggested."""
        student = User.objects.create_user(
            username="blank_prefs_student",
            email="blank@univ.edu",
            password="Password123!",
            role="student",
            department=cs_dept
        )
        student.profile.department = cs_dept
        student.profile.approval_status = "approved"
        student.profile.preferred_categories = ""
        student.profile.save()

        recs = content_based(student, limit=2)
        assert len(recs) == 2
        # Highest average rating in cs_sample_books is 4.9 (Artificial Intelligence)
        assert recs[0].title == "Artificial Intelligence: A Modern Approach"

    def test_already_interacted_books_excluded(self, db, cs_dept, cs_sample_books, approved_cs_student):
        """Books that a student has already borrowed or rated are excluded from suggestions."""
        top_book = cs_sample_books[1]  # AI Modern Approach
        BookInteraction.objects.create(
            user=approved_cs_student,
            book=top_book,
            interaction_type="borrow"
        )

        recs = content_based(approved_cs_student, limit=3)
        rec_ids = [b.id for b in recs]
        assert top_book.id not in rec_ids

    def test_cross_department_book_isolation_invariant(self, db, cs_dept, mech_dept, approved_cs_student):
        """
        Critical security invariant:
        Even if Mechanical Engineering has a book with 5.0 rating and matching tags,
        a CS student must never receive that book in recommendations.
        """
        mech_book = Book.objects.create(
            title="Python for Mechanical Modeling",
            authors="Mech Author",
            categories="Python, Artificial Intelligence, Algorithms",
            quantity=10,
            average_rating=5.0,
            ratings_count=999,
            department=mech_dept
        )

        recs = content_based(approved_cs_student, limit=10)
        assert mech_book not in recs
        for book in recs:
            assert book.department == cs_dept

    def test_similar_books_nonexistent_book_id(self):
        """Passing an invalid/non-existent book ID returns empty list gracefully."""
        res = get_similar_books(9999999, limit=4)
        assert res == []

    def test_similar_books_empty_categories_fallback_to_author(self, db, cs_dept):
        """Book with empty categories falls back to finding other books by the same author."""
        b1 = Book.objects.create(
            title="Book Without Category A",
            authors="Famous Author",
            categories="",
            quantity=3,
            average_rating=4.5,
            department=cs_dept
        )
        b2 = Book.objects.create(
            title="Book Without Category B",
            authors="Famous Author",
            categories="",
            quantity=3,
            average_rating=4.7,
            department=cs_dept
        )

        sims = get_similar_books(b1.id, limit=2)
        assert len(sims) == 1
        assert sims[0].id == b2.id

    def test_stampede_lock_acquisition_and_release(self):
        """Stampede lock is correctly acquired and released."""
        test_key = "stampede:test_recommendation_lock_key"
        # Release if exists
        _release_stampede_lock(test_key)

        acquired = _acquire_stampede_lock(test_key, timeout=5)
        assert acquired is True

        # Second attempt while held should fail
        second_attempt = _acquire_stampede_lock(test_key, timeout=5)
        assert second_attempt is False

        # Release
        _release_stampede_lock(test_key)
        reacquired = _acquire_stampede_lock(test_key, timeout=5)
        assert reacquired is True
        _release_stampede_lock(test_key)
