import math
import re
from collections import defaultdict
from django.core.cache import cache
from rest_framework import generics, permissions, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import transaction, IntegrityError
from django.db.models import Q

from accounts.models import Department
from books.models import Book, BookInteraction, SearchHistory, BookDwellTime, BookReview
from borrows.models import Borrow
from books.serializers import BookSerializer, BookInteractionSerializer, BookDwellTimeSerializer, BookReviewSerializer
from books.services.recommender import (
    hybrid,
    content_based,
    interaction_based,
    get_similar_books,
    invalidate_user_recommendations,
    invalidate_book_similar_cache,
)
from books.services.csv_importer import import_books_from_csv
from books.cache_utils import (
    BOOK_DETAIL_CACHE_TTL,
    BOOK_LIST_CACHE_TTL,
    SIMILAR_BOOKS_CACHE_TTL,
    CATEGORIES_CACHE_TTL,
    categories_key,
    similar_books_key,
    recommendation_key,
    book_detail_key,
    book_list_default_key,
    invalidate_catalog_cache,
    invalidate_categories_cache,
    invalidate_book_cache,
    invalidate_dashboard_cache,
    safe_delete_pattern,
    safe_cache_get,
    safe_cache_set,
)


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

        department_param = self.request.query_params.get('department')
        if department_param and department_param != "All":
            if department_param.isdigit():
                qs = qs.filter(department__id=int(department_param))
            else:
                qs = qs.filter(department__name__iexact=department_param)

        ordering = self.request.query_params.get('ordering', '-id')
        if ordering in ['-id', 'id', 'title', '-title', 'average_rating', '-average_rating', 'published_year', '-published_year']:
            return qs.order_by(ordering)
        return qs.order_by('-id')

    def list(self, request, *args, **kwargs):
        search = request.query_params.get('search')
        category = request.query_params.get('category')
        dept_param = request.query_params.get('department')
        ordering = request.query_params.get('ordering', '-id')
        page = request.query_params.get('page', '1')

        is_default_request = (
            not search and
            (not category or category == "All") and
            (not dept_param or dept_param == "All") and
            ordering in ('-id', '') and
            page in ('1', '')
        )

        if is_default_request:
            user = request.user
            dept = _get_user_department(user)
            dept_key = dept.id if dept else 'all'
            cache_key = book_list_default_key(dept_key)
            cached_data = safe_cache_get(cache_key)
            if cached_data is not None:
                return Response(cached_data)

            response = super().list(request, *args, **kwargs)
            if response.status_code == 200:
                safe_cache_set(cache_key, response.data, BOOK_LIST_CACHE_TTL)
            return response

        return super().list(request, *args, **kwargs)


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

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        if pk is not None:
            cache_key = book_detail_key(pk)
            cached_data = safe_cache_get(cache_key)
            if cached_data is not None:
                user = request.user
                if not user.is_authenticated or user.is_superuser or getattr(user, 'role', '') == 'admin':
                    return Response(cached_data)
                elif getattr(user, 'role', '') == 'librarian':
                    dept = getattr(user, 'department', None)
                    if dept and cached_data.get('department') == dept.id:
                        return Response(cached_data)
                elif getattr(user, 'role', '') == 'student':
                    if hasattr(user, 'profile') and user.profile.approval_status == 'approved':
                        dept = user.profile.department
                        if dept and cached_data.get('department') == dept.id:
                            return Response(cached_data)

        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        safe_cache_set(book_detail_key(instance.id), data, BOOK_DETAIL_CACHE_TTL)
        return Response(data)


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

        rating = request.data.get("rating")
        if interaction_type == "rate" and rating is not None:
            try:
                r_val = float(rating)
                if 1 <= r_val <= 5:
                    with transaction.atomic():
                        locked_book = Book.objects.select_for_update().get(id=book.id)
                        cur_avg = locked_book.average_rating or 0.0
                        cur_cnt = locked_book.ratings_count or 0
                        new_cnt = cur_cnt + 1
                        new_avg = round((cur_avg * cur_cnt + r_val) / new_cnt, 2)
                        locked_book.average_rating = new_avg
                        locked_book.ratings_count = new_cnt
                        locked_book.save(update_fields=['average_rating', 'ratings_count'])
                        transaction.on_commit(lambda: invalidate_book_cache(locked_book.id))
                        book = locked_book
            except (ValueError, TypeError):
                pass

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
        duration = request.data.get("duration_seconds") or request.data.get("duration")

        if not book_id or duration is None:
            return Response({"error": "book_id and duration are required"}, status=400)

        try:
            duration_value = float(duration)
        except (TypeError, ValueError):
            return Response({"error": "duration must be a valid number"}, status=400)

        if math.isnan(duration_value) or math.isinf(duration_value) or duration_value < 0:
            return Response({"error": "duration must be a non-negative finite number"}, status=400)

        # Cap single-session dwell duration to max 24 hours (86400 seconds)
        if duration_value > 86400:
            duration_value = 86400.0

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
        dept = _get_user_department(request.user)
        dept_key = dept.id if dept else 'all'

        cache_key = recommendation_key(rec_type, request.user.id, dept_key, limit)
        cached = safe_cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        if rec_type == 'content':
            books = content_based(request.user, limit)
        elif rec_type in ('interaction', 'collaborative'):
            books = interaction_based(request.user, limit)
        else:
            books = hybrid(request.user, limit)

        serialized = BookSerializer(books, many=True).data
        safe_cache_set(cache_key, serialized, 600)
        return Response(serialized)


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
            saved_book = serializer.save()
            invalidate_catalog_cache()
            invalidate_categories_cache()
            invalidate_dashboard_cache(getattr(saved_book.department, 'id', None))
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
            invalidate_book_cache(saved_book.id)
            invalidate_catalog_cache()
            invalidate_categories_cache()
            invalidate_dashboard_cache(getattr(saved_book.department, 'id', None))
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
        invalidate_book_cache(pk)
        invalidate_catalog_cache()
        invalidate_categories_cache()
        invalidate_dashboard_cache(dept_id)
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
        dept = None
        if user.is_authenticated and not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if getattr(user, 'role', '') == 'student':
                if not hasattr(user, 'profile') or user.profile.approval_status != 'approved':
                    return Response([])
                dept = user.profile.department
            else:
                dept = getattr(user, 'department', None)
        dept_key = dept.id if dept else 'all'
        cache_key = similar_books_key(book_id, dept_key, limit)
        cached = safe_cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        if dept:
            book = get_object_or_404(Book, id=book_id, department=dept)
        else:
            book = get_object_or_404(Book, id=book_id)

        similar_books = get_similar_books(book.id, limit)
        serialized = BookSerializer(similar_books, many=True).data
        safe_cache_set(cache_key, serialized, SIMILAR_BOOKS_CACHE_TTL)
        return Response(serialized)


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

        # Clear cached catalog, categories, dashboards, and similar books on successful book import
        invalidate_catalog_cache()
        invalidate_categories_cache()
        invalidate_dashboard_cache(getattr(department, 'id', None))
        safe_delete_pattern("books:similar:*")

        return Response(result, status=200)


class BookCategoriesView(APIView):
    """
    API endpoint returning unique cleaned book categories from the library.
    Optional query parameter: ?department=<id_or_name>
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        dept_param = request.query_params.get('department')
        if not dept_param and request.user.is_authenticated:
            dept = _get_user_department(request.user)
            if dept:
                dept_param = str(dept.id)

        dept_key = dept_param if (dept_param and dept_param != "All") else 'all'
        cache_key = categories_key(dept_key)
        cached = safe_cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        qs = Book.objects.exclude(categories__isnull=True).exclude(categories='')
        if dept_param and dept_param != "All":
            if dept_param.isdigit():
                qs = qs.filter(department_id=int(dept_param))
            else:
                qs = qs.filter(department__name__iexact=dept_param)

        raw_categories = qs.values_list('categories', flat=True)
        category_counts = defaultdict(int)

        for raw in raw_categories:
            if not raw:
                continue
            tokens = re.split(r'[,;|]', str(raw))
            for token in tokens:
                cleaned = token.strip()
                # Exclude purely numeric tokens or year ranges (e.g. '1802-1885', '1933-1939')
                if cleaned and len(cleaned) >= 2 and not re.match(r'^\d+(-\d+)?$', cleaned):
                    category_counts[cleaned] += 1

        sorted_categories = sorted(category_counts.keys(), key=lambda c: (-category_counts[c], c.lower()))

        safe_cache_set(cache_key, sorted_categories, CATEGORIES_CACHE_TTL)
        return Response(sorted_categories)


class BookReviewView(APIView):
    """
    GET  /api/books/<book_id>/reviews/          — list reviews (public)
    POST /api/books/<book_id>/reviews/          — create review (authenticated student)
    PUT  /api/books/<book_id>/reviews/<id>/     — update own review
    DELETE /api/books/<book_id>/reviews/<id>/   — delete own review
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAuthenticated()]

    def _get_book(self, book_id, user):
        if user.is_authenticated and not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            dept = _get_user_department(user)
            if dept:
                return get_object_or_404(Book, id=book_id, department=dept)
        return get_object_or_404(Book, id=book_id)

    def get(self, request, book_id):
        reviews = BookReview.objects.filter(book_id=book_id).select_related('user')
        return Response(BookReviewSerializer(reviews, many=True).data)

    def post(self, request, book_id):
        book = self._get_book(book_id, request.user)
        if BookReview.objects.filter(user=request.user, book=book).exists():
            return Response({'error': 'You have already reviewed this book.'}, status=400)
        serializer = BookReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(user=request.user, book=book)
        except IntegrityError:
            return Response({'error': 'You have already reviewed this book.'}, status=400)
        return Response(serializer.data, status=201)

    def put(self, request, book_id, review_id):
        review = get_object_or_404(BookReview, id=review_id, book_id=book_id, user=request.user)
        serializer = BookReviewSerializer(review, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, book_id, review_id):
        review = get_object_or_404(BookReview, id=review_id, book_id=book_id, user=request.user)
        review.delete()
        return Response(status=204)
