from django.test import TestCase
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, Department, Notification
from books.models import Book
from borrows.models import Borrow


class BorrowsDepartmentAuthorizationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

        # Departments
        self.dept_a = Department.objects.create(name="Computer Science")
        self.dept_b = Department.objects.create(name="Mechanical Engineering")

        # Super Admin
        self.admin = User.objects.create_superuser(
            username="admin_user",
            email="admin@test.com",
            password="AdminPassword123!",
            role="admin"
        )

        # Librarian A (Dept A)
        self.lib_a = User.objects.create_user(
            username="librarian_a",
            email="lib_a@test.com",
            password="Password123!",
            role="librarian",
            department=self.dept_a
        )

        # Librarian B (Dept B)
        self.lib_b = User.objects.create_user(
            username="librarian_b",
            email="lib_b@test.com",
            password="Password123!",
            role="librarian",
            department=self.dept_b
        )

        # Student A (Dept A)
        self.student_a = User.objects.create_user(
            username="student_a",
            email="student_a@test.com",
            password="Password123!",
            role="student"
        )
        self.student_a.profile.department = self.dept_a
        self.student_a.profile.approval_status = "approved"
        self.student_a.profile.student_id = "CS-001"
        self.student_a.profile.save()

        # Student B (Dept B)
        self.student_b = User.objects.create_user(
            username="student_b",
            email="student_b@test.com",
            password="Password123!",
            role="student"
        )
        self.student_b.profile.department = self.dept_b
        self.student_b.profile.approval_status = "approved"
        self.student_b.profile.student_id = "ME-001"
        self.student_b.profile.save()

        # Books
        self.book_a = Book.objects.create(
            title="Clean Code",
            authors="Robert Martin",
            categories="Programming",
            department=self.dept_a,
            quantity=3
        )
        self.book_b = Book.objects.create(
            title="Thermodynamics for Engineers",
            authors="Moran & Shapiro",
            categories="Thermodynamics",
            department=self.dept_b,
            quantity=3
        )

    def _authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    # --- Student Borrow Isolation ---
    def test_student_a_can_request_department_a_book(self):
        self._authenticate(self.student_a)
        response = self.client.post("/api/borrows/request/", {"book_id": self.book_a.id})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Borrow.objects.filter(user=self.student_a, book=self.book_a, status='requested').exists())

    def test_student_a_cannot_request_department_b_book(self):
        self._authenticate(self.student_a)
        response = self.client.post("/api/borrows/request/", {"book_id": self.book_b.id})
        self.assertIn(response.status_code, [403, 404])
        self.assertFalse(Borrow.objects.filter(user=self.student_a, book=self.book_b).exists())

    def test_student_can_only_see_own_borrows(self):
        borrow_a = Borrow.objects.create(user=self.student_a, book=self.book_a, status='requested')
        borrow_b = Borrow.objects.create(user=self.student_b, book=self.book_b, status='requested')

        self._authenticate(self.student_a)
        response = self.client.get("/api/borrows/my/")
        self.assertEqual(response.status_code, 200)
        borrow_ids = [b["id"] for b in response.data]
        self.assertIn(borrow_a.id, borrow_ids)
        self.assertNotIn(borrow_b.id, borrow_ids)

    # --- Librarian Borrow Isolation ---
    def test_librarian_a_only_sees_pending_borrows_from_own_department(self):
        borrow_a = Borrow.objects.create(user=self.student_a, book=self.book_a, status='requested')
        borrow_b = Borrow.objects.create(user=self.student_b, book=self.book_b, status='requested')

        self._authenticate(self.lib_a)
        response = self.client.get("/api/borrows/pending/")
        self.assertEqual(response.status_code, 200)
        pending_ids = [b["id"] for b in response.data]
        self.assertIn(borrow_a.id, pending_ids)
        self.assertNotIn(borrow_b.id, pending_ids)

    def test_librarian_a_can_approve_department_a_borrow(self):
        borrow_a = Borrow.objects.create(user=self.student_a, book=self.book_a, status='requested')

        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/borrows/approve/{borrow_a.id}/")
        self.assertEqual(response.status_code, 200)

        borrow_a.refresh_from_db()
        self.assertEqual(borrow_a.status, 'approved')
        self.book_a.refresh_from_db()
        self.assertEqual(self.book_a.quantity, 2)  # Decremented safely

    def test_librarian_a_cannot_approve_department_b_borrow(self):
        borrow_b = Borrow.objects.create(user=self.student_b, book=self.book_b, status='requested')

        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/borrows/approve/{borrow_b.id}/")
        self.assertEqual(response.status_code, 403)

        borrow_b.refresh_from_db()
        self.assertEqual(borrow_b.status, 'requested')  # Remained requested
        self.book_b.refresh_from_db()
        self.assertEqual(self.book_b.quantity, 3)  # Quantity unaffected

    def test_librarian_a_cannot_reject_department_b_borrow(self):
        borrow_b = Borrow.objects.create(user=self.student_b, book=self.book_b, status='requested')

        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/borrows/reject/{borrow_b.id}/", {"reason": "Malicious reject"})
        self.assertEqual(response.status_code, 403)

        borrow_b.refresh_from_db()
        self.assertEqual(borrow_b.status, 'requested')

    def test_admin_can_approve_across_all_departments(self):
        borrow_b = Borrow.objects.create(user=self.student_b, book=self.book_b, status='requested')

        self._authenticate(self.admin)
        response = self.client.post(f"/api/borrows/approve/{borrow_b.id}/")
        self.assertEqual(response.status_code, 200)

        borrow_b.refresh_from_db()
        self.assertEqual(borrow_b.status, 'approved')

    # --- Phase 7 Comprehensive Borrow, Inventory, Concurrency & Notification Tests ---

    def test_pending_student_cannot_request_borrow(self):
        pending_student = User.objects.create_user(
            username="pending_student",
            email="pending@test.com",
            password="Password123!",
            role="student"
        )
        pending_student.profile.department = self.dept_a
        pending_student.profile.approval_status = "pending"
        pending_student.profile.save()

        self._authenticate(pending_student)
        response = self.client.post("/api/borrows/request/", {"book_id": self.book_a.id})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Borrow.objects.filter(user=pending_student).exists())

    def test_rejected_student_cannot_request_borrow(self):
        rejected_student = User.objects.create_user(
            username="rejected_student",
            email="rejected@test.com",
            password="Password123!",
            role="student"
        )
        rejected_student.profile.department = self.dept_a
        rejected_student.profile.approval_status = "rejected"
        rejected_student.profile.save()

        self._authenticate(rejected_student)
        response = self.client.post("/api/borrows/request/", {"book_id": self.book_a.id})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Borrow.objects.filter(user=rejected_student).exists())

    def test_unauthenticated_user_cannot_request_borrow(self):
        self.client.credentials()  # Clear auth
        response = self.client.post("/api/borrows/request/", {"book_id": self.book_a.id})
        self.assertEqual(response.status_code, 401)

    def test_cannot_request_out_of_stock_book(self):
        out_of_stock_book = Book.objects.create(
            title="Out of Stock Book",
            authors="Zero Copies",
            department=self.dept_a,
            quantity=0
        )
        self._authenticate(self.student_a)
        response = self.client.post("/api/borrows/request/", {"book_id": out_of_stock_book.id})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("error"), "Book not available")

    def test_duplicate_pending_or_active_borrow_request_blocked(self):
        self._authenticate(self.student_a)
        # First request succeeds
        res1 = self.client.post("/api/borrows/request/", {"book_id": self.book_a.id})
        self.assertEqual(res1.status_code, 200)

        # Duplicate request fails
        res2 = self.client.post("/api/borrows/request/", {"book_id": self.book_a.id})
        self.assertEqual(res2.status_code, 400)
        self.assertEqual(res2.data.get("error"), "Existing active or requested borrow for this book")
        self.assertEqual(Borrow.objects.filter(user=self.student_a, book=self.book_a).count(), 1)

    def test_borrow_request_creates_student_notification(self):
        self._authenticate(self.student_a)
        response = self.client.post("/api/borrows/request/", {"book_id": self.book_a.id})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.student_a, message__icontains="submitted").exists())

    def test_student_cannot_approve_borrow(self):
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='requested')
        self._authenticate(self.student_a)
        response = self.client.post(f"/api/borrows/approve/{borrow.id}/")
        self.assertEqual(response.status_code, 403)
        borrow.refresh_from_db()
        self.assertEqual(borrow.status, 'requested')

    def test_approval_fails_if_book_out_of_stock(self):
        self.book_a.quantity = 0
        self.book_a.save()
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='requested')

        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/borrows/approve/{borrow.id}/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("error"), "Out of stock")
        borrow.refresh_from_db()
        self.assertEqual(borrow.status, 'requested')

    def test_repeated_approval_fails(self):
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='requested')
        self._authenticate(self.lib_a)
        # First approval
        res1 = self.client.post(f"/api/borrows/approve/{borrow.id}/")
        self.assertEqual(res1.status_code, 200)
        self.book_a.refresh_from_db()
        self.assertEqual(self.book_a.quantity, 2)

        # Second approval fails
        res2 = self.client.post(f"/api/borrows/approve/{borrow.id}/")
        self.assertEqual(res2.status_code, 400)
        self.book_a.refresh_from_db()
        self.assertEqual(self.book_a.quantity, 2)  # Not decremented again

    def test_concurrent_competing_approvals_limited_inventory(self):
        # Book with exactly 1 copy
        scarce_book = Book.objects.create(
            title="Scarce Book",
            authors="Rare Author",
            department=self.dept_a,
            quantity=1
        )
        student_a2 = User.objects.create_user(
            username="student_a2",
            email="sa2@test.com",
            password="Password123!",
            role="student"
        )
        student_a2.profile.department = self.dept_a
        student_a2.profile.approval_status = "approved"
        student_a2.profile.save()

        borrow1 = Borrow.objects.create(user=self.student_a, book=scarce_book, status='requested')
        borrow2 = Borrow.objects.create(user=student_a2, book=scarce_book, status='requested')

        self._authenticate(self.lib_a)
        # First approval succeeds
        res1 = self.client.post(f"/api/borrows/approve/{borrow1.id}/")
        self.assertEqual(res1.status_code, 200)
        scarce_book.refresh_from_db()
        self.assertEqual(scarce_book.quantity, 0)

        # Second approval fails due to 0 inventory
        res2 = self.client.post(f"/api/borrows/approve/{borrow2.id}/")
        self.assertEqual(res2.status_code, 400)
        self.assertEqual(res2.data.get("error"), "Out of stock")

        # Invariants preserved
        scarce_book.refresh_from_db()
        self.assertEqual(scarce_book.quantity, 0)
        borrow2.refresh_from_db()
        self.assertEqual(borrow2.status, 'requested')

    def test_librarian_a_can_reject_department_a_borrow(self):
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='requested')
        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/borrows/reject/{borrow.id}/", {"reason": "Overdue hold"})
        self.assertEqual(response.status_code, 200)

        borrow.refresh_from_db()
        self.assertEqual(borrow.status, 'rejected')
        self.assertEqual(borrow.rejection_reason, 'Overdue hold')
        self.book_a.refresh_from_db()
        self.assertEqual(self.book_a.quantity, 3)  # Quantity unaffected

        # Student receives notification
        self.assertTrue(Notification.objects.filter(user=self.student_a, message__icontains="rejected").exists())

    def test_student_cannot_reject_borrow(self):
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='requested')
        self._authenticate(self.student_a)
        response = self.client.post(f"/api/borrows/reject/{borrow.id}/", {"reason": "Unauthorized"})
        self.assertEqual(response.status_code, 403)

    def test_cannot_approve_rejected_borrow(self):
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='rejected')
        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/borrows/approve/{borrow.id}/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("error"), "Borrow not in requested state")

    def test_student_can_return_own_approved_borrow(self):
        self.book_a.quantity = 2
        self.book_a.save()
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='approved')

        self._authenticate(self.student_a)
        response = self.client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        self.assertEqual(response.status_code, 200)

        borrow.refresh_from_db()
        self.assertEqual(borrow.status, 'returned')
        self.assertIsNotNone(borrow.return_date)
        self.book_a.refresh_from_db()
        self.assertEqual(self.book_a.quantity, 3)  # Incremented safely

        # Notification created
        self.assertTrue(Notification.objects.filter(user=self.student_a, message__icontains="return").exists())

    def test_librarian_can_return_department_borrow(self):
        self.book_a.quantity = 2
        self.book_a.save()
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='approved')

        self._authenticate(self.lib_a)
        response = self.client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        self.assertEqual(response.status_code, 200)

        borrow.refresh_from_db()
        self.assertEqual(borrow.status, 'returned')
        self.book_a.refresh_from_db()
        self.assertEqual(self.book_a.quantity, 3)

    def test_student_cannot_return_another_students_borrow(self):
        borrow_b = Borrow.objects.create(user=self.student_b, book=self.book_b, status='approved')

        self._authenticate(self.student_a)
        response = self.client.post("/api/borrows/return/", {"borrow_id": borrow_b.id})
        self.assertEqual(response.status_code, 404)

        borrow_b.refresh_from_db()
        self.assertEqual(borrow_b.status, 'approved')

    def test_librarian_cannot_return_another_department_borrow(self):
        borrow_b = Borrow.objects.create(user=self.student_b, book=self.book_b, status='approved')

        self._authenticate(self.lib_a)
        response = self.client.post("/api/borrows/return/", {"borrow_id": borrow_b.id})
        self.assertIn(response.status_code, [403, 404])

        borrow_b.refresh_from_db()
        self.assertEqual(borrow_b.status, 'approved')

    def test_cannot_return_already_returned_borrow(self):
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='returned')
        self._authenticate(self.student_a)
        response = self.client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("error"), "Only approved borrows can be returned")
        self.book_a.refresh_from_db()
        self.assertEqual(self.book_a.quantity, 3)  # Not incremented again

    def test_cannot_return_unapproved_requested_borrow(self):
        borrow = Borrow.objects.create(user=self.student_a, book=self.book_a, status='requested')
        self._authenticate(self.student_a)
        response = self.client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("error"), "Only approved borrows can be returned")

    def test_cannot_delete_book_with_active_borrows(self):
        Borrow.objects.create(user=self.student_a, book=self.book_a, status='approved')
        self._authenticate(self.lib_a)
        response = self.client.delete(f"/api/books/manage/{self.book_a.id}/")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Book.objects.filter(id=self.book_a.id).exists())

    def test_can_delete_book_without_active_borrows(self):
        # Book with returned borrow can be deleted
        Borrow.objects.create(user=self.student_a, book=self.book_a, status='returned')
        self._authenticate(self.lib_a)
        response = self.client.delete(f"/api/books/manage/{self.book_a.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Book.objects.filter(id=self.book_a.id).exists())

    def test_notification_list_and_mark_read(self):
        notif1 = Notification.objects.create(user=self.student_a, message="Notification 1", is_read=False)
        notif2 = Notification.objects.create(user=self.student_a, message="Notification 2", is_read=True)
        notif_b = Notification.objects.create(user=self.student_b, message="Notification B", is_read=False)

        self._authenticate(self.student_a)
        # List all
        resp = self.client.get("/api/auth/notifications/")
        self.assertEqual(resp.status_code, 200)
        ids = [n["id"] for n in resp.data]
        self.assertIn(notif1.id, ids)
        self.assertIn(notif2.id, ids)
        self.assertNotIn(notif_b.id, ids)

        # Mark read
        resp_read = self.client.post("/api/auth/notifications/mark-read/", {"notification_id": notif1.id})
        self.assertEqual(resp_read.status_code, 200)
        notif1.refresh_from_db()
        self.assertTrue(notif1.is_read)

        # Cannot mark another student's notification as read
        resp_b_read = self.client.post("/api/auth/notifications/mark-read/", {"notification_id": notif_b.id})
        self.assertEqual(resp_b_read.status_code, 404)

