"""
P0 Adversarial Audit Tests — Authentication, Authorization, OTP, Password Reset.

Findings targeted:
  DEFECT-01: PasswordResetView does not bind token to email — cross-account password reset.
  DEFECT-02: Approved student can change own department via PUT /api/auth/me/.
  GAP-01:    Librarian from another dept cannot approve/reject students cross-dept.
  GAP-02:    OTP replay after successful verification (true same-email replay).
  GAP-03:    Password reset token reuse after successful reset.
  GAP-04:    Unauthenticated access to protected endpoints returns 401.
  GAP-05:    JWT with tampered payload is rejected.
"""
import re
import pytest
from django.core import mail
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, Department, EmailOTP
from accounts.services.otp import request_otp, verify_otp


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _jwt_headers(user):
    refresh = RefreshToken.for_user(user)
    return {"HTTP_AUTHORIZATION": f"Bearer {refresh.access_token}"}


def _request_and_verify_otp(email):
    """Request OTP, extract from outbox, verify, return token."""
    mail.outbox.clear()
    request_otp(email, purpose="register")
    body = mail.outbox[-1].body
    code = re.search(r"\b\d{6}\b", body).group(0)
    _, _, token = verify_otp(email, code)
    return token


def _make_student(username, email, dept, status="pending"):
    user = User.objects.create_user(
        username=username, email=email,
        password="Pass1234!", role="student"
    )
    p = user.profile
    p.department = dept
    p.approval_status = status
    p.student_id = username
    p.save()
    return user


def _make_librarian(username, email, dept):
    return User.objects.create_user(
        username=username, email=email,
        password="Pass1234!", role="librarian",
        department=dept
    )


# ---------------------------------------------------------------------------
# DEFECT-01: Cross-account password reset via token/email mismatch
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestPasswordResetCrossAccount:
    """
    PasswordResetView looks up the user by the *email* field in the POST body,
    not by the email bound to the OTP record.  An attacker who owns email B
    can obtain a valid verification_token for email B, then POST with
    email=victim@A and token=<their own token> to reset victim A's password.
    """

    def test_token_from_email_b_cannot_reset_email_a_password(self):
        client = APIClient()
        dept = Department.objects.create(name="Audit-Dept-PW")

        victim = User.objects.create_user(
            username="victim_user", email="victim@audit.edu",
            password="OriginalPass1!", role="librarian", department=dept
        )

        # Attacker owns attacker@audit.edu and gets a valid reset token for it
        attacker_email = "attacker@audit.edu"
        User.objects.create_user(
            username="attacker_user", email=attacker_email,
            password="AttackerPass1!", role="librarian", department=dept
        )
        mail.outbox.clear()
        request_otp(attacker_email, purpose="reset")
        body = mail.outbox[-1].body
        code = re.search(r"\b\d{6}\b", body).group(0)
        _, _, attacker_token = verify_otp(attacker_email, code)
        assert attacker_token is not None

        # Attacker submits victim's email with their own token
        resp = client.post("/api/auth/password-reset/", {
            "email": "victim@audit.edu",
            "verification_token": attacker_token,
            "new_password": "Hacked123!",
            "new_password_confirm": "Hacked123!",
        })

        # Must be rejected — token is not bound to victim's email
        assert resp.status_code in (400, 403), (
            f"DEFECT-01: Cross-account reset succeeded with status {resp.status_code}"
        )

        # Victim's password must be unchanged
        victim.refresh_from_db()
        assert victim.check_password("OriginalPass1!"), (
            "DEFECT-01: Victim password was changed by attacker's token"
        )

    def test_password_reset_token_invalidated_after_use(self):
        """Token must not be reusable after a successful password reset."""
        client = APIClient()
        dept = Department.objects.create(name="Audit-Dept-PW2")
        user = User.objects.create_user(
            username="reset_user2", email="reset2@audit.edu",
            password="OldPass1!", role="librarian", department=dept
        )
        mail.outbox.clear()
        request_otp("reset2@audit.edu", purpose="reset")
        body = mail.outbox[-1].body
        code = re.search(r"\b\d{6}\b", body).group(0)
        _, _, token = verify_otp("reset2@audit.edu", code)

        # First reset succeeds
        r1 = client.post("/api/auth/password-reset/", {
            "email": "reset2@audit.edu",
            "verification_token": token,
            "new_password": "NewPass1!",
            "new_password_confirm": "NewPass1!",
        })
        assert r1.status_code == 200

        # Second reset with same token must fail
        r2 = client.post("/api/auth/password-reset/", {
            "email": "reset2@audit.edu",
            "verification_token": token,
            "new_password": "AnotherPass1!",
            "new_password_confirm": "AnotherPass1!",
        })
        assert r2.status_code in (400, 403), (
            f"GAP: Password reset token reused, status={r2.status_code}"
        )

    def test_expired_reset_session_rejected(self):
        """Verified OTP older than 30 minutes must not allow password reset."""
        client = APIClient()
        dept = Department.objects.create(name="Audit-Dept-PW3")
        User.objects.create_user(
            username="expired_reset_user", email="expired_reset@audit.edu",
            password="OldPass1!", role="librarian", department=dept
        )
        mail.outbox.clear()
        request_otp("expired_reset@audit.edu", purpose="reset")
        body = mail.outbox[-1].body
        code = re.search(r"\b\d{6}\b", body).group(0)
        _, _, token = verify_otp("expired_reset@audit.edu", code)

        # Backdate verified_at to 31 minutes ago
        otp_record = EmailOTP.objects.get(
            email="expired_reset@audit.edu",
            verification_token=token
        )
        otp_record.verified_at = timezone.now() - timedelta(minutes=31)
        otp_record.save()

        resp = client.post("/api/auth/password-reset/", {
            "email": "expired_reset@audit.edu",
            "verification_token": token,
            "new_password": "NewPass1!",
            "new_password_confirm": "NewPass1!",
        })
        assert resp.status_code in (400, 403)


# ---------------------------------------------------------------------------
# DEFECT-02: Approved student changing own department via PUT /api/auth/me/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestMeViewDepartmentEscalation:

    def test_approved_student_cannot_change_own_department(self):
        """
        An approved student must not be able to reassign themselves to a
        different department by PUTting a new department name to /api/auth/me/.
        The view allows department changes only for pending students or staff.
        """
        client = APIClient()
        cs = Department.objects.create(name="CS-Audit")
        mech = Department.objects.create(name="Mech-Audit")
        student = _make_student("approved_s1", "approved_s1@audit.edu", cs, "approved")

        client.credentials(**_jwt_headers(student))
        resp = client.put("/api/auth/me/", {"department": "Mech-Audit"})
        assert resp.status_code == 200

        student.profile.refresh_from_db()
        assert student.profile.department == cs, (
            "DEFECT-02: Approved student changed their own department"
        )

    def test_pending_student_can_change_department_before_approval(self):
        """Pending students are allowed to update department (pre-approval)."""
        client = APIClient()
        cs = Department.objects.create(name="CS-Audit2")
        Department.objects.create(name="Mech-Audit2")
        student = _make_student("pending_s1", "pending_s1@audit.edu", cs, "pending")

        client.credentials(**_jwt_headers(student))
        resp = client.put("/api/auth/me/", {"department": "Mech-Audit2"})
        assert resp.status_code == 200
        # Pending students may change dept — this is expected behavior

    def test_student_cannot_escalate_role_via_me(self):
        """PUT /api/auth/me/ must not allow role escalation."""
        client = APIClient()
        cs = Department.objects.create(name="CS-Audit3")
        student = _make_student("role_esc_s", "role_esc@audit.edu", cs, "approved")

        client.credentials(**_jwt_headers(student))
        resp = client.put("/api/auth/me/", {"role": "admin"})
        assert resp.status_code == 200

        student.refresh_from_db()
        assert student.role == "student", (
            "Student escalated role to admin via /api/auth/me/"
        )

    def test_student_cannot_set_approval_status_via_me(self):
        """PUT /api/auth/me/ must not allow self-approval."""
        client = APIClient()
        cs = Department.objects.create(name="CS-Audit4")
        student = _make_student("self_approve_s", "self_approve@audit.edu", cs, "pending")

        client.credentials(**_jwt_headers(student))
        resp = client.put("/api/auth/me/", {"approval_status": "approved"})
        assert resp.status_code == 200

        student.profile.refresh_from_db()
        assert student.profile.approval_status == "pending"


# ---------------------------------------------------------------------------
# GAP-01: Cross-department student approval/rejection
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCrossDeptStudentApproval:

    def setup_method(self):
        self.client = APIClient()
        self.cs = Department.objects.create(name="CS-Appr")
        self.mech = Department.objects.create(name="Mech-Appr")
        self.cs_lib = _make_librarian("lib_cs_appr", "lib_cs_appr@audit.edu", self.cs)
        self.mech_lib = _make_librarian("lib_mech_appr", "lib_mech_appr@audit.edu", self.mech)
        self.cs_student = _make_student("cs_pend_appr", "cs_pend_appr@audit.edu", self.cs, "pending")

    def test_mech_librarian_cannot_approve_cs_student(self):
        self.client.credentials(**_jwt_headers(self.mech_lib))
        resp = self.client.post(f"/api/analytics/students/{self.cs_student.id}/approve/")
        assert resp.status_code == 403
        self.cs_student.profile.refresh_from_db()
        assert self.cs_student.profile.approval_status == "pending"

    def test_mech_librarian_cannot_reject_cs_student(self):
        self.client.credentials(**_jwt_headers(self.mech_lib))
        resp = self.client.post(
            f"/api/analytics/students/{self.cs_student.id}/reject/",
            {"reason": "unauthorized"}
        )
        assert resp.status_code == 403
        self.cs_student.profile.refresh_from_db()
        assert self.cs_student.profile.approval_status == "pending"

    def test_student_cannot_approve_another_student(self):
        other = _make_student("other_pend", "other_pend@audit.edu", self.cs, "pending")
        self.client.credentials(**_jwt_headers(self.cs_student))
        resp = self.client.post(f"/api/analytics/students/{other.id}/approve/")
        assert resp.status_code == 403

    def test_cs_librarian_can_approve_own_dept_student(self):
        self.client.credentials(**_jwt_headers(self.cs_lib))
        resp = self.client.post(f"/api/analytics/students/{self.cs_student.id}/approve/")
        assert resp.status_code == 200
        self.cs_student.profile.refresh_from_db()
        assert self.cs_student.profile.approval_status == "approved"


# ---------------------------------------------------------------------------
# GAP-02: OTP replay after successful verification (same email)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestOTPReplay:

    def test_otp_cannot_be_verified_twice(self):
        """After a successful verify_otp call, the same code must not verify again."""
        email = "otp_replay@audit.edu"
        mail.outbox.clear()
        request_otp(email, purpose="register")
        body = mail.outbox[-1].body
        code = re.search(r"\b\d{6}\b", body).group(0)

        ok1, _, token1 = verify_otp(email, code)
        assert ok1 is True
        assert token1 is not None

        # Replay the same OTP code
        ok2, msg2, token2 = verify_otp(email, code)
        assert ok2 is False, "OTP replay succeeded — same code verified twice"
        assert token2 is None

    def test_verification_token_cannot_register_twice(self):
        """A consumed verification_token must not allow a second registration."""
        client = APIClient()
        cs = Department.objects.create(name="CS-Replay")
        email = "replay_reg@audit.edu"
        token = _request_and_verify_otp(email)

        payload = {
            "username": "replay_reg1",
            "email": email,
            "password": "Pass1234!",
            "password_confirm": "Pass1234!",
            "department": cs.id,
            "student_id": "CS-R1",
            "verification_token": token,
        }
        r1 = client.post("/api/auth/register/", payload)
        assert r1.status_code == 201

        payload["username"] = "replay_reg2"
        payload["email"] = "replay_reg2@audit.edu"
        r2 = client.post("/api/auth/register/", payload)
        assert r2.status_code == 400
        assert "verification_token" in r2.data


# ---------------------------------------------------------------------------
# GAP-03: Unauthenticated access to protected endpoints
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestUnauthenticatedAccess:

    PROTECTED_ENDPOINTS = [
        ("GET", "/api/auth/me/"),
        ("GET", "/api/auth/notifications/"),
        ("POST", "/api/borrows/request/"),
        ("GET", "/api/borrows/my/"),
        ("GET", "/api/borrows/pending/"),
        ("GET", "/api/analytics/librarian-dashboard/"),
        ("GET", "/api/analytics/students/"),
        ("GET", "/api/books/recommendations/"),
    ]

    @pytest.mark.parametrize("method,url", PROTECTED_ENDPOINTS)
    def test_unauthenticated_returns_401(self, method, url):
        client = APIClient()
        fn = getattr(client, method.lower())
        resp = fn(url)
        assert resp.status_code == 401, (
            f"Endpoint {method} {url} returned {resp.status_code} without auth"
        )


# ---------------------------------------------------------------------------
# GAP-04: Tampered / malformed JWT rejected
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestJWTSecurity:

    def test_tampered_jwt_rejected(self):
        client = APIClient()
        cs = Department.objects.create(name="CS-JWT")
        user = _make_librarian("jwt_lib", "jwt_lib@audit.edu", cs)
        refresh = RefreshToken.for_user(user)
        token_str = str(refresh.access_token)

        # Corrupt the signature segment
        parts = token_str.split(".")
        parts[2] = parts[2][:-4] + "XXXX"
        bad_token = ".".join(parts)

        client.credentials(HTTP_AUTHORIZATION=f"Bearer {bad_token}")
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 401

    def test_missing_bearer_prefix_rejected(self):
        client = APIClient()
        cs = Department.objects.create(name="CS-JWT2")
        user = _make_librarian("jwt_lib2", "jwt_lib2@audit.edu", cs)
        refresh = RefreshToken.for_user(user)
        token_str = str(refresh.access_token)

        client.credentials(HTTP_AUTHORIZATION=token_str)
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 401

    def test_expired_access_token_rejected(self):
        """Manually backdate a token's exp claim — Django SimpleJWT must reject it."""
        import time
        from rest_framework_simplejwt.tokens import AccessToken
        client = APIClient()
        cs = Department.objects.create(name="CS-JWT3")
        user = _make_librarian("jwt_lib3", "jwt_lib3@audit.edu", cs)

        token = AccessToken.for_user(user)
        # Set expiry to the past
        token.set_exp(lifetime=timedelta(seconds=-1))
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GAP-05: Department isolation — query param bypass attempt
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDepartmentQueryParamIsolation:

    def test_approved_student_cannot_see_other_dept_books_via_dept_param(self):
        """
        An approved CS student passing ?department=<mech_id> must never receive
        Mechanical books — the view enforces department from the user's profile,
        not from the query parameter.
        Security invariant: cross-dept books must be absent regardless of param.
        """
        from books.models import Book
        client = APIClient()
        cs = Department.objects.create(name="CS-Iso")
        mech = Department.objects.create(name="Mech-Iso")
        cs_student = _make_student("cs_iso_s", "cs_iso@audit.edu", cs, "approved")

        Book.objects.create(
            title="Mech Book Iso", authors="A", department=mech, quantity=1
        )
        Book.objects.create(
            title="CS Book Iso", authors="B", department=cs, quantity=1
        )

        client.credentials(**_jwt_headers(cs_student))
        # Attempt to bypass isolation by passing the mech dept id as a query param
        resp = client.get(f"/api/books/?department={mech.id}")
        assert resp.status_code == 200

        titles = [b["title"] for b in resp.data.get("results", resp.data)]
        assert "Mech Book Iso" not in titles, (
            "SECURITY: CS student received Mech books via ?department= param bypass"
        )
        # Also verify without the param — CS books are visible normally
        resp2 = client.get("/api/books/")
        titles2 = [b["title"] for b in resp2.data.get("results", resp2.data)]
        assert "CS Book Iso" in titles2, "CS student cannot see own dept books"
        assert "Mech Book Iso" not in titles2

    def test_pending_student_receives_empty_catalog(self):
        """Pending students must receive an empty book list."""
        from books.models import Book
        client = APIClient()
        cs = Department.objects.create(name="CS-Pend-Iso")
        student = _make_student("pend_iso_s", "pend_iso@audit.edu", cs, "pending")
        Book.objects.create(title="CS Pend Book", authors="A", department=cs, quantity=1)

        client.credentials(**_jwt_headers(student))
        resp = client.get("/api/books/")
        assert resp.status_code == 200
        results = resp.data.get("results", resp.data)
        assert len(results) == 0, "Pending student received books"
