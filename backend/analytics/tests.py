from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, Department
from books.models import Book, BookInteraction
from borrows.models import Borrow


class AnalyticsDepartmentAuthorizationTests(TestCase):
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
        self.book_a1 = Book.objects.create(
            title="Intro to Algorithms",
            authors="Cormen",
            categories="Algorithms",
            department=self.dept_a,
            quantity=5
        )
        self.book_a2 = Book.objects.create(
            title="Operating Systems",
            authors="Silberschatz",
            categories="Systems",
            department=self.dept_a,
            quantity=0
        )
        self.book_b1 = Book.objects.create(
            title="Thermodynamics",
            authors="Sonntag",
            categories="Mechanical",
            department=self.dept_b,
            quantity=3
        )

        # Borrows
        Borrow.objects.create(user=self.student_a, book=self.book_a1, status='approved')
        Borrow.objects.create(user=self.student_b, book=self.book_b1, status='requested')

        # Interactions
        BookInteraction.objects.create(user=self.student_a, book=self.book_a1, interaction_type='view')
        BookInteraction.objects.create(user=self.student_b, book=self.book_b1, interaction_type='view')

    def _authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_librarian_a_dashboard_strictly_scoped_to_department_a(self):
        self._authenticate(self.lib_a)
        response = self.client.get("/api/analytics/librarian-dashboard/")
        self.assertEqual(response.status_code, 200)

        # Dept A has 2 books (1 in stock, 1 out of stock)
        self.assertEqual(response.data["books"]["total"], 2)
        self.assertEqual(response.data["books"]["in_stock"], 1)
        self.assertEqual(response.data["books"]["out_of_stock"], 1)

        # Dept A has 1 student
        self.assertEqual(response.data["students"], 1)

        # Dept A has 1 borrow (approved)
        self.assertEqual(response.data["borrows"]["total"], 1)
        self.assertEqual(response.data["borrows"]["approved"], 1)
        self.assertEqual(response.data["borrows"]["requested"], 0)

    def test_librarian_a_student_list_strictly_scoped(self):
        self._authenticate(self.lib_a)
        response = self.client.get("/api/analytics/students/")
        self.assertEqual(response.status_code, 200)
        student_ids = [s["id"] for s in response.data]
        self.assertIn(self.student_a.id, student_ids)
        self.assertNotIn(self.student_b.id, student_ids)

    def test_librarian_a_cannot_access_department_b_student_analytics(self):
        self._authenticate(self.lib_a)
        resp_analytics = self.client.get(f"/api/analytics/students/{self.student_b.id}/analytics/")
        self.assertEqual(resp_analytics.status_code, 403)

        resp_borrows = self.client.get(f"/api/analytics/students/{self.student_b.id}/borrows/")
        self.assertEqual(resp_borrows.status_code, 403)

        resp_rec = self.client.get(f"/api/analytics/students/{self.student_b.id}/recommendations/")
        self.assertEqual(resp_rec.status_code, 403)

    def test_admin_has_global_dashboard_and_student_access(self):
        self._authenticate(self.admin)
        response = self.client.get("/api/analytics/librarian-dashboard/")
        self.assertEqual(response.status_code, 200)
        # Global books: 3
        self.assertEqual(response.data["books"]["total"], 3)
        # Global students: 2
        self.assertEqual(response.data["students"], 2)

        # Admin can access any student's analytics
        resp_analytics = self.client.get(f"/api/analytics/students/{self.student_b.id}/analytics/")
        self.assertEqual(resp_analytics.status_code, 200)

    def test_student_cannot_access_librarian_dashboard(self):
        self._authenticate(self.student_a)
        response = self.client.get("/api/analytics/librarian-dashboard/")
        self.assertEqual(response.status_code, 403)

    # --- Phase 3 Student Approval Workflow Tests ---
    def test_librarian_a_can_view_only_department_a_pending_students(self):
        pending_a = User.objects.create_user(username="pending_cs", email="cs@test.com", password="P1", role="student")
        pending_a.profile.department = self.dept_a
        pending_a.profile.approval_status = "pending"
        pending_a.profile.save()

        pending_b = User.objects.create_user(username="pending_me", email="me@test.com", password="P2", role="student")
        pending_b.profile.department = self.dept_b
        pending_b.profile.approval_status = "pending"
        pending_b.profile.save()

        self._authenticate(self.lib_a)
        response = self.client.get("/api/analytics/students/pending/")
        self.assertEqual(response.status_code, 200)
        pending_ids = [s["id"] for s in response.data]
        self.assertIn(pending_a.id, pending_ids)
        self.assertNotIn(pending_b.id, pending_ids)

    def test_librarian_a_can_approve_department_a_student(self):
        pending_a = User.objects.create_user(username="pending_cs_2", email="cs2@test.com", password="P1", role="student")
        pending_a.profile.department = self.dept_a
        pending_a.profile.approval_status = "pending"
        pending_a.profile.save()

        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/analytics/students/{pending_a.id}/approve/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["approval_status"], "approved")

        pending_a.profile.refresh_from_db()
        self.assertEqual(pending_a.profile.approval_status, "approved")

    def test_librarian_a_cannot_approve_department_b_student(self):
        pending_b = User.objects.create_user(username="pending_me_2", email="me2@test.com", password="P2", role="student")
        pending_b.profile.department = self.dept_b
        pending_b.profile.approval_status = "pending"
        pending_b.profile.save()

        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/analytics/students/{pending_b.id}/approve/")
        self.assertEqual(response.status_code, 403)

        pending_b.profile.refresh_from_db()
        self.assertEqual(pending_b.profile.approval_status, "pending")

    def test_librarian_a_can_reject_department_a_student(self):
        pending_a = User.objects.create_user(username="pending_cs_rej", email="csrej@test.com", password="P1", role="student")
        pending_a.profile.department = self.dept_a
        pending_a.profile.approval_status = "pending"
        pending_a.profile.save()

        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/analytics/students/{pending_a.id}/reject/", {"reason": "Incomplete profile"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["approval_status"], "rejected")

        pending_a.profile.refresh_from_db()
        self.assertEqual(pending_a.profile.approval_status, "rejected")

    def test_librarian_a_cannot_reject_department_b_student(self):
        pending_b = User.objects.create_user(username="pending_me_rej", email="merej@test.com", password="P2", role="student")
        pending_b.profile.department = self.dept_b
        pending_b.profile.approval_status = "pending"
        pending_b.profile.save()

        self._authenticate(self.lib_a)
        response = self.client.post(f"/api/analytics/students/{pending_b.id}/reject/")
        self.assertEqual(response.status_code, 403)

        pending_b.profile.refresh_from_db()
        self.assertEqual(pending_b.profile.approval_status, "pending")

    def test_scenario_a_student_registration_and_cs_librarian_approval(self):
        # Scenario A: Student registers in CS -> CS librarian sees and approves -> status becomes approved
        cs_student = User.objects.create_user(username="new_cs_student", email="new_cs@test.com", password="P1", role="student")
        cs_student.profile.department = self.dept_a
        cs_student.profile.approval_status = "pending"
        cs_student.profile.save()

        # CS Librarian sees student in pending
        self._authenticate(self.lib_a)
        res_pending = self.client.get("/api/analytics/students/pending/")
        self.assertEqual(res_pending.status_code, 200)
        ids = [s["id"] for s in res_pending.data]
        self.assertIn(cs_student.id, ids)

        # CS Librarian approves student
        res_app = self.client.post(f"/api/analytics/students/{cs_student.id}/approve/")
        self.assertEqual(res_app.status_code, 200)
        self.assertEqual(res_app.data["approval_status"], "approved")

        cs_student.profile.refresh_from_db()
        self.assertEqual(cs_student.profile.approval_status, "approved")

    def test_scenario_b_different_department_librarian_cannot_see_or_approve(self):
        # Scenario B: Student in CS -> Mechanical Librarian cannot see or approve
        cs_student = User.objects.create_user(username="cs_student_iso", email="cs_iso@test.com", password="P1", role="student")
        cs_student.profile.department = self.dept_a
        cs_student.profile.approval_status = "pending"
        cs_student.profile.save()

        # Mech Librarian (lib_b) tries to list pending
        self._authenticate(self.lib_b)
        res_pending = self.client.get("/api/analytics/students/pending/")
        self.assertEqual(res_pending.status_code, 200)
        ids = [s["id"] for s in res_pending.data]
        self.assertNotIn(cs_student.id, ids)

        # Mech Librarian tries to approve CS student
        res_app = self.client.post(f"/api/analytics/students/{cs_student.id}/approve/")
        self.assertEqual(res_app.status_code, 403)

        # Status remains pending
        cs_student.profile.refresh_from_db()
        self.assertEqual(cs_student.profile.approval_status, "pending")
