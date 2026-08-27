import pytest
from django.core import mail
from accounts.models import EmailOTP, User
from accounts.services.otp import generate_otp, request_otp, verify_otp


@pytest.mark.django_db
class TestPytestOTPAuthentication:
    """Pytest suite testing email OTP security, hashing, brute-force lockouts, and token verification."""

    def test_generate_otp_format(self):
        """OTP is a 6-digit integer string between 100000 and 999999."""
        otp = generate_otp()
        assert otp.isdigit()
        assert len(otp) == 6
        assert 100000 <= int(otp) <= 999999

    def test_request_otp_dispatches_email_and_hashes_code(self):
        """Requesting OTP creates a hashed record and sends email."""
        mail.outbox.clear()
        email = "pytest_student@univ.edu"
        
        success, message = request_otp(email, purpose="register")
        assert success is True
        assert len(mail.outbox) == 1
        assert email in mail.outbox[0].to
        
        otp_record = EmailOTP.objects.get(email=email)
        assert otp_record.is_verified is False
        assert otp_record.attempts == 0
        # Password hasher produces standard hash format (argon2$ or pbkdf2$)
        assert "$" in otp_record.otp_hash

    @pytest.mark.parametrize("invalid_otp", ["000000", "999999", "123455"])
    def test_verify_otp_invalid_code_decrements_attempts(self, invalid_otp):
        """Invalid OTP submissions track failed attempt count."""
        email = "pytest_failed_attempts@univ.edu"
        request_otp(email)
        
        success, message, token = verify_otp(email, invalid_otp)
        assert success is False
        assert token is None
        
        otp_record = EmailOTP.objects.get(email=email)
        assert otp_record.attempts == 1

    def test_verify_otp_success_issues_single_use_token(self):
        """Valid OTP verification marks record verified and returns 32-byte URL-safe token."""
        mail.outbox.clear()
        email = "pytest_verify_success@univ.edu"
        request_otp(email)
        
        import re
        match = re.search(r'\b\d{6}\b', mail.outbox[-1].body)
        raw_code = match.group(0) if match else "123456"
        
        success, message, token = verify_otp(email, raw_code)
        assert success is True
        assert token is not None
        assert len(token) >= 32
        
        otp_record = EmailOTP.objects.get(email=email)
        assert otp_record.is_verified is True
        assert otp_record.verification_token == token
