import re

import pytest
from accounts.models import User
from borrows.models import Borrow
from django.core import mail
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestEndToEndStudentLifecycle:
    """
    Layer 3 End-to-End Test: Full student lifecycle through public DRF API boundaries:
    1. Email OTP request and verification
    2. Registration -> Pending status
    3. Pending authorization enforcement
    4. Librarian approval workflow
    5. Catalog access & recommendation engagement
    6. Borrow request submission
    7. Librarian hold approval & atomic inventory decrement
    8. Book return & inventory replenishment
    """

    def test_full_student_journey(self, cs_dept, cs_sample_books, cs_librarian):
        client = APIClient()
        student_email = "e2e_candidate@univ.edu"
        target_book = cs_sample_books[0]
        initial_stock = target_book.quantity

        # ── 1. Request OTP ──────────────────────────────────────────────────
        mail.outbox.clear()
        otp_req_res = client.post("/api/auth/otp/request/", {
            "email": student_email,
            "purpose": "register"
        }, format="json")
        assert otp_req_res.status_code == 200

        # Retrieve OTP code from outbound email
        assert len(mail.outbox) == 1
        match = re.search(r'\b\d{6}\b', mail.outbox[0].body)
        assert match is not None
        otp_code = match.group(0)

        # ── 2. Verify OTP ───────────────────────────────────────────────────
        otp_ver_res = client.post("/api/auth/otp/verify/", {
            "email": student_email,
            "otp": otp_code
        }, format="json")
        assert otp_ver_res.status_code == 200
        verification_token = otp_ver_res.data["verification_token"]
        assert verification_token is not None

        # ── 3. Register Student (starts in 'pending' state) ──────────────────
        reg_payload = {
            "username": "e2e_student",
            "password": "SecureStudentPass123!",
            "password_confirm": "SecureStudentPass123!",
            "email": student_email,
            "department": cs_dept.id,
            "student_id": "CS-E2E-2026",
            "year": 3,
            "preferred_categories": "Algorithms, Systems",
            "verification_token": verification_token,
            "role": "student"
        }
        reg_res = client.post("/api/auth/register/", reg_payload, format="json")
        assert reg_res.status_code == 201

        # ── 4. Verify Pending Student Access Barrier ────────────────────────
        login_res = client.post("/api/auth/login/", {
            "username": "e2e_student",
            "password": "SecureStudentPass123!"
        }, format="json")
        assert login_res.status_code == 200
        student_token = login_res.data["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")

        # Pending student receives empty book list
        catalog_res = client.get("/api/books/")
        assert catalog_res.status_code == 200
        assert len(catalog_res.data.get("results", [])) == 0

        # Pending student cannot access book detail
        detail_res = client.get(f"/api/books/{target_book.id}/")
        assert detail_res.status_code == 404

        # Pending student cannot request borrow
        borrow_blocked_res = client.post("/api/borrows/request/", {"book_id": target_book.id})
        assert borrow_blocked_res.status_code == 403

        # ── 5. Librarian Approves Pending Student ───────────────────────────
        lib_client = APIClient()
        lib_login = lib_client.post("/api/auth/login/", {
            "username": cs_librarian.username,
            "password": "LibrarianPass123!"
        }, format="json")
        assert lib_login.status_code == 200
        lib_token = lib_login.data["access"]
        lib_client.credentials(HTTP_AUTHORIZATION=f"Bearer {lib_token}")

        # Librarian finds pending student
        pending_list = lib_client.get("/api/analytics/students/pending/")
        assert pending_list.status_code == 200
        student_user = User.objects.get(email=student_email)
        assert any(s["id"] == student_user.id for s in pending_list.data)

        # Librarian approves student
        approve_res = lib_client.post(f"/api/analytics/students/{student_user.id}/approve/")
        assert approve_res.status_code == 200

        # Verify profile is now approved
        student_user.refresh_from_db()
        assert student_user.profile.approval_status == "approved"

        # ── 6. Approved Student Browses and Logs Interaction ────────────────
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")

        # Catalog access is now permitted
        catalog_res2 = client.get("/api/books/")
        assert catalog_res2.status_code == 200
        books_list = catalog_res2.data.get("results", catalog_res2.data)
        assert len(books_list) >= 3

        # Record book interaction / view tracking
        track_res = client.post(f"/api/books/track/{target_book.id}/")
        assert track_res.status_code == 200

        # Get personalized recommendations
        rec_res = client.get("/api/books/recommendations/?method=content")
        assert rec_res.status_code == 200
        assert isinstance(rec_res.data, list)

        # ── 7. Submit Borrow Request ─────────────────────────────────────────
        borrow_res = client.post("/api/borrows/request/", {"book_id": target_book.id})
        assert borrow_res.status_code == 200
        borrow_id = borrow_res.data["borrow_id"]

        # ── 8. Librarian Approves Borrow ─────────────────────────────────────
        pending_borrows = lib_client.get("/api/borrows/pending/")
        assert pending_borrows.status_code == 200
        assert any(b["id"] == borrow_id for b in pending_borrows.data)

        approve_borrow_res = lib_client.post(f"/api/borrows/approve/{borrow_id}/")
        assert approve_borrow_res.status_code == 200

        # Inventory is decremented
        target_book.refresh_from_db()
        assert target_book.quantity == initial_stock - 1

        # Student receives in-app notification
        notifs_res = client.get("/api/auth/notifications/")
        assert notifs_res.status_code == 200
        assert any("approved" in n["message"].lower() for n in notifs_res.data)

        # ── 9. Student Returns Book ──────────────────────────────────────────
        return_res = client.post("/api/borrows/return/", {"borrow_id": borrow_id})
        assert return_res.status_code == 200

        # Inventory is restored
        target_book.refresh_from_db()
        assert target_book.quantity == initial_stock

        borrow_record = Borrow.objects.get(id=borrow_id)
        assert borrow_record.status == "returned"
        assert borrow_record.return_date is not None
