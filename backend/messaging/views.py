from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.apps import apps
from .models import Message
from .serializers import MessageSerializer, MessageCreateSerializer, UserBriefSerializer


class MessageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer
    
    def get_queryset(self):
        """Get messages for the current user"""
        user = self.request.user
        return Message.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).select_related('sender', 'recipient', 'parent_message')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return MessageCreateSerializer
        return MessageSerializer
    
    @action(detail=False, methods=['get'])
    def inbox(self, request):
        """Get received messages"""
        messages = Message.objects.filter(
            recipient=request.user
        ).select_related('sender', 'recipient')
        
        # Filter by read status if specified
        is_read = request.query_params.get('is_read')
        if is_read is not None:
            messages = messages.filter(is_read=is_read.lower() == 'true')
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def sent(self, request):
        """Get sent messages"""
        messages = Message.objects.filter(
            sender=request.user
        ).select_related('sender', 'recipient')
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a message as read"""
        message = self.get_object()
        
        # Only recipient can mark as read
        if message.recipient != request.user:
            return Response(
                {'error': 'You can only mark your own messages as read'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        message.mark_as_read()
        return Response({'status': 'Message marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all received messages as read"""
        count = Message.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True)
        return Response({'status': f'{count} messages marked as read'})
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread messages"""
        count = Message.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()
        return Response({'unread_count': count})
    
    @action(detail=False, methods=['get'])
    def librarians(self, request):
        """Get list of librarians for messaging"""
        from accounts.models import User as CustomUser
        
        # Get users with librarian role (role is on User model, not Profile)
        librarians = CustomUser.objects.filter(
            role='librarian'
        ).distinct()
        
        serializer = UserBriefSerializer(librarians, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def students(self, request):
        """Get list of students for messaging (librarians only)"""
        from accounts.models import User as CustomUser
        
        # Only librarians can see student list
        if request.user.role not in ['librarian', 'admin']:
            return Response(
                {'error': 'Only librarians can access student list'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get users with student role
        students = CustomUser.objects.filter(
            role='student'
        ).distinct()
        
        serializer = UserBriefSerializer(students, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def conversation(self, request, pk=None):
        """Get conversation thread with a specific user"""
        from accounts.models import User as CustomUser
        
        other_user_id = pk
        try:
            other_user = CustomUser.objects.get(id=other_user_id)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all messages between current user and other user
        messages = Message.objects.filter(
            (Q(sender=request.user) & Q(recipient=other_user)) |
            (Q(sender=other_user) & Q(recipient=request.user))
        ).select_related('sender', 'recipient').order_by('created_at')
        
        # Mark received messages as read
        Message.objects.filter(
            sender=other_user,
            recipient=request.user,
            is_read=False
        ).update(is_read=True)
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
