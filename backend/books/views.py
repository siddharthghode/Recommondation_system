from rest_framework import generics, permissions, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db.models import Q

from accounts.models import Department
from books.models import Book, BookInteraction, SearchHistory, BookDwellTime
from borrows.models import Borrow
from books.serializers import BookSerializer, BookInteractionSerializer, BookDwellTimeSerializer
from books.services.recommender import (
    hybrid,
    content_based,
    interaction_based,
    get_similar_books,
    invalidate_user_recommendations,
    invalidate_book_similar_cache,
)
from books.services.csv_importer import import_books_from_csv


class IsLibrarianOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and hasattr(request.user, 'role') and request.user.role in ['librarian', 'admin']

class BookPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _get_user_department(user):
    """Helper to return department instance for approved student or librarian."""
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser or getattr(user, 'role', '') == 'admin':
        return None
    if getattr(user, 'role', '') == 'student':
        if hasattr(user, 'profile') and user.profile.approval_status == 'approved' and user.profile.department:
            return user.profile.department
        return None
    if getattr(user, 'role', '') == 'librarian':
        return getattr(user, 'department', None)
    return getattr(user, 'department', None)


class BookListView(generics.ListAPIView):
    serializer_class = BookSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'authors', 'categories', 'description']
    pagination_class = BookPagination

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            if user.is_superuser or getattr(user, 'role', '') == 'admin':
                qs = Book.objects.select_related('department').all()
            elif getattr(user, 'role', '') == 'librarian':
                dept = getattr(user, 'department', None)
                if dept:
                    qs = Book.objects.select_related('department').filter(department=dept)
                else:
                    qs = Book.objects.none()
            elif getattr(user, 'role', '') == 'student':
                if not hasattr(user, 'profile') or user.profile.approval_status != 'approved':
                    qs = Book.objects.none()
                else:
                    dept = user.profile.department
                    if dept:
                        qs = Book.objects.select_related('department').filter(department=dept)
                    else:
                        qs = Book.objects.none()
            else:
                qs = Book.objects.none()
        else:
            qs = Book.objects.select_related('department').all()

        search_query = self.request.query_params.get('search')
        if search_query:
            if self.request.user.is_authenticated:
                SearchHistory.objects.create(user=self.request.user, query=search_query)
            else:
                SearchHistory.objects.create(query=search_query)
            qs = qs.filter(
                Q(title__icontains=search_query) |
                Q(authors__icontains=search_query) |
                Q(categories__icontains=search_query) |
                Q(description__icontains=search_query)
            )
        category = self.request.query_params.get('category')
        if category and category != "All":
            qs = qs.filter(categories__icontains=category)
        return qs.order_by('id')


class BookDetailView(generics.RetrieveAPIView):
    serializer_class = BookSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            if user.is_superuser or getattr(user, 'role', '') == 'admin':
                return Book.objects.select_related('department').all()
            elif getattr(user, 'role', '') == 'librarian':
                dept = getattr(user, 'department', None)
                if dept:
                    return Book.objects.select_related('department').filter(department=dept)
                return Book.objects.none()
            elif getattr(user, 'role', '') == 'student':
                if not hasattr(user, 'profile') or user.profile.approval_status != 'approved':
                    return Book.objects.none()
                dept = user.profile.department
                if dept:
                    return Book.objects.select_related('department').filter(department=dept)
                return Book.objects.none()
        return Book.objects.select_related('department').all()


class TrackBookView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, book_id):
        user = request.user
        dept = None
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if user.role == 'student':
                if not hasattr(user, 'profile') or user.profile.approval_status != 'approved':
                    return Response({"error": "Account pending approval"}, status=403)
                dept = user.profile.department
            else:
                dept = getattr(user, 'department', None)
            if not dept:
                return Response({"error": "Forbidden"}, status=403)
            book = get_object_or_404(Book, id=book_id, department=dept)
        else:
            book = get_object_or_404(Book, id=book_id)

        BookInteraction.objects.get_or_create(
            user=request.user,
            book=book,
            interaction_type='view'
        )

        invalidate_user_recommendations(user.id, getattr(dept, 'id', 'all'))
        return Response({"message": "View tracked"})


class InteractionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        book_id = request.data.get("book_id")
        interaction_type = request.data.get("interaction_type", "view")

        if not book_id:
            return Response({"error": "book_id is required"}, status=400)

        user = request.user
        dept = None
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if user.role == 'student':
                if not hasattr(user, 'profile') or user.profile.approval_status != 'approved':
                    return Response({"error": "Account pending approval"}, status=403)
                dept = user.profile.department
            else:
                dept = getattr(user, 'department', None)
            if not dept:
                return Response({"error": "Forbidden"}, status=403)
            book = get_object_or_404(Book, id=book_id, department=dept)
        else:
            book = get_object_or_404(Book, id=book_id)

        if interaction_type not in dict(BookInteraction.INTERACTION_CHOICES):
            return Response({"error": "Invalid interaction_type"}, status=400)

        interaction = BookInteraction.objects.create(
            user=request.user,
            book=book,
            interaction_type=interaction_type
        )

        invalidate_user_recommendations(user.id, getattr(dept, 'id', 'all'))
        return Response(BookInteractionSerializer(interaction).data, status=201)


class BookDwellTimeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        book_id = request.data.get("book_id")
        duration = request.data.get("duration")

        if not book_id or duration is None:
            return Response({"error": "book_id and duration are required"}, status=400)

        try:
            duration_value = float(duration)
        except (TypeError, ValueError):
            return Response({"error": "duration must be a number"}, status=400)

        if duration_value < 0:
            return Response({"error": "duration must be non-negative"}, status=400)

        user = request.user
        dept = None
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if user.role == 'student':
                if not hasattr(user, 'profile') or user.profile.approval_status != 'approved':
                    return Response({"error": "Account pending approval"}, status=403)
                dept = user.profile.department
            else:
                dept = getattr(user, 'department', None)
            if not dept:
                return Response({"error": "Forbidden"}, status=403)
            book = get_object_or_404(Book, id=book_id, department=dept)
        else:
            book = get_object_or_404(Book, id=book_id)

        dwell = BookDwellTime.objects.create(
            user=request.user,
            book=book,
            duration_seconds=duration_value
        )

        invalidate_user_recommendations(user.id, getattr(dept, 'id', 'all'))
        return Response(BookDwellTimeSerializer(dwell).data, status=201)


class RecommendationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = max(1, min(int(request.GET.get('limit', 6)), 50))
        except (ValueError, TypeError):
            limit = 6

        rec_type = (request.GET.get('type') or 'hybrid').lower()

        if rec_type == 'content':
            books = content_based(request.user, limit)
        elif rec_type in ('interaction', 'collaborative'):
            books = interaction_based(request.user, limit)
        else:
            books = hybrid(request.user, limit)

        return Response(BookSerializer(books, many=True).data)


class BookManageView(APIView):
    """
    API endpoint for librarians/admins to create, update, and delete books
    """
    permission_classes = [IsLibrarianOrAdmin]

    def post(self, request):
        """Create a new book"""
        user = request.user
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        # For librarians, force department to authenticated user's department
        if user.role == 'librarian' and not user.is_superuser:
            if not user.department:
                return Response({"error": "Librarian is not assigned to a department"}, status=403)
            data['department'] = user.department.id

        serializer = BookSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    def put(self, request, pk):
        """Update an existing book"""
        user = request.user
        if user.role == 'librarian' and not user.is_superuser:
            if not user.department:
                return Response({"error": "Forbidden"}, status=403)
            book = get_object_or_404(Book, pk=pk, department=user.department)
            data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            data['department'] = user.department.id
        else:
            book = get_object_or_404(Book, pk=pk)
            data = request.data

        serializer = BookSerializer(book, data=data)
        if serializer.is_valid():
            saved_book = serializer.save()
            invalidate_book_similar_cache(saved_book.id, getattr(saved_book.department, 'id', 'none'))
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        """Delete a book"""
        user = request.user
        if user.role == 'librarian' and not user.is_superuser:
            if not user.department:
                return Response({"error": "Forbidden"}, status=403)
            book = get_object_or_404(Book, pk=pk, department=user.department)
        else:
            book = get_object_or_404(Book, pk=pk)

        if Borrow.objects.filter(book=book, status__in=['requested', 'approved']).exists():
            return Response({"error": "Cannot delete book with active or requested borrow records"}, status=400)

        dept_id = getattr(book.department, 'id', 'none')
        book.delete()
        invalidate_book_similar_cache(pk, dept_id)
        return Response({"message": "Book deleted successfully"}, status=200)


class SimilarBooksView(APIView):
    """
    Get books similar to a specific book using content-based filtering
    Uses TF-IDF for intelligent similarity matching scoped to department
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, book_id):
        try:
            limit = max(1, min(int(request.GET.get('limit', 6)), 50))
        except (ValueError, TypeError):
            limit = 6

        user = request.user
        if user.is_authenticated and not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if getattr(user, 'role', '') == 'student':
                if not hasattr(user, 'profile') or user.profile.approval_status != 'approved':
                    return Response([])
                dept = user.profile.department
            else:
                dept = getattr(user, 'department', None)
            if not dept:
                return Response([])
            book = get_object_or_404(Book, id=book_id, department=dept)
        else:
            book = get_object_or_404(Book, id=book_id)

        similar_books = get_similar_books(book.id, limit)
        return Response(BookSerializer(similar_books, many=True).data)


class BookCSVImportView(APIView):
    """
    API endpoint for librarians/admins to bulk import books via CSV upload.
    Department is strictly determined from the authenticated librarian.
    """
    permission_classes = [IsLibrarianOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user
        if user.role == 'librarian' and not user.is_superuser:
            department = getattr(user, 'department', None)
            if not department:
                return Response({"error": "Librarian is not assigned to a department"}, status=403)
        elif user.is_superuser or getattr(user, 'role', '') == 'admin':
            dept_id = request.data.get('department') or request.data.get('department_id')
            if dept_id:
                try:
                    department = Department.objects.get(id=dept_id)
                except Department.DoesNotExist:
                    return Response({"error": "Specified department does not exist"}, status=400)
            else:
                department = getattr(user, 'department', None) or Department.objects.first()
            if not department:
                return Response({"error": "No valid department found for import"}, status=400)
        else:
            return Response({"error": "Forbidden: Only librarians and administrators can import books."}, status=403)

        if 'file' not in request.FILES:
            return Response({"error": "No CSV file provided. Please upload a file with key 'file'."}, status=400)

        csv_file = request.FILES['file']
        if csv_file.size > 10 * 1024 * 1024:
            return Response({"error": "File size exceeds 10MB limit."}, status=400)

        result = import_books_from_csv(csv_file, department)
        if not result.get("success", False):
            return Response({"error": result.get("error", "CSV import failed"), "details": result}, status=400)

        return Response(result, status=200)
