from django.db import models
from django.conf import settings
import uuid

from accounts.models import Department

User = settings.AUTH_USER_MODEL


class Book(models.Model):
    title = models.CharField(max_length=900, db_index=True)
    subtitle = models.CharField(max_length=900, blank=True, null=True)
    authors = models.CharField(max_length=900)
    categories = models.CharField(max_length=900, blank=True, db_index=True)
    description = models.TextField(blank=True)
    published_year = models.IntegerField(null=True, blank=True)
    num_pages = models.IntegerField(null=True, blank=True)
    average_rating = models.FloatField(null=True, blank=True)
    ratings_count = models.IntegerField(null=True, blank=True)
    thumbnail = models.URLField(blank=True)
    quantity = models.IntegerField(default=0)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="books",
    )
    embedding = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        # Ensure quantity never becomes negative at application layer
        try:
            q = int(self.quantity)
        except Exception:
            q = 0
        if q < 0:
            q = 0
        self.quantity = q
        super().save(*args, **kwargs)


class BookInteraction(models.Model):
    INTERACTION_CHOICES = (
        ('view', 'View'),
        ('like', 'Like'),
        ('borrow', 'Borrow'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    interaction_type = models.CharField(
        max_length=20,
        choices=INTERACTION_CHOICES,
        default='view'  # 🔥 REQUIRED DEFAULT
    )
    created_at = models.DateTimeField(auto_now_add=True)
    session_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    sequence_order = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["user", "session_id", "sequence_order"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.book} - {self.interaction_type}"


class SearchHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    query = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user or 'anonymous'} - {self.query}"


class BookDwellTime(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    duration_seconds = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.book} - {self.duration_seconds}s"
