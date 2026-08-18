from django.test import TestCase
from django.core import mail
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, UserProfile, Department, Notification, EmailOTP
from accounts.services.otp import generate_otp, request_otp, verify_otp
from django.contrib.auth.hashers import check_password


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

    def _authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def _get_verified_token(self, email):
        mail.outbox.clear()
        self.client.post("/api/auth/otp/request/", {"email": email})
        # Extract OTP from sent email
        msg = mail.outbox[-1].body
        # find the 6-digit code
        import re
        match = re.search(r'\b\d{6}\b', msg)
        raw_otp = match.group(0) if match else "123456"
        resp = self.client.post("/api/auth/otp/verify/", {"email": email, "otp": raw_otp})
        return resp.data.get("verification_token")

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

    # --- Phase 3 & 4 Student Registration & OTP Tests ---
    def test_student_registration_requires_department(self):
        token = self._get_verified_token("nodept@test.com")
        payload = {
            "username": "new_student_nodept",
            "email": "nodept@test.com",
            "password": "Password123!",
            "role": "student",
            "verification_token": token,
        }
        response = self.client.post("/api/auth/register/", payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("department", response.data)

    def test_student_registration_creates_pending_student(self):
        token = self._get_verified_token("pending@test.com")
        payload = {
            "username": "new_pending_student",
            "email": "pending@test.com",
            "password": "Password123!",
            "department": "Computer Science",
            "student_id": "CS-999",
            "verification_token": token,
        }
        response = self.client.post("/api/auth/register/", payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["role"], "student")
        self.assertEqual(response.data["approval_status"], "pending")

        user = User.objects.get(username="new_pending_student")
        self.assertEqual(user.profile.department, self.dept_a)
        self.assertEqual(user.profile.approval_status, "pending")

    def test_student_cannot_self_register_as_librarian(self):
        payload = {
            "username": "hacker_librarian",
            "email": "hacker_lib@test.com",
            "password": "Password123!",
            "role": "librarian",
            "department": "Computer Science"
        }
        response = self.client.post("/api/auth/register/", payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.data)

    def test_student_cannot_self_register_as_admin(self):
        payload = {
            "username": "hacker_admin",
            "email": "hacker_admin@test.com",
            "password": "Password123!",
            "role": "admin",
            "department": "Computer Science"
        }
        response = self.client.post("/api/auth/register/", payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.data)

    def test_pending_student_can_check_profile_and_status(self):
        pending_user = User.objects.create_user(
            username="pending_user",
            email="pending_user@test.com",
            password="Password123!",
            role="student"
        )
        pending_user.profile.department = self.dept_a
        pending_user.profile.approval_status = "pending"
        pending_user.profile.save()

        self._authenticate(pending_user)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["approval_status"], "pending")
        self.assertEqual(response.data["profile"]["approval_status"], "pending")

    def test_pending_student_cannot_self_approve_via_me_update(self):
        pending_user = User.objects.create_user(
            username="sneaky_student",
            email="sneaky@test.com",
            password="Password123!",
            role="student"
        )
        pending_user.profile.department = self.dept_a
        pending_user.profile.approval_status = "pending"
        pending_user.profile.save()

        self._authenticate(pending_user)
        response = self.client.put("/api/auth/me/", {"approval_status": "approved", "role": "admin"})
        self.assertEqual(response.status_code, 200)

        pending_user.profile.refresh_from_db()
        self.assertEqual(pending_user.profile.approval_status, "pending")

    # --- Phase 4 Email OTP Specific Tests ---
    def test_otp_generation_format_and_hashing(self):
        otp = generate_otp()
        self.assertTrue(otp.isdigit())
        self.assertEqual(len(otp), 6)

    def test_request_otp_success_and_email_dispatched(self):
        mail.outbox.clear()
        response = self.client.post("/api/auth/otp/request/", {"email": "fresh_student@test.com"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("message", response.data)
        self.assertNotIn("otp", response.data)  # Never expose OTP in response

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("fresh_student@test.com", mail.outbox[0].to)

        otp_record = EmailOTP.objects.get(email="fresh_student@test.com")
        self.assertFalse(otp_record.is_verified)
        self.assertGreater(otp_record.expires_at, timezone.now())

    def test_request_otp_for_existing_account_is_enumeration_protected(self):
        mail.outbox.clear()
        response = self.client.post("/api/auth/otp/request/", {"email": self.student_a.email})
        self.assertEqual(response.status_code, 200)
        # Should not dispatch OTP for an already registered user
        self.assertEqual(len(mail.outbox), 0)

    def test_request_otp_resend_cooldown(self):
        self.client.post("/api/auth/otp/request/", {"email": "cooldown@test.com"})
        response = self.client.post("/api/auth/otp/request/", {"email": "cooldown@test.com"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("seconds", response.data["error"])

    def test_verify_otp_incorrect_code_decrements_attempts(self):
        mail.outbox.clear()
        self.client.post("/api/auth/otp/request/", {"email": "attempt_test@test.com"})
        response = self.client.post("/api/auth/otp/verify/", {"email": "attempt_test@test.com", "otp": "000000"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("4 attempt(s) remaining", response.data["error"])

    def test_verify_otp_max_attempts_lockout(self):
        self.client.post("/api/auth/otp/request/", {"email": "lockout@test.com"})
        for _ in range(5):
            self.client.post("/api/auth/otp/verify/", {"email": "lockout@test.com", "otp": "000000"})
        
        response = self.client.post("/api/auth/otp/verify/", {"email": "lockout@test.com", "otp": "000000"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Too many failed attempts", response.data["error"])

    def test_verify_otp_expired_fails(self):
        mail.outbox.clear()
        self.client.post("/api/auth/otp/request/", {"email": "expired@test.com"})
        otp_record = EmailOTP.objects.get(email="expired@test.com")
        otp_record.expires_at = timezone.now() - timedelta(minutes=1)
        otp_record.save()

        import re
        match = re.search(r'\b\d{6}\b', mail.outbox[0].body)
        raw_otp = match.group(0)

        response = self.client.post("/api/auth/otp/verify/", {"email": "expired@test.com", "otp": raw_otp})
        self.assertEqual(response.status_code, 400)
        self.assertIn("expired", response.data["error"])

    def test_student_registration_without_verification_token_fails(self):
        payload = {
            "username": "unverified_student",
            "email": "unverified@test.com",
            "password": "Password123!",
            "department": "Computer Science",
            "student_id": "CS-unv",
        }
        response = self.client.post("/api/auth/register/", payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("verification_token", response.data)

    def test_registration_token_cannot_be_reused(self):
        token = self._get_verified_token("single_use@test.com")
        payload = {
            "username": "student_use_1",
            "email": "single_use@test.com",
            "password": "Password123!",
            "department": "Computer Science",
            "student_id": "CS-use-1",
            "verification_token": token,
        }
        res1 = self.client.post("/api/auth/register/", payload)
        self.assertEqual(res1.status_code, 201)

        # Attempt to register again with same token
        payload2 = {
            "username": "student_use_2",
            "email": "single_use_2@test.com",
            "password": "Password123!",
            "department": "Computer Science",
            "student_id": "CS-use-2",
            "verification_token": token,
        }
        res2 = self.client.post("/api/auth/register/", payload2)
        self.assertEqual(res2.status_code, 400)

    def test_existing_users_can_login_without_otp(self):
        resp_student = self.client.post("/api/auth/login/", {"username": "student_a", "password": "Password123!"})
        self.assertEqual(resp_student.status_code, 200)
        self.assertIn("access", resp_student.data)

        resp_lib = self.client.post("/api/auth/login/", {"username": "librarian_a", "password": "Password123!"})
        self.assertEqual(resp_lib.status_code, 200)
        self.assertIn("access", resp_lib.data)

        resp_admin = self.client.post("/api/auth/login/", {"username": "admin_user", "password": "AdminPassword123!"})
        self.assertEqual(resp_admin.status_code, 200)
        self.assertIn("access", resp_admin.data)

