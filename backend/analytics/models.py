from django.db import models
from accounts.models import Department


class AnalyticsSnapshot(models.Model):
    snapshot_date = models.DateField(db_index=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="analytics_snapshots",
    )

    total_books = models.PositiveIntegerField(default=0)
    in_stock_books = models.PositiveIntegerField(default=0)
    out_of_stock_books = models.PositiveIntegerField(default=0)
    students_count = models.PositiveIntegerField(default=0)
    total_borrows = models.PositiveIntegerField(default=0)
    requested_borrows = models.PositiveIntegerField(default=0)
    approved_borrows = models.PositiveIntegerField(default=0)
    returned_borrows = models.PositiveIntegerField(default=0)
    active_students_total = models.PositiveIntegerField(default=0)
    active_students_30d = models.PositiveIntegerField(default=0)

    top_categories = models.JSONField(default=list, blank=True)
    borrow_trends = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["snapshot_date", "department"],
                name="uniq_analytics_snapshot_date_department",
            )
        ]

    def __str__(self):
        scope = self.department.name if self.department else "global"
        return f"{scope} snapshot @ {self.snapshot_date}"
