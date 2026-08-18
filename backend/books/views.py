from rest_framework import generics, permissions, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404
from django.db.models import Q

from books.models import Book, BookInteraction, SearchHistory, BookDwellTime
from books.serializers import BookSerializer, BookInteractionSerializer, BookDwellTimeSerializer
from books.services.recommender import hybrid, content_based, interaction_based, get_similar_books


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

        return Response({"message": "View tracked"})


class InteractionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        book_id = request.data.get("book_id")
        interaction_type = request.data.get("interaction_type", "view")

        if not book_id:
            return Response({"error": "book_id is required"}, status=400)

        user = request.user
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

        return Response(BookDwellTimeSerializer(dwell).data, status=201)


class RecommendBooksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        dept = _get_user_department(user)
        if getattr(user, 'role', '') in ('student', 'librarian') and not user.is_superuser and not dept:
            return Response([])

        base_books = Book.objects.all()
        if dept:
            base_books = base_books.filter(department=dept)

        viewed_categories = (
            BookInteraction.objects
            .filter(user=user, interaction_type='view')
            .values_list('book__categories', flat=True)
        )

        query = Q()
        for cats in viewed_categories:
            for c in cats.split(','):
                query |= Q(categories__icontains=c.strip())

        books = (
            base_books
            .filter(query)
            .exclude(bookinteraction__user=user)
            .distinct()[:10]
        )

        return Response(BookSerializer(books, many=True).data)


class RecommendationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int(request.GET.get('limit', 6))
        rec_type = request.GET.get('type', 'hybrid')

        if rec_type == 'content':
            books = content_based(request.user, limit)
        elif rec_type == 'interaction':
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
            serializer.save()
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

        book.delete()
        return Response({"message": "Book deleted successfully"}, status=200)


class SimilarBooksView(APIView):
    """
    Get books similar to a specific book using content-based filtering
    Uses TF-IDF for intelligent similarity matching scoped to department
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, book_id):
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

        similar_books = get_similar_books(book.id, int(request.GET.get('limit', 6)))
        return Response(BookSerializer(similar_books, many=True).data)
