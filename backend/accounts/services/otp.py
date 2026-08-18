import secrets
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.conf import settings
from accounts.models import User, EmailOTP


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP."""
    return f"{secrets.randbelow(900000) + 100000}"


def send_otp_email(email: str, otp: str) -> None:
    """Send OTP email using Django's configured EMAIL_BACKEND."""
    subject = "Your Department Library Verification Code"
    message = (
        f"Hello,\n\n"
        f"Your verification code for the Department Library System is:\n\n"
        f"    {otp}\n\n"
        f"This code will expire in 10 minutes.\n\n"
        f"Security Notice: Never share this verification code with anyone.\n\n"
        f"Best regards,\n"
        f"Department Library Team"
    )
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@library.local')
    send_mail(
        subject=subject,
        message=message,
        from_email=from_email,
        recipient_list=[email],
        fail_silently=False,
    )


def request_otp(email: str) -> tuple[bool, str]:
    """
    Request a new OTP for the given email.
    Returns (success: bool, message: str).
    """
    email = email.strip().lower()

    # Check if user already exists
    if User.objects.filter(email__iexact=email).exists():
        return False, "An account with this email already exists. Please log in instead."

    # Resend protection: 60-second cooldown
    last_otp = EmailOTP.objects.filter(email=email).order_by('-created_at').first()
    if last_otp and (timezone.now() - last_otp.created_at) < timedelta(seconds=60):
        remaining_sec = int(60 - (timezone.now() - last_otp.created_at).total_seconds())
        return False, f"Please wait {remaining_sec} seconds before requesting a new code."

    # Invalidate previous unverified OTPs for this email
    EmailOTP.objects.filter(email=email, is_verified=False).update(expires_at=timezone.now())

    # Generate and securely store hashed OTP
    raw_otp = generate_otp()
    otp_hash = make_password(raw_otp)
    expires_at = timezone.now() + timedelta(minutes=10)

    EmailOTP.objects.create(
        email=email,
        otp_hash=otp_hash,
        expires_at=expires_at,
    )

    # Send the email
    try:
        send_otp_email(email, raw_otp)
    except Exception:
        return False, "Failed to send verification email. Please try again later."

    return True, "Verification code sent to your email."


def verify_otp(email: str, otp: str) -> tuple[bool, str, str | None]:
    """
    Verify the provided OTP for the given email.
    Returns (success: bool, message: str, verification_token: str | None).
    """
    email = email.strip().lower()
    otp = str(otp).strip()

    otp_record = EmailOTP.objects.filter(email=email, is_verified=False).order_by('-created_at').first()
    if not otp_record:
        return False, "No active verification code found. Please request a new code.", None

    if otp_record.attempts >= 5:
        return False, "Too many failed attempts. Please request a new verification code.", None

    if otp_record.is_expired():
        return False, "Verification code has expired. Please request a new code.", None

    if not check_password(otp, otp_record.otp_hash):
        otp_record.attempts += 1
        if otp_record.attempts >= 5:
            otp_record.expires_at = timezone.now()
        otp_record.save()
        remaining = max(0, 5 - otp_record.attempts)
        if remaining == 0:
            return False, "Too many failed attempts. Please request a new verification code.", None
        return False, f"Invalid verification code. {remaining} attempt(s) remaining.", None

    # OTP is valid! Mark verified and issue single-use registration verification token
    verification_token = secrets.token_urlsafe(32)
    otp_record.is_verified = True
    otp_record.verified_at = timezone.now()
    otp_record.verification_token = verification_token
    otp_record.save()

    return True, "Email verified successfully.", verification_token
