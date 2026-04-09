from django.urls import path
from .views import (
    BorrowRequestView,
    MyBorrowsView,
    PendingBorrowsView,
    ApproveBorrowView,
    RejectBorrowView,
)

urlpatterns = [
    path('request/', BorrowRequestView.as_view()),
    path('my/', MyBorrowsView.as_view()),
    path('pending/', PendingBorrowsView.as_view()),
    path('approve/<int:borrow_id>/', ApproveBorrowView.as_view()),
    path('reject/<int:borrow_id>/', RejectBorrowView.as_view()),
]
