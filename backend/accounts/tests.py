from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, UserProfile, Department, Notification


class AccountsDepartmentAuthorizationTests(TestCase):
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

    def _authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_student_me_profile_shows_correct_department(self):
        self._authenticate(self.student_a)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "student")
        self.assertEqual(response.data["profile"]["department"], "Computer Science")

    def test_librarian_me_profile_shows_correct_department(self):
        self._authenticate(self.lib_a)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "librarian")
        self.assertEqual(response.data["department"], "Computer Science")

    def test_notifications_isolation(self):
        notif_a = Notification.objects.create(user=self.student_a, message="Message for Student A")
        notif_b = Notification.objects.create(user=self.student_b, message="Message for Student B")

        self._authenticate(self.student_a)
        response = self.client.get("/api/auth/notifications/")
        self.assertEqual(response.status_code, 200)
        notif_ids = [n["id"] for n in response.data]
        self.assertIn(notif_a.id, notif_ids)
        self.assertNotIn(notif_b.id, notif_ids)

        # Student A cannot mark Student B's notification as read
        resp_mark = self.client.post("/api/auth/notifications/mark-read/", {"notification_id": notif_b.id})
        self.assertEqual(resp_mark.status_code, 404)
