from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection
from django.db.models import Count, Q, Sum, Case, When, IntegerField
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models.functions import TruncDate
from datetime import timedelta

from books.models import Book, BookInteraction
from borrows.models import Borrow
from accounts.models import User
from books.serializers import BookSerializer
from accounts.serializers import UserSerializer
from borrows.serializers import BorrowSerializer
from books.services.recommender import hybrid, content_based, interaction_based


class LibrarianDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Only librarians and admins may access this dashboard
        if request.user.role not in ("librarian", "admin"):
            return Response({"error": "Forbidden"}, status=403)

        # Librarians see department-scoped stats; admins see global stats
        if request.user.role == "librarian":
            department = request.user.department
        else:
            department = None

        # 📚 BOOK STATS (single DB aggregate)
        books_scope = Book.objects.all()
        if department:
            books_scope = books_scope.filter(department=department)
        book_stats = books_scope.aggregate(
            total=Count("id"),
            in_stock=Count("id", filter=Q(quantity__gt=0)),
            out_of_stock=Count("id", filter=Q(quantity=0)),
        )

        # 👩‍🎓 STUDENT STATS
        if department:
            students = User.objects.select_related("department").filter(
                role="student",
                profile__department=department
            ).count()
        else:
            students = User.objects.select_related("department").filter(role="student").count()

        # 📦 BORROW STATS
        if department:
            borrows = Borrow.objects.select_related("user", "book", "user__profile").filter(
                user__profile__department=department
            )
        else:
            borrows = Borrow.objects.select_related("user", "book", "user__profile").all()

        # Correct status aggregation using Borrow.STATUS_CHOICES
        borrow_stats = borrows.aggregate(
            requested=Count("id", filter=Q(status="requested")),
            approved=Count("id", filter=Q(status="approved")),
            returned=Count("id", filter=Q(status="returned")),
            total=Count("id"),
        )

        # Most borrowed books (department-scoped for librarians)
        most_borrowed_qs = (
            borrows
            .values("book__title")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        # Active students: distinct students who have borrows (total + 30 days)
        active_students_total = borrows.values("user").distinct().count()
        since = timezone.now() - timedelta(days=30)
        active_students_30d = borrows.filter(requested_at__gte=since).values("user").distinct().count()

        # 👁️ MOST VIEWED BOOKS
        # 👁️ MOST VIEWED BOOKS
        mv_qs = BookInteraction.objects.select_related("book", "user", "user__profile").filter(
            interaction_type="view"
        )
        if department:
            mv_qs = mv_qs.filter(user__profile__department=department)

        most_viewed = (
            mv_qs
            .values("book__title")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        # 📊 TOP CATEGORIES (DB-side split + count)
        top_categories = []
        with connection.cursor() as cursor:
            if connection.vendor == "postgresql":
                if department:
                    cursor.execute(
                        """
                        SELECT TRIM(UNNEST(STRING_TO_ARRAY(b.categories, ','))) AS category,
                               COUNT(*) AS count
                        FROM books_book b
                        WHERE b.categories IS NOT NULL
                          AND b.categories <> ''
                          AND b.department_id = %s
                        GROUP BY category
                        ORDER BY count DESC
                        LIMIT 5;
                        """,
                        [department.id],
                    )
                else:
                    cursor.execute(
                        """
                        SELECT TRIM(UNNEST(STRING_TO_ARRAY(b.categories, ','))) AS category,
                               COUNT(*) AS count
                        FROM books_book b
                        WHERE b.categories IS NOT NULL
                          AND b.categories <> ''
                        GROUP BY category
                        ORDER BY count DESC
                        LIMIT 5;
                        """
                    )
            else:
                if department:
                    cursor.execute(
                        """
                        WITH RECURSIVE split(category, rest) AS (
                            SELECT '', categories || ','
                            FROM books_book
                            WHERE categories IS NOT NULL
                              AND categories <> ''
                              AND department_id = ?
                            UNION ALL
                            SELECT TRIM(SUBSTR(rest, 0, INSTR(rest, ','))),
                                   SUBSTR(rest, INSTR(rest, ',') + 1)
                            FROM split
                            WHERE rest <> ''
                        )
                        SELECT category, COUNT(*) AS count
                        FROM split
                        WHERE category <> ''
                        GROUP BY category
                        ORDER BY count DESC
                        LIMIT 5;
                        """,
                        [department.id],
                    )
                else:
                    cursor.execute(
                        """
                        WITH RECURSIVE split(category, rest) AS (
                            SELECT '', categories || ','
                            FROM books_book
                            WHERE categories IS NOT NULL
                              AND categories <> ''
                            UNION ALL
                            SELECT TRIM(SUBSTR(rest, 0, INSTR(rest, ','))),
                                   SUBSTR(rest, INSTR(rest, ',') + 1)
                            FROM split
                            WHERE rest <> ''
                        )
                        SELECT category, COUNT(*) AS count
                        FROM split
                        WHERE category <> ''
                        GROUP BY category
                        ORDER BY count DESC
                        LIMIT 5;
                        """
                    )
            top_categories = [{"category": row[0], "count": row[1]} for row in cursor.fetchall()]

        # 📈 BORROW TRENDS (DB-side date buckets + counts)
        borrow_trends = list(
            borrows.annotate(day=TruncDate("requested_at"))
            .values("day")
            .annotate(
                total=Count("id"),
                returned=Sum(
                    Case(
                        When(status="returned", then=1),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
            )
            .order_by("day")
        )

        return Response({
            "books": {
                "total": book_stats["total"],
                "in_stock": book_stats["in_stock"],
                "out_of_stock": book_stats["out_of_stock"],
            },
            "students": students,
            "borrows": borrow_stats,
            "most_viewed_books": list(most_viewed),
            "most_borrowed_books": list(most_borrowed_qs),
            "active_students": {
                "total": active_students_total,
                "last_30_days": active_students_30d,
            },
            "top_categories": top_categories,
            "borrow_trends": borrow_trends,
        })


class StudentsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ("librarian", "admin"):
            return Response({"error": "Forbidden"}, status=403)

        if request.user.role == 'librarian':
            qs = User.objects.select_related("profile", "profile__department").filter(
                role='student',
                profile__department=request.user.department,
            )
        else:
            qs = User.objects.select_related("profile", "profile__department").filter(role='student')

        return Response(UserSerializer(qs, many=True).data)


class StudentRecommendationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        if request.user.role not in ("librarian", "admin"):
            return Response({"error": "Forbidden"}, status=403)

        student = get_object_or_404(User, id=user_id, role='student')

        # librarians may only view students from their department
        if request.user.role == 'librarian':
            if not getattr(student, 'profile', None) or student.profile.department != request.user.department:
                return Response({"error": "Forbidden"}, status=403)

        limit = int(request.GET.get('limit', 6))
        rec_type = request.GET.get('type', 'hybrid')

        if rec_type == 'content':
            books = content_based(student, limit)
        elif rec_type == 'interaction':
            books = interaction_based(student, limit)
        else:
            books = hybrid(student, limit)

        return Response(BookSerializer(books, many=True).data)


class StudentBorrowsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        if request.user.role not in ("librarian", "admin"):
            return Response({"error": "Forbidden"}, status=403)

        student = get_object_or_404(User, id=user_id, role='student')

        if request.user.role == 'librarian':
            if not getattr(student, 'profile', None) or student.profile.department != request.user.department:
                return Response({"error": "Forbidden"}, status=403)

        borrows = Borrow.objects.select_related("book", "user").filter(user=student)
        return Response(BorrowSerializer(borrows, many=True).data)


class StudentAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        if request.user.role not in ("librarian", "admin"):
            return Response({"error": "Forbidden"}, status=403)

        student = get_object_or_404(User, id=user_id, role='student')

        if request.user.role == 'librarian':
            if not getattr(student, 'profile', None) or student.profile.department != request.user.department:
                return Response({"error": "Forbidden"}, status=403)

        # Get interactions
        interactions = BookInteraction.objects.select_related("book").filter(user=student)
        interaction_stats = {
            'total': interactions.count(),
            'views': interactions.filter(interaction_type='view').count(),
            'likes': interactions.filter(interaction_type='like').count(),
            'borrows': interactions.filter(interaction_type='borrow').count(),
        }

        # Get preferred categories from profile
        preferred_categories = []
        if hasattr(student, 'profile') and student.profile.preferred_categories:
            preferred_categories = [cat.strip() for cat in student.profile.preferred_categories.split(',') if cat.strip()]

        # Get category breakdown from interactions
        category_interactions = {}
        for interaction in interactions:
            if interaction.book.categories:
                categories = [cat.strip() for cat in interaction.book.categories.split(',')]
                for category in categories:
                    if category:
                        category_interactions[category] = category_interactions.get(category, 0) + 1

        # Sort categories by interaction count
        top_categories = sorted(category_interactions.items(), key=lambda x: x[1], reverse=True)[:10]

        # Get most borrowed books
        borrow_interactions = interactions.filter(interaction_type='borrow').select_related('book')
        borrowed_books = []
        for interaction in borrow_interactions[:10]:
            borrowed_books.append({
                'id': interaction.book.id,
                'title': interaction.book.title,
                'authors': interaction.book.authors,
                'categories': interaction.book.categories,
            })

        return Response({
            'interaction_stats': interaction_stats,
            'preferred_categories': preferred_categories,
            'category_interactions': [{'category': cat, 'count': count} for cat, count in top_categories],
            'borrowed_books': borrowed_books,
        })
