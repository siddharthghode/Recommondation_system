from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.http import JsonResponse
from books.views import InteractionCreateView, BookDwellTimeView


def health_check(request):
    return JsonResponse({"status": "healthy", "service": "library-backend"})


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
