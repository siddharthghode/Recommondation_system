import pytest
from accounts.models import Notification, User
from books.models import Book

from borrows.models import Borrow


@pytest.mark.django_db
class TestBorrowConcurrencyAndCirculationInvariants:
    """
    Tests covering stock boundary conditions, concurrent holds,
    rejections, state validation, and inventory integrity.
    """

    def test_stock_exhaustion_blocks_second_approval(
        self, api_client, cs_librarian, approved_cs_student, cs_dept, auth_headers
    ):
        """
        When stock is 1 and multiple hold requests are queued,
        the first approval exhausts inventory (quantity=0), and subsequent
        approval is blocked with 'Out of stock'.
        """
        # Create a scarce book with only 1 copy in stock
        scarce_book = Book.objects.create(
            title="Single Copy Rarity",
            authors="Rare Author",
            categories="Computer Science",
            quantity=1,
            department=cs_dept
        )

        student_b = User.objects.create_user(
            username="student_cs_02",
            email="student_cs_02@univ.edu",
            password="StudentPass123!",
            role="student",
            department=cs_dept
        )
        student_b.profile.department = cs_dept
        student_b.profile.approval_status = "approved"
        student_b.profile.save()

        # Both students have pending borrow requests
        borrow_a = Borrow.objects.create(user=approved_cs_student, book=scarce_book, status="requested")
        borrow_b = Borrow.objects.create(user=student_b, book=scarce_book, status="requested")

        api_client.credentials(**auth_headers(cs_librarian))

        # 1. Approve Borrow A -> succeeds, drops quantity to 0
        resp_a = api_client.post(f"/api/borrows/approve/{borrow_a.id}/")
        assert resp_a.status_code == 200
        scarce_book.refresh_from_db()
        assert scarce_book.quantity == 0

        # 2. Attempt to approve Borrow B -> fails because out of stock
        resp_b = api_client.post(f"/api/borrows/approve/{borrow_b.id}/")
        assert resp_b.status_code == 400
        assert "Out of stock" in resp_b.data["error"]

        # Invariant: Borrow B remains in requested state, stock stays 0
        borrow_b.refresh_from_db()
        assert borrow_b.status == "requested"
        scarce_book.refresh_from_db()
        assert scarce_book.quantity == 0

    def test_reject_borrow_with_reason_and_student_notification(
        self, api_client, cs_librarian, approved_cs_student, cs_sample_books, auth_headers
    ):
        """Librarian rejects a borrow request with an explanatory reason; student is notified."""
        target_book = cs_sample_books[0]
        borrow = Borrow.objects.create(
            user=approved_cs_student,
            book=target_book,
            status="requested"
        )

        api_client.credentials(**auth_headers(cs_librarian))
        rejection_payload = {"reason": "Overdue fees pending on library account"}
        resp = api_client.post(f"/api/borrows/reject/{borrow.id}/", rejection_payload, format="json")
        assert resp.status_code == 200

        borrow.refresh_from_db()
        assert borrow.status == "rejected"
        assert borrow.rejection_reason == "Overdue fees pending on library account"

        # Verify student receives rejection notification with reason
        notif = Notification.objects.filter(user=approved_cs_student, notification_type="borrow_rejected").first()
        assert notif is not None
        assert "Overdue fees pending" in notif.message

        # Cannot approve an already rejected borrow
        resp_approve = api_client.post(f"/api/borrows/approve/{borrow.id}/")
        assert resp_approve.status_code == 400
        assert "Borrow not in requested state" in resp_approve.data["error"]

    def test_return_non_approved_borrow_fails(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        """Attempting to return a borrow that is only in 'requested' state returns 400."""
        target_book = cs_sample_books[0]
        borrow = Borrow.objects.create(
            user=approved_cs_student,
            book=target_book,
            status="requested"
        )

        api_client.credentials(**auth_headers(approved_cs_student))
        resp = api_client.post("/api/borrows/return/", {"borrow_id": borrow.id}, format="json")
        assert resp.status_code == 400
        assert "Only approved borrows can be returned" in resp.data["error"]

    def test_double_return_prevention(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        """A book cannot be returned a second time to arbitrarily inflate stock."""
        target_book = cs_sample_books[0]
        target_book.quantity = 5
        target_book.save()

        borrow = Borrow.objects.create(
            user=approved_cs_student,
            book=target_book,
            status="approved"
        )

        api_client.credentials(**auth_headers(approved_cs_student))

        # First return succeeds
        resp1 = api_client.post("/api/borrows/return/", {"borrow_id": borrow.id}, format="json")
        assert resp1.status_code == 200
        target_book.refresh_from_db()
        assert target_book.quantity == 6

        # Second return rejected
        resp2 = api_client.post("/api/borrows/return/", {"borrow_id": borrow.id}, format="json")
        assert resp2.status_code == 400
        assert "Only approved borrows can be returned" in resp2.data["error"]
        target_book.refresh_from_db()
        assert target_book.quantity == 6  # Stock remains constant
