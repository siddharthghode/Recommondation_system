from django.contrib import admin
from .models import Book, BookInteraction, SearchHistory, BookDwellTime


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ('title', 'authors', 'categories', 'department', 'quantity', 'average_rating', 'published_year')
    search_fields = ('title', 'authors', 'categories')
    list_filter = ('department', 'published_year')
    list_select_related = ('department',)
    ordering = ('title',)


@admin.register(BookInteraction)
class BookInteractionAdmin(admin.ModelAdmin):
    list_display = ('user', 'book', 'interaction_type', 'created_at')
    list_filter = ('interaction_type',)
    list_select_related = ('user', 'book')
    readonly_fields = ('created_at', 'session_id')
    date_hierarchy = 'created_at'


@admin.register(SearchHistory)
class SearchHistoryAdmin(admin.ModelAdmin):
    list_display = ('user', 'query', 'created_at')
    search_fields = ('query', 'user__username')
    list_select_related = ('user',)
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'


@admin.register(BookDwellTime)
class BookDwellTimeAdmin(admin.ModelAdmin):
    list_display = ('user', 'book', 'duration_seconds', 'created_at')
    list_select_related = ('user', 'book')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'
