from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, UserProfile, Department, Notification

# --------------------
# Department Admin
# --------------------
@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


# --------------------
# User Admin
# --------------------
@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "role", "department", "is_staff")
    list_filter = ("role", "department", "is_staff")
    search_fields = ("username", "email")
    ordering = ("username",)

    # extend default fieldsets to show role and department on change view
    fieldsets = DjangoUserAdmin.fieldsets + (
        ('Extra', {'fields': ('role', 'department')}),
    )

    # ensure department and role are available on the add user form
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ('Extra', {'classes': ('wide',), 'fields': ('role', 'department')}),
    )


# --------------------
# UserProfile Admin
# --------------------
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "student_id", "department", "year")
    search_fields = ("student_id", "user__username")
    list_filter = ("department", "year")


# --------------------
# Notification Admin
# --------------------
@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "message", "is_read", "created_at")
    list_filter = ("is_read", "created_at")
    search_fields = ("user__username", "message")
    ordering = ("-created_at",)
