from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

# --------------------
# Department
# --------------------
class Department(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.name



# --------------------
# Custom User
# --------------------
class User(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('librarian', 'Librarian'),
        ('admin', 'Admin'),
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='student'
    )

    # Librarian belongs to one department
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    def save(self, *args, **kwargs):
        if self.is_superuser and self.role == 'student':
            self.role = 'admin'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"


# --------------------
# User Profile (Student)
# --------------------
class UserProfile(models.Model):
    APPROVAL_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )

    student_id = models.CharField(max_length=50, unique=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    year = models.IntegerField(null=True, blank=True)
    preferred_categories = models.TextField(blank=True)
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_CHOICES,
        default='pending'
    )

    def __str__(self):
        return f"Profile of {self.user.username} ({self.approval_status})"


# --------------------
# Notification
# --------------------
class Notification(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.username}: {self.message[:50]}"


# --------------------
# Email OTP Verification
# --------------------
class EmailOTP(models.Model):
    email = models.EmailField(db_index=True)
    otp_hash = models.CharField(max_length=128)
    attempts = models.IntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=64, blank=True, null=True, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f"OTP for {self.email} (verified={self.is_verified})"
