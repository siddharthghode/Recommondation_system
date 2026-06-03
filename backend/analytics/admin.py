from django.contrib import admin
from .models import AnalyticsSnapshot


@admin.register(AnalyticsSnapshot)
class AnalyticsSnapshotAdmin(admin.ModelAdmin):
    list_display = ('snapshot_date', 'department', 'total_books', 'total_borrows', 'students_count', 'active_students_30d')
    list_filter = ('department', 'snapshot_date')
    readonly_fields = ('created_at',)
    list_select_related = ('department',)
    ordering = ('-snapshot_date',)
    date_hierarchy = 'snapshot_date'
