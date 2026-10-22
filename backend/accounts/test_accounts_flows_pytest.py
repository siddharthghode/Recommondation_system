import json
from datetime import timedelta

import pytest
from books.cache_utils import recommendation_key, safe_cache_get, safe_cache_set
from django.utils import timezone

from accounts.models import EmailOTP, Notification, User
from accounts.services.otp import request_otp, verify_otp


@pytest.mark.django_db
class TestPasswordResetFlow:
    """
    Integration tests verifying password reset workflows:
    - Token generation and verification
    - Validation constraints (matching passwords, minimum length)
    - Invalidation of token after consumption to prevent replay attacks
    """

    def test_password_reset_successful(self, api_client, cs_dept):
        """User resets password with a valid, verified OTP token."""
        user = User.objects.create_user(
            username="reset_user",
            email="reset_user@univ.edu",
            password="OldPassword123!",
            role="student",
            department=cs_dept
        )

        # 1. Request and verify OTP for reset
        import re

        from django.core import mail
        mail.outbox.clear()
        success, _ = request_otp(user.email, purpose="reset")
        assert success is True
        assert len(mail.outbox) == 1

        match = re.search(r'\b\d{6}\b', mail.outbox[-1].body)
        raw_code = match.group(0) if match else "123456"

        _, _, token = verify_otp(user.email, raw_code)
        assert token is not None

        # 2. Submit password reset
        reset_payload = {
            "email": user.email,
            "verification_token": token,
            "new_password": "NewSecurePassword456!",
            "new_password_confirm": "NewSecurePassword456!"
        }
        resp = api_client.post('/api/auth/password-reset/', reset_payload, format='json')
        assert resp.status_code == 200
        assert "Password has been reset successfully" in resp.data["message"]

        # 3. Verify user can authenticate with new password
        login_resp = api_client.post('/api/auth/login/', {
            "username": user.username,
            "password": "NewSecurePassword456!"
        }, format='json')
        assert login_resp.status_code == 200
        assert "access" in login_resp.data

        # 4. Invariant: token cannot be reused (replay prevention)
        replay_resp = api_client.post('/api/auth/password-reset/', reset_payload, format='json')
        assert replay_resp.status_code == 400
        assert "Invalid or expired verification session" in str(replay_resp.data)

    def test_password_reset_mismatched_passwords(self, api_client, cs_dept):
        """Reset request with non-matching passwords returns 400."""
        user = User.objects.create_user(
            username="mismatch_user",
            email="mismatch@univ.edu",
            password="OldPassword123!",
            role="student"
        )
        payload = {
            "email": user.email,
            "verification_token": "dummy_token",
            "new_password": "Password123!",
            "new_password_confirm": "DifferentPassword456!"
        }
        resp = api_client.post('/api/auth/password-reset/', payload, format='json')
        assert resp.status_code == 400
        assert "Passwords do not match" in resp.data["error"]

    def test_password_reset_password_too_short(self, api_client, cs_dept):
        """Password shorter than 4 characters returns 400."""
        payload = {
            "email": "any@univ.edu",
            "verification_token": "dummy_token",
            "new_password": "123",
            "new_password_confirm": "123"
        }
        resp = api_client.post('/api/auth/password-reset/', payload, format='json')
        assert resp.status_code == 400
        assert "Password must be at least 4 characters" in resp.data["error"]

    def test_password_reset_missing_fields(self, api_client):
        """Missing required fields returns 400."""
        resp = api_client.post('/api/auth/password-reset/', {}, format='json')
        assert resp.status_code == 400
        assert "Email, verification token, and new password are required" in resp.data["error"]

    def test_password_reset_nonexistent_account(self, api_client):
        """Non-existent email with a fake verified token returns 404."""
        now = timezone.now()
        EmailOTP.objects.create(
            email="ghost@univ.edu",
            otp_hash="hash",
            is_verified=True,
            verified_at=now,
            verification_token="valid_looking_token_1234567890",
            expires_at=now + timedelta(minutes=10)
        )
        payload = {
            "email": "ghost@univ.edu",
            "verification_token": "valid_looking_token_1234567890",
            "new_password": "NewPassword123!",
            "new_password_confirm": "NewPassword123!"
        }
        resp = api_client.post('/api/auth/password-reset/', payload, format='json')
        assert resp.status_code == 404
        assert "Account not found" in resp.data["error"]


@pytest.mark.django_db
class TestGoogleOAuthAuthentication:
    """
    Contract & boundary tests for Google OAuth:
    Uses a Stub HTTP response double to test Google userinfo decoding, audience
    validation, student profile auto-provisioning, and token issuance.
    """

    def test_google_auth_missing_token(self, api_client):
        """Request without token returns 400."""
        resp = api_client.post('/api/auth/google/', {}, format='json')
        assert resp.status_code == 400
        assert "Google credential or token is required" in resp.data["error"]

    def test_google_auth_audience_mismatch(self, api_client, monkeypatch, settings):
        """Token with mismatched client_id audience is rejected with 400."""
        settings.GOOGLE_CLIENT_ID = "expected-library-client-id.apps.googleusercontent.com"

        mock_payload = {
            "email": "hacker@univ.edu",
            "aud": "rogue-client-id.apps.googleusercontent.com",
            "given_name": "Rogue",
            "family_name": "User"
        }

        class MockResponse:
            status = 200
            def read(self):
                return json.dumps(mock_payload).encode('utf-8')
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        monkeypatch.setattr('urllib.request.urlopen', lambda req, timeout=10: MockResponse())

        resp = api_client.post('/api/auth/google/', {"credential": "fake_google_jwt"}, format='json')
        assert resp.status_code == 400
        assert "audience mismatch" in resp.data["error"]

    def test_google_auth_successful_new_student_provisioning(self, api_client, monkeypatch, settings, cs_dept):
        """New student registering via Google OAuth gets created as pending student with unusable password."""
        settings.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com"

        google_user_data = {
            "email": "new_google_student@univ.edu",
            "aud": "test-client-id.apps.googleusercontent.com",
            "given_name": "Ada",
            "family_name": "Lovelace"
        }

        class MockResponse:
            status = 200
            def read(self):
                return json.dumps(google_user_data).encode('utf-8')
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        monkeypatch.setattr('urllib.request.urlopen', lambda req, timeout=10: MockResponse())

        payload = {
            "credential": "valid_google_token",
            "department": cs_dept.name,
            "year": 2
        }
        resp = api_client.post('/api/auth/google/', payload, format='json')
        assert resp.status_code == 200
        assert "access" in resp.data
        assert "refresh" in resp.data
        assert resp.data["role"] == "student"
        assert resp.data["approval_status"] == "pending"

        # Verify database record
        created_user = User.objects.get(email="new_google_student@univ.edu")
        assert created_user.first_name == "Ada"
        assert created_user.last_name == "Lovelace"
        assert not created_user.has_usable_password()
        assert created_user.profile.approval_status == "pending"
        assert created_user.profile.department == cs_dept
        assert created_user.profile.year == 2


@pytest.mark.django_db
class TestMeViewAndProfilePermissions:
    """
    Tests for /api/auth/me/ profile management and permission barriers:
    - Pending student can update department
    - Approved student cannot self-change department
    - Updating profile invalidates recommendation cache
    """

    def test_pending_student_can_update_department(self, api_client, auth_headers, pending_cs_student, mech_dept):
        """Pending students are permitted to correct their department prior to approval."""
        client = api_client
        headers = auth_headers(pending_cs_student)

        resp = client.put('/api/auth/me/', {
            "department": mech_dept.name
        }, format='json', **headers)

        assert resp.status_code == 200
        pending_cs_student.refresh_from_db()
        assert pending_cs_student.department == mech_dept
        assert pending_cs_student.profile.department == mech_dept

    def test_approved_student_cannot_change_department(self, api_client, auth_headers, approved_cs_student, cs_dept, mech_dept):
        """Approved student cannot change their assigned department to bypass isolation."""
        client = api_client
        headers = auth_headers(approved_cs_student)

        resp = client.put('/api/auth/me/', {
            "department": mech_dept.name
        }, format='json', **headers)

        assert resp.status_code == 200
        approved_cs_student.refresh_from_db()
        # Invariant: department remains Computer Science
        assert approved_cs_student.department == cs_dept
        assert approved_cs_student.profile.department == cs_dept

    def test_profile_update_invalidates_recommendation_cache(self, api_client, auth_headers, approved_cs_student, cs_dept):
        """Updating preferred categories flushes cached recommendations."""
        client = api_client
        headers = auth_headers(approved_cs_student)

        cache_key = recommendation_key("content", approved_cs_student.id, cs_dept.id, 6)
        safe_cache_set(cache_key, [999, 1000], timeout=3600)
        assert safe_cache_get(cache_key) == [999, 1000]

        # Update categories
        resp = client.put('/api/auth/me/', {
            "preferred_categories": "Robotics, Machine Learning"
        }, format='json', **headers)
        assert resp.status_code == 200

        # Cached recommendations must now be evicted
        assert safe_cache_get(cache_key) is None


@pytest.mark.django_db
class TestNotificationAPIAndUserIsolation:
    """
    Tests for Notification management:
    - List filtering (is_read=true/false)
    - Mark read permissions (cannot mark another user's notification)
    - Mark all read
    """

    def test_notification_list_filtering(self, api_client, auth_headers, approved_cs_student):
        """Notification list filters accurately by is_read query param."""
        client = api_client
        headers = auth_headers(approved_cs_student)

        n1 = Notification.objects.create(user=approved_cs_student, title="N1", message="M1", is_read=False)
        n2 = Notification.objects.create(user=approved_cs_student, title="N2", message="M2", is_read=True)

        # Unfiltered: both returned
        r_all = client.get('/api/auth/notifications/', **headers)
        assert len(r_all.data) == 2

        # Filter unread
        r_unread = client.get('/api/auth/notifications/?is_read=false', **headers)
        assert len(r_unread.data) == 1
        assert r_unread.data[0]["id"] == n1.id

        # Filter read
        r_read = client.get('/api/auth/notifications/?is_read=true', **headers)
        assert len(r_read.data) == 1
        assert r_read.data[0]["id"] == n2.id

    def test_user_cannot_mark_another_users_notification_as_read(self, api_client, auth_headers, approved_cs_student, approved_mech_student):
        """User A attempting to mark User B's notification read receives 404."""
        n_mech = Notification.objects.create(user=approved_mech_student, title="Mech Note", message="M", is_read=False)

        client = api_client
        headers_cs = auth_headers(approved_cs_student)

        resp = client.post('/api/auth/notifications/mark-read/', {"notification_id": n_mech.id}, format='json', **headers_cs)
        assert resp.status_code == 404
        assert "Notification not found" in resp.data["error"]
        n_mech.refresh_from_db()
        assert n_mech.is_read is False

    def test_mark_all_notifications_read(self, api_client, auth_headers, approved_cs_student):
        """Mark all notifications read affects only the authenticated user."""
        Notification.objects.create(user=approved_cs_student, title="N1", message="M1", is_read=False)
        Notification.objects.create(user=approved_cs_student, title="N2", message="M2", is_read=False)

        client = api_client
        headers = auth_headers(approved_cs_student)

        resp = client.post('/api/auth/notifications/mark-all-read/', {}, **headers)
        assert resp.status_code == 200
        assert Notification.objects.filter(user=approved_cs_student, is_read=False).count() == 0
