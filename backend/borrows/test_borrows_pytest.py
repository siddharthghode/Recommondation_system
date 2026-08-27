import pytest
from borrows.models import Borrow
from accounts.models import Notification


@pytest.mark.django_db
class TestPytestBorrowingWorkflows:
    """Pytest suite testing borrow circulation, atomic stock updates, and department boundaries."""

    def test_student_can_request_department_book(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        """Approved CS student requests CS book successfully."""
        api_client.credentials(**auth_headers(approved_cs_student))
        target_book = cs_sample_books[0]
        
        response = api_client.post("/api/borrows/request/", {"book_id": target_book.id})
        assert response.status_code == 200
        assert "borrow_id" in response.data
        
        borrow_record = Borrow.objects.get(id=response.data["borrow_id"])
        assert borrow_record.status == "requested"
        assert borrow_record.user == approved_cs_student
        assert borrow_record.book == target_book

    def test_student_cannot_request_other_department_book(
        self, api_client, approved_cs_student, mech_sample_books, auth_headers
    ):
        """Approved CS student cannot request Mechanical department book."""
        api_client.credentials(**auth_headers(approved_cs_student))
        target_book = mech_sample_books[0]
        
        response = api_client.post("/api/borrows/request/", {"book_id": target_book.id})
        assert response.status_code in [403, 404]
        assert not Borrow.objects.filter(user=approved_cs_student, book=target_book).exists()

    def test_librarian_approves_borrow_atomically_decrements_stock(
        self, api_client, cs_librarian, approved_cs_student, cs_sample_books, auth_headers
    ):
        """CS Librarian approves hold request, atomic stock decrements and due date set to 30 days."""
        target_book = cs_sample_books[0]
        initial_qty = target_book.quantity
        
        borrow = Borrow.objects.create(
            user=approved_cs_student,
            book=target_book,
            status="requested"
        )
        
        api_client.credentials(**auth_headers(cs_librarian))
        response = api_client.post(f"/api/borrows/approve/{borrow.id}/")
        assert response.status_code == 200
        
        borrow.refresh_from_db()
        target_book.refresh_from_db()
        
        assert borrow.status == "approved"
        assert borrow.approved_at is not None
        assert borrow.due_date is not None
        assert target_book.quantity == initial_qty - 1
        
        # Student receives notification
        assert Notification.objects.filter(
            user=approved_cs_student, message__icontains="approved"
        ).exists()

    def test_librarian_cannot_approve_other_department_borrow(
        self, api_client, cs_librarian, approved_mech_student, mech_sample_books, auth_headers
    ):
        """CS Librarian cannot approve Mechanical department borrow request."""
        mech_book = mech_sample_books[0]
        borrow = Borrow.objects.create(
            user=approved_mech_student,
            book=mech_book,
            status="requested"
        )
        
        api_client.credentials(**auth_headers(cs_librarian))
        response = api_client.post(f"/api/borrows/approve/{borrow.id}/")
        assert response.status_code == 403
        
        borrow.refresh_from_db()
        assert borrow.status == "requested"

    def test_student_returns_book_increments_stock(
        self, api_client, approved_cs_student, cs_sample_books, auth_headers
    ):
        """Student returns approved loan, stock increments back and status updates to returned."""
        target_book = cs_sample_books[0]
        target_book.quantity = 2
        target_book.save()
        
        borrow = Borrow.objects.create(
            user=approved_cs_student,
            book=target_book,
            status="approved"
        )
        
        api_client.credentials(**auth_headers(approved_cs_student))
        response = api_client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        assert response.status_code == 200
        
        borrow.refresh_from_db()
        target_book.refresh_from_db()
        
        assert borrow.status == "returned"
        assert borrow.return_date is not None
        assert target_book.quantity == 3
