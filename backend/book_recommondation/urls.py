from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.http import JsonResponse
from books.views import InteractionCreateView, BookDwellTimeView


def health_check(request):
    """
    12-Factor Deep Health Check:
    Verifies that attached backing services (PostgreSQL and Redis) are responsive.
    """
    health = {
        "status": "healthy",
        "service": "library-backend",
        "database": "unknown",
        "cache": "unknown",
    }
    status_code = 200

    # 1. Verify Database Connectivity
    try:
        from django.db import connection
        connection.ensure_connection()
        health["database"] = "healthy"
    except Exception as exc:
        health["database"] = f"unhealthy: {exc}"
        health["status"] = "unhealthy"
        status_code = 503

    # 2. Verify Cache Connectivity
    try:
        from django.core.cache import cache
        cache.set("_health_ping", 1, timeout=5)
        health["cache"] = "healthy"
    except Exception as exc:
        health["cache"] = f"unhealthy: {exc}"
        health["status"] = "unhealthy"
        status_code = 503

    return JsonResponse(health, status=status_code)


urlpatterns = [
    path('', RedirectView.as_view(url='/api/books/', permanent=False)),
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),

    path('api/auth/', include('accounts.urls')),
    path('api/books/', include('books.urls')),
    path('api/borrows/', include('borrows.urls')),
    path("api/analytics/", include("analytics.urls")),
    path('api/', include('messaging.urls')),
    path('api/interactions/', InteractionCreateView.as_view()),
    path('api/dwell-time/', BookDwellTimeView.as_view()),
]
