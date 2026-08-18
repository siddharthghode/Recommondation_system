from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from django.db import transaction

from .models import Borrow
from .serializers import BorrowSerializer
from books.models import Book, BookInteraction
from accounts.models import Notification


class BorrowRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        book_id = request.data.get('book_id')
        if not book_id:
            return Response({"error": "book_id is required"}, status=400)

        user = request.user
        # Department check for students and librarians
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            dept = getattr(user, 'department', None) if user.role == 'librarian' else (user.profile.department if hasattr(user, 'profile') and user.profile.department else getattr(user, 'department', None))
            if not dept:
                return Response({"error": "You must be assigned to a department to borrow books"}, status=403)
            book = get_object_or_404(Book, id=book_id, department=dept)
        else:
            book = get_object_or_404(Book, id=book_id)

        # Prevent requesting when no stock
        if book.quantity <= 0:
            return Response({"error": "Book not available"}, status=400)

        # Prevent duplicate active/requested borrows for same book by same user
        if Borrow.objects.filter(user=request.user, book=book, status__in=['requested', 'approved']).exists():
            return Response({"error": "Existing active or requested borrow for this book"}, status=400)

        Borrow.objects.create(
            user=request.user,
            book=book,
            status='requested'
        )
        return Response({"message": "Borrow request sent"})


class MyBorrowsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        borrows = Borrow.objects.select_related('book', 'user').filter(user=request.user)
        
        status = request.query_params.get('status')
        if status:
            borrows = borrows.filter(status=status)
        
        return Response(BorrowSerializer(borrows, many=True).data)


class PendingBorrowsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ('librarian', 'admin'):
            return Response({"error": "Forbidden"}, status=403)

        if request.user.role == 'librarian' and not request.user.is_superuser:
            if not request.user.department:
                return Response([])
            borrows = Borrow.objects.select_related('book', 'user', 'user__profile').filter(
                status='requested',
                book__department=request.user.department
            )
        else:
            borrows = Borrow.objects.select_related('book', 'user', 'user__profile').filter(status='requested')

        serialized = BorrowSerializer(borrows, many=True).data
        return Response(serialized)


class ApproveBorrowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, borrow_id):
        if request.user.role not in ('librarian', 'admin'):
            return Response({"error": "Forbidden"}, status=403)

        borrow = get_object_or_404(Borrow.objects.select_related('book', 'user', 'user__profile'), id=borrow_id)

        # Librarians may only approve borrows from their own department
        if request.user.role == 'librarian' and not request.user.is_superuser:
            if not request.user.department or borrow.book.department != request.user.department:
                return Response({"error": "Forbidden"}, status=403)
            if getattr(borrow.user, 'profile', None) and borrow.user.profile.department != request.user.department:
                return Response({"error": "Forbidden"}, status=403)

        if borrow.status != 'requested':
            return Response({"error": "Borrow not in requested state"}, status=400)

        with transaction.atomic():
            book = Book.objects.select_for_update().get(id=borrow.book.id)

            if book.quantity <= 0:
                return Response({"error": "Out of stock"}, status=400)

            from datetime import timedelta
            approval_time = now()
            borrow.status = 'approved'
            borrow.approved_at = approval_time
            borrow.borrow_date = approval_time
            borrow.due_date = approval_time + timedelta(days=30)
            book.quantity = book.quantity - 1
            if book.quantity < 0:
                book.quantity = 0

            book.save()
            borrow.save()

            BookInteraction.objects.get_or_create(
                user=borrow.user,
                book=book,
                interaction_type='borrow'
            )

            Notification.objects.create(
                user=borrow.user,
                message=f'Your borrow request for "{book.title}" has been approved!'
            )

        return Response({"message": "Approved"})


class ReturnBookView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        borrow_id = request.data.get('borrow_id')
        borrow = get_object_or_404(Borrow, id=borrow_id, user=request.user)

        if borrow.status != 'approved':
            return Response({"error": "Only approved borrows can be returned"}, status=400)

        with transaction.atomic():
            book = Book.objects.select_for_update().get(id=borrow.book.id)
            borrow.status = 'returned'
            borrow.return_date = now()
            book.quantity += 1
            book.save()
            borrow.save()

        return Response({"message": "Book returned successfully"})


class RejectBorrowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, borrow_id):
        if request.user.role not in ('librarian', 'admin'):
            return Response({"error": "Forbidden"}, status=403)

        borrow = get_object_or_404(Borrow.objects.select_related('book', 'user', 'user__profile'), id=borrow_id)

        # Librarians may only reject borrows from their own department
        if request.user.role == 'librarian' and not request.user.is_superuser:
            if not request.user.department or borrow.book.department != request.user.department:
                return Response({"error": "Forbidden"}, status=403)
            if getattr(borrow.user, 'profile', None) and borrow.user.profile.department != request.user.department:
                return Response({"error": "Forbidden"}, status=403)

        if borrow.status != 'requested':
            return Response({"error": "Borrow not in requested state"}, status=400)

        borrow.status = 'rejected'
        reason = request.data.get('reason', '')
        borrow.rejection_reason = reason
        borrow.save()

        rejection_msg = f'Your borrow request for "{borrow.book.title}" has been rejected.'
        if reason:
            rejection_msg += f' Reason: {reason}'
        Notification.objects.create(
            user=borrow.user,
            message=rejection_msg
        )

        return Response({"message": "Rejected"})
