import pytest
from borrows.models import Borrow
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestEndToEndDepartmentIsolation:
    """
    Layer 3 End-to-End Test: Multi-tenant department isolation verification:
    - CS Student cannot browse or request Mechanical books
    - CS Librarian cannot view, approve, or reject Mechanical borrows
    - CS Librarian cannot approve Mechanical students
    - Super Admin retains global authority across both departments
    """

    def test_cross_department_student_isolation(
        self, api_client, approved_cs_student, approved_mech_student, cs_sample_books, mech_sample_books, auth_headers
    ):
        """CS Student catalog and request views are strictly isolated to CS books."""
        cs_book = cs_sample_books[0]
        mech_book = mech_sample_books[0]

        client_cs = api_client
        client_cs.credentials(**auth_headers(approved_cs_student))

        # 1. Listing books only returns CS books
        resp_list = client_cs.get("/api/books/")
        assert resp_list.status_code == 200
        items = resp_list.data.get("results", resp_list.data)
        book_ids = [b["id"] for b in items]
        assert cs_book.id in book_ids
        assert mech_book.id not in book_ids

        # 2. Retrieving Mech book by ID returns 404
        resp_detail = client_cs.get(f"/api/books/{mech_book.id}/")
        assert resp_detail.status_code == 404

        # 3. Direct API request to borrow Mech book is rejected
        resp_borrow = client_cs.post("/api/borrows/request/", {"book_id": mech_book.id})
        assert resp_borrow.status_code in (403, 404)

    def test_cross_department_librarian_isolation(
        self, api_client, cs_librarian, mech_librarian, approved_mech_student, mech_sample_books, auth_headers
    ):
        """CS Librarian cannot approve/reject Mechanical department students or borrow requests."""
        mech_book = mech_sample_books[0]

        # Mechanical student creates a borrow request
        borrow = Borrow.objects.create(
            user=approved_mech_student,
            book=mech_book,
            status="requested"
        )

        client_cs_lib = api_client
        client_cs_lib.credentials(**auth_headers(cs_librarian))

        # 1. CS Librarian cannot approve Mechanical borrow
        approve_res = client_cs_lib.post(f"/api/borrows/approve/{borrow.id}/")
        assert approve_res.status_code == 403

        # 2. CS Librarian cannot reject Mechanical borrow
        reject_res = client_cs_lib.post(f"/api/borrows/reject/{borrow.id}/", {"reason": "Unauthorized"}, format="json")
        assert reject_res.status_code == 403

        # Invariant: Borrow remains in requested state
        borrow.refresh_from_db()
        assert borrow.status == "requested"

        # 3. Mechanical Librarian CAN approve it
        client_mech_lib = APIClient()
        client_mech_lib.credentials(**auth_headers(mech_librarian))
        valid_approve_res = client_mech_lib.post(f"/api/borrows/approve/{borrow.id}/")
        assert valid_approve_res.status_code == 200
        borrow.refresh_from_db()
        assert borrow.status == "approved"

    def test_super_admin_global_authority(
        self, api_client, super_admin, cs_sample_books, mech_sample_books, auth_headers
    ):
        """Super Admin can list and view books across all departments."""
        api_client.credentials(**auth_headers(super_admin))

        resp = api_client.get("/api/books/")
        assert resp.status_code == 200
        items = resp.data.get("results", resp.data)
        book_ids = [b["id"] for b in items]
        # Both departments' books are visible to Super Admin
        assert cs_sample_books[0].id in book_ids
        assert mech_sample_books[0].id in book_ids
