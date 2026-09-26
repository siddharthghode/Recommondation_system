import logging
import secrets
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.core.cache import cache
from accounts.models import User, EmailOTP

logger = logging.getLogger(__name__)


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP."""
    return f"{secrets.randbelow(900000) + 100000}"


def get_otp(email: str, only_active: bool = False) -> EmailOTP | None:
    """
    Retrieve the most recent OTP record for the given email.
    If only_active is True, returns only unverified, non-expired OTPs with remaining attempts.
    """
    email = email.strip().lower()
    qs = EmailOTP.objects.filter(email=email).order_by('-created_at')
    if only_active:
        now = timezone.now()
        qs = qs.filter(is_verified=False, expires_at__gt=now, attempts__lt=5)
    return qs.first()


def get_otp_status(email: str) -> dict:
    """
    Retrieve structured status information about the OTP state for an email.
    Useful for checking cooldown, remaining attempts, and validity.
    """
    email = email.strip().lower()
    otp_record = EmailOTP.objects.filter(email=email).order_by('-created_at').first()
    if not otp_record:
        return {
            "has_otp": False,
            "is_active": False,
            "is_verified": False,
            "is_expired": False,
            "attempts": 0,
            "attempts_remaining": 5,
            "cooldown_remaining_seconds": 0,
            "can_resend": True,
            "message": "No OTP requested for this email."
        }

    now = timezone.now()
    is_expired = otp_record.is_expired()
    is_active = (not otp_record.is_verified) and (not is_expired) and (otp_record.attempts < 5)

    elapsed_seconds = (now - otp_record.created_at).total_seconds()
    cooldown_remaining = max(0, int(60 - elapsed_seconds))
    expires_in_seconds = max(0, int((otp_record.expires_at - now).total_seconds())) if not is_expired else 0

    return {
        "has_otp": True,
        "is_active": is_active,
        "is_verified": otp_record.is_verified,
        "is_expired": is_expired,
        "attempts": otp_record.attempts,
        "attempts_remaining": max(0, 5 - otp_record.attempts),
        "expires_in_seconds": expires_in_seconds,
        "cooldown_remaining_seconds": cooldown_remaining,
        "can_resend": cooldown_remaining == 0,
        "created_at": otp_record.created_at.isoformat() if otp_record.created_at else None,
        "verified_at": otp_record.verified_at.isoformat() if otp_record.verified_at else None,
    }


def send_otp_email(email: str, otp: str) -> None:
    """Send OTP email using Brevo HTTP API or configured EMAIL_BACKEND."""
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
    html_message = (
        f'<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">'
        f'<h2 style="color: #1e3a8a; text-align: center; margin-top: 0;">Department Library System</h2>'
        f'<p style="color: #334155; font-size: 15px;">Hello,</p>'
        f'<p style="color: #334155; font-size: 15px;">Your verification code for the Department Library System is:</p>'
        f'<div style="text-align: center; margin: 28px 0;">'
        f'<span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 12px 28px; border-radius: 6px; display: inline-block; border: 1px dashed #bfdbfe;">{otp}</span>'
        f'</div>'
        f'<p style="color: #64748b; font-size: 13px; text-align: center;">This code will expire in <strong>10 minutes</strong>.</p>'
        f'<p style="color: #dc2626; font-size: 12px; text-align: center;"><strong>Security Notice:</strong> Never share this verification code with anyone.</p>'
        f'<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />'
        f'<p style="color: #94a3b8; font-size: 12px; text-align: center; margin-bottom: 0;">Department Library Team</p>'
        f'</div>'
    )
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@library.local')
    send_mail(
        subject=subject,
        message=message,
        html_message=html_message,
        from_email=from_email,
        recipient_list=[email],
        fail_silently=False,
    )


def request_otp(email: str, purpose: str = "register") -> tuple[bool, str]:
    """
    Request a new OTP for the given email.
    Returns (success: bool, message: str).
    """
    email = email.strip().lower()

    user_exists = User.objects.filter(email__iexact=email).exists()
    if purpose == "register" and user_exists:
        # Enumeration protection: return generic confirmation without sending email
        return True, "If this email is eligible for registration, a verification code has been sent."

    if purpose == "reset" and not user_exists:
        # Enumeration protection: return generic confirmation without sending email
        return True, "If an account is associated with this email, a verification code has been sent."

    with transaction.atomic():
        # Resend protection: 60-second cooldown check against DB with row lock
        last_otp = EmailOTP.objects.select_for_update().filter(email=email).order_by('-created_at').first()
        if last_otp and (timezone.now() - last_otp.created_at) < timedelta(seconds=60):
            remaining_sec = max(1, int(60 - (timezone.now() - last_otp.created_at).total_seconds()))
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
    except Exception as e:
        logger.exception("Failed to send OTP verification email to %s: %s", email, e)
        try:
            cache.delete(cooldown_cache_key)
        except Exception:
            pass
        return False, "Failed to send verification email. Please try again later."

    return True, "Verification code sent to your email."


def verify_otp(email: str, otp: str) -> tuple[bool, str, str | None]:
    """
    Verify the provided OTP for the given email.
    Uses select_for_update() to prevent race-condition brute-forcing of attempts.
    Returns (success: bool, message: str, verification_token: str | None).
    """
    email = email.strip().lower()
    otp = str(otp).strip()

    with transaction.atomic():
        otp_record = (
            EmailOTP.objects
            .select_for_update()
            .filter(email=email, is_verified=False)
            .order_by('-created_at')
            .first()
        )
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
            otp_record.save(update_fields=['attempts', 'expires_at'])
            remaining = max(0, 5 - otp_record.attempts)
            if remaining == 0:
                return False, "Too many failed attempts. Please request a new verification code.", None
            return False, f"Invalid verification code. {remaining} attempt(s) remaining.", None

        # OTP is valid! Mark verified and issue single-use registration verification token
        verification_token = secrets.token_urlsafe(32)
        otp_record.is_verified = True
        otp_record.verified_at = timezone.now()
        otp_record.verification_token = verification_token
        otp_record.save(update_fields=['is_verified', 'verified_at', 'verification_token'])

    return True, "Email verified successfully.", verification_token
