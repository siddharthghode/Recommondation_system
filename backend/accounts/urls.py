from django.urls import path
from .views import (
    DepartmentListView,
    RequestOTPView,
    VerifyOTPView,
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
    path('otp/request/', RequestOTPView.as_view(), name='otp-request'),
    path('otp/verify/', VerifyOTPView.as_view(), name='otp-verify'),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('google/', GoogleLoginView.as_view(), name='google-login'),
    path('me/', MeView.as_view(), name='me'),
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/mark-read/', MarkNotificationReadView.as_view(), name='notifications-mark-read'),
    path('notifications/mark-all-read/', MarkAllNotificationsReadView.as_view(), name='notifications-mark-all-read'),
]

