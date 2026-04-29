from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from books.views import InteractionCreateView, BookDwellTimeView

urlpatterns = [
    path('', RedirectView.as_view(url='/api/books/', permanent=False)),
    path('admin/', admin.site.urls),

    path('api/auth/', include('accounts.urls')),
    path('api/books/', include('books.urls')),
    path('api/borrows/', include('borrows.urls')),
    path("api/analytics/", include("analytics.urls")),
    path('api/', include('messaging.urls')),
    path('api/interactions/', InteractionCreateView.as_view()),
    path('api/dwell-time/', BookDwellTimeView.as_view()),
]
