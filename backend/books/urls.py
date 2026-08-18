from django.urls import path
from .views import (
    BookListView,
    BookDetailView,
    TrackBookView,
    RecommendationView,
    BookManageView,
    SimilarBooksView,
    BookCSVImportView
)

urlpatterns = [
    # Fixed-string paths must come before parameterised ones so Django
    # doesn't try to match e.g. "recommendations" as an integer <pk>.
    path('', BookListView.as_view()),
    path('import/', BookCSVImportView.as_view(), name='book-import-csv'),
    path('recommendations/', RecommendationView.as_view(), name='book-recommendations'),
    path('manage/', BookManageView.as_view(), name='book-manage'),
    path('manage/<int:pk>/', BookManageView.as_view(), name='book-manage-detail'),
    path('track/<int:book_id>/', TrackBookView.as_view(), name='book-track'),
    path('<int:book_id>/similar/', SimilarBooksView.as_view(), name='similar-books'),
    path('<int:pk>/', BookDetailView.as_view(), name='book-detail'),
]
