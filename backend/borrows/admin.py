from django.contrib import admin
from .models import Borrow


@admin.register(Borrow)
class BorrowAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'book', 'status', 'requested_at', 'due_date', 'return_date')
    list_filter = ('status', 'requested_at')
    search_fields = ('user__username', 'book__title')
    readonly_fields = ('requested_at',)
    list_select_related = ('user', 'book')
    ordering = ('-requested_at',)
    date_hierarchy = 'requested_at'
