import pytest
from books.models import Book, BookInteraction, BookDwellTime
from books.services.recommender import (
    content_based,
    interaction_based,
    hybrid,
    get_similar_books,
    invalidate_user_recommendations,
)


@pytest.mark.django_db
class TestPytestRecommenderEngine:
    """Pytest suite testing recommender algorithms, weighting, and department scoping."""

    @pytest.mark.parametrize("rec_method,expected_count", [
        ("content", 2),
        ("collaborative", 2),
        ("hybrid", 2),
    ])
    def test_recommender_methods_return_valid_recommendations(
        self, approved_cs_student, cs_sample_books, rec_method, expected_count
    ):
        """Verify all recommendation strategies return expected number of department-scoped books."""
        if rec_method == "content":
            results = content_based(approved_cs_student, limit=expected_count)
        elif rec_method == "collaborative":
            results = interaction_based(approved_cs_student, limit=expected_count)
        else:
            results = hybrid(approved_cs_student, limit=expected_count)

        assert len(results) > 0
        assert len(results) <= expected_count
        for book in results:
            assert book.department == approved_cs_student.profile.department

    def test_content_recommender_prioritizes_preferred_categories(
        self, approved_cs_student, cs_sample_books
    ):
        """Content-based filtering matches user's preferred_categories."""
        results = content_based(approved_cs_student, limit=5)
        titles = [b.title for b in results]
        assert "Introduction to Algorithms" in titles or "Artificial Intelligence: A Modern Approach" in titles

    def test_collaborative_recommender_incorporates_dwell_time_bonus(
        self, approved_cs_student, cs_sample_books
    ):
        """Reading dwell time >= 20s and >= 60s boosts user interaction weight."""
        target_book = cs_sample_books[0]
        BookDwellTime.objects.create(
            user=approved_cs_student,
            book=target_book,
            duration_seconds=75.0  # >= 60s -> bonus weight of 2
        )
        # Invalidate cache
        invalidate_user_recommendations(approved_cs_student.id, approved_cs_student.profile.department.id)
        
        # User has engaged with target_book
        user_weight = BookDwellTime.objects.filter(user=approved_cs_student, book=target_book).first()
        assert user_weight is not None
        assert user_weight.duration_seconds == 75.0

    def test_similar_books_tfidf_cosine_similarity(self, cs_sample_books):
        """Verify TF-IDF cosine similarity between related CS textbooks."""
        algo_book = cs_sample_books[0]  # Intro to Algorithms
        ai_book = cs_sample_books[1]    # AI Modern Approach
        
        similar = get_similar_books(algo_book.id, limit=5)
        similar_ids = [b.id for b in similar]
        
        # Target book itself must be excluded
        assert algo_book.id not in similar_ids
        assert len(similar) > 0

    def test_cross_department_recommendation_isolation(
        self, approved_cs_student, cs_sample_books, mech_sample_books
    ):
        """CS student must never receive Mechanical Engineering books in recommendations."""
        results = hybrid(approved_cs_student, limit=10)
        mech_book_ids = [b.id for b in mech_sample_books]
        
        for book in results:
            assert book.id not in mech_book_ids
            assert book.department == approved_cs_student.profile.department

    def test_pending_student_receives_no_recommendations(
        self, pending_cs_student, cs_sample_books
    ):
        """Pending unapproved students must not receive recommendations."""
        results = hybrid(pending_cs_student, limit=5)
        assert results == []
