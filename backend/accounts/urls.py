from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    MeView,
    NotificationListView,
    MarkNotificationReadView,
    MarkAllNotificationsReadView
)

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('me/', MeView.as_view()),
    path('notifications/', NotificationListView.as_view()),
    path('notifications/mark-read/', MarkNotificationReadView.as_view()),
    path('notifications/mark-all-read/', MarkAllNotificationsReadView.as_view()),
]
