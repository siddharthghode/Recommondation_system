from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, Department
from books.models import Book
from borrows.models import Borrow


class BorrowsDepartmentAuthorizationTests(TestCase):
    def setUp(self):
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
