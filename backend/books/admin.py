from django.contrib import admin
from .models import Book, BookInteraction


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "authors", "quantity")
    search_fields = ("title", "authors", "categories")


@admin.register(BookInteraction)
class BookInteractionAdmin(admin.ModelAdmin):
    list_display = ("user", "book", "interaction_type", "created_at")
    list_filter = ("interaction_type",)
