from django.urls import path
from .views import (
    LibrarianDashboardView,
    StudentsListView,
    PendingStudentsView,
    ApproveStudentView,
    RejectStudentView,
    StudentRecommendationsView,
    StudentBorrowsView,
    StudentAnalyticsView,
)

urlpatterns = [
    path("librarian-dashboard/", LibrarianDashboardView.as_view()),
    path("students/", StudentsListView.as_view()),
    path("students/pending/", PendingStudentsView.as_view()),
    path("students/<int:user_id>/approve/", ApproveStudentView.as_view()),
    path("students/<int:user_id>/reject/", RejectStudentView.as_view()),
    path("students/<int:user_id>/recommendations/", StudentRecommendationsView.as_view()),
    path("students/<int:user_id>/borrows/", StudentBorrowsView.as_view()),
    path("students/<int:user_id>/analytics/", StudentAnalyticsView.as_view()),
]
