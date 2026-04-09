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
        borrows = Borrow.objects.filter(user=request.user)
        
        # Filter by status if provided
        status = request.query_params.get('status')
        if status:
            borrows = borrows.filter(status=status)
        
        return Response(BorrowSerializer(borrows, many=True).data)


class PendingBorrowsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Only librarians and admins can access pending borrows
        if request.user.role not in ('librarian', 'admin'):
            return Response({"error": "Forbidden"}, status=403)

        # Librarians see pending borrows for their department; admins see all
        if request.user.role == 'librarian':
            # If librarian has no department, show all pending requests (or return empty based on requirements)
            if request.user.department:
                print(f"Librarian {request.user.username} department: {request.user.department}")
                borrows = Borrow.objects.filter(
                    status='requested',
                    user__profile__department=request.user.department
                )
                print(f"Found {borrows.count()} pending requests for department {request.user.department}")
            else:
                # Librarian has no department - show all pending requests
                print(f"Warning: Librarian {request.user.username} has no department assigned - showing all requests")
                borrows = Borrow.objects.filter(status='requested')
                print(f"Found {borrows.count()} pending requests (no department filter)")
        else:
            borrows = Borrow.objects.filter(status='requested')
            print(f"Admin {request.user.username}: Found {borrows.count()} pending requests (all departments)")

        serialized = BorrowSerializer(borrows, many=True).data
        print(f"Returning {len(serialized)} serialized borrow requests")
        return Response(serialized)


class ApproveBorrowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, borrow_id):
        # Only librarians and admins may approve borrows
        if request.user.role not in ('librarian', 'admin'):
            return Response({"error": "Forbidden"}, status=403)

        borrow = get_object_or_404(Borrow, id=borrow_id)

        # Librarians may only approve borrows from their department
        if request.user.role == 'librarian':
            if getattr(borrow.user, 'profile', None) and \
               borrow.user.profile.department != request.user.department:
                return Response({"error": "Forbidden"}, status=403)

        if borrow.status != 'requested':
            return Response({"error": "Borrow not in requested state"}, status=400)

        # Use a transaction + row-level lock to avoid race conditions when decrementing quantity
        with transaction.atomic():
            # Lock the book row
            book = Book.objects.select_for_update().get(id=borrow.book.id)

            if book.quantity <= 0:
                return Response({"error": "Out of stock"}, status=400)

            # mark approved and decrement safely
            from datetime import timedelta
            approval_time = now()
            borrow.status = 'approved'
            borrow.approved_at = approval_time
            borrow.borrow_date = approval_time
            borrow.due_date = approval_time + timedelta(days=30)
            book.quantity = book.quantity - 1
            if book.quantity < 0:
                # defensive: should not happen because we checked, but prevent negative values
                book.quantity = 0

            book.save()
            borrow.save()

            # track borrow interaction (avoid duplicates)
            BookInteraction.objects.get_or_create(
                user=borrow.user,
                book=book,
                interaction_type='borrow'
            )

            # Create notification for student
            Notification.objects.create(
                user=borrow.user,
                message=f'Your borrow request for "{book.title}" has been approved!'
            )

        return Response({"message": "Approved"})


class RejectBorrowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, borrow_id):
        # Only librarians and admins may reject borrows
        if request.user.role not in ('librarian', 'admin'):
            return Response({"error": "Forbidden"}, status=403)

        borrow = get_object_or_404(Borrow, id=borrow_id)

        # Librarians may only reject borrows from their department
        if request.user.role == 'librarian':
            if getattr(borrow.user, 'profile', None) and \
               borrow.user.profile.department != request.user.department:
                return Response({"error": "Forbidden"}, status=403)

        if borrow.status != 'requested':
            return Response({"error": "Borrow not in requested state"}, status=400)

        borrow.status = 'rejected'
        reason = request.data.get('reason', '')
        borrow.rejection_reason = reason
        borrow.save()

        # Create notification for student
        rejection_msg = f'Your borrow request for "{borrow.book.title}" has been rejected.'
        if reason:
            rejection_msg += f' Reason: {reason}'
        Notification.objects.create(
            user=borrow.user,
            message=rejection_msg
        )

        return Response({"message": "Rejected"})
