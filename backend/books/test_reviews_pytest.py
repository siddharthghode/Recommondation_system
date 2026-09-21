import pytest
from rest_framework.test import APIClient
from accounts.models import User, Department, Notification
from books.models import Book, BookReview


@pytest.mark.django_db
class TestBookReviewsAndNotifications:
    """Tests for BookReview model, endpoints, and Notification title & type."""

    @pytest.fixture
    def test_dept(self):
        return Department.objects.create(name="Information Technology")

    @pytest.fixture
    def student_user(self, test_dept):
        user = User.objects.create_user(
            username="review_student",
            email="rev_stud@univ.edu",
            password="StudPassword123!",
            role="student",
            department=test_dept
        )
        profile = user.profile
        profile.department = test_dept
        profile.approval_status = "approved"
        profile.save()
        return user

    @pytest.fixture
    def student_user2(self, test_dept):
        user = User.objects.create_user(
            username="review_student2",
            email="rev_stud2@univ.edu",
            password="StudPassword123!",
            role="student",
            department=test_dept
        )
        profile = user.profile
        profile.department = test_dept
        profile.approval_status = "approved"
        profile.save()
        return user

    @pytest.fixture
    def sample_book(self, test_dept):
        return Book.objects.create(
            title="Clean Architecture",
            authors="Robert C. Martin",
            categories="Software Design",
            department=test_dept,
            quantity=5
        )

    def test_create_and_get_review(self, api_client, student_user, sample_book, auth_headers):
        headers = auth_headers(student_user)
        # Create review
        res = api_client.post(
            f"/api/books/{sample_book.id}/reviews/",
            {"rating": 5, "comment": "Excellent architectural principles!"},
            format="json",
            **headers
        )
        assert res.status_code == 201
        assert res.data["rating"] == 5
        assert res.data["comment"] == "Excellent architectural principles!"
        assert res.data["username"] == "review_student"

        # List reviews (public/unauthenticated)
        anon_client = APIClient()
        list_res = anon_client.get(f"/api/books/{sample_book.id}/reviews/")
        assert list_res.status_code == 200
        assert len(list_res.data) == 1
        assert list_res.data[0]["rating"] == 5

    def test_duplicate_review_prevented(self, api_client, student_user, sample_book, auth_headers):
        headers = auth_headers(student_user)
        # First review
        res1 = api_client.post(
            f"/api/books/{sample_book.id}/reviews/",
            {"rating": 4, "comment": "Good read."},
            format="json",
            **headers
        )
        assert res1.status_code == 201

        # Duplicate review attempt
        res2 = api_client.post(
            f"/api/books/{sample_book.id}/reviews/",
            {"rating": 5, "comment": "Trying again."},
            format="json",
            **headers
        )
        assert res2.status_code == 400
        assert "already reviewed" in res2.data.get("error", "").lower()

    def test_invalid_rating_rejected(self, api_client, student_user, sample_book, auth_headers):
        headers = auth_headers(student_user)
        res = api_client.post(
            f"/api/books/{sample_book.id}/reviews/",
            {"rating": 6, "comment": "Too high!"},
            format="json",
            **headers
        )
        assert res.status_code == 400
        assert "rating" in res.data

    def test_update_and_delete_review(self, api_client, student_user, student_user2, sample_book, auth_headers):
        headers = auth_headers(student_user)
        # Create
        create_res = api_client.post(
            f"/api/books/{sample_book.id}/reviews/",
            {"rating": 3, "comment": "Initial thought."},
            format="json",
            **headers
        )
        review_id = create_res.data["id"]

        # Update own review
        update_res = api_client.put(
            f"/api/books/{sample_book.id}/reviews/{review_id}/",
            {"rating": 4, "comment": "Updated thought."},
            format="json",
            **headers
        )
        assert update_res.status_code == 200
        assert update_res.data["rating"] == 4
        assert update_res.data["comment"] == "Updated thought."

        # Another user cannot update it
        headers2 = auth_headers(student_user2)
        update_res2 = api_client.put(
            f"/api/books/{sample_book.id}/reviews/{review_id}/",
            {"rating": 1, "comment": "Hacked!"},
            format="json",
            **headers2
        )
        assert update_res2.status_code == 404

        # Delete own review
        del_res = api_client.delete(
            f"/api/books/{sample_book.id}/reviews/{review_id}/",
            **headers
        )
        assert del_res.status_code == 204
        assert BookReview.objects.filter(id=review_id).count() == 0

    def test_notification_title_and_type(self, student_user):
        notif = Notification.objects.create(
            user=student_user,
            title="Book Due Soon",
            message="Please return your book within 2 days.",
            notification_type="return_reminder"
        )
        assert notif.title == "Book Due Soon"
        assert notif.notification_type == "return_reminder"
        assert not notif.is_read
