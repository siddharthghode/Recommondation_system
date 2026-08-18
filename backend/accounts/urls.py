from django.urls import path
from .views import (
    DepartmentListView,
    RegisterView,
    LoginView,
    GoogleLoginView,
    MeView,
    NotificationListView,
    MarkNotificationReadView,
    MarkAllNotificationsReadView
)

urlpatterns = [
    path('departments/', DepartmentListView.as_view(), name='departments-list'),
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('google/', GoogleLoginView.as_view(), name='google-login'),
    path('me/', MeView.as_view()),
    path('notifications/', NotificationListView.as_view()),
    path('notifications/mark-read/', MarkNotificationReadView.as_view()),
    path('notifications/mark-all-read/', MarkAllNotificationsReadView.as_view()),
]

