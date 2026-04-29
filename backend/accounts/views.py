from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    NotificationSerializer
)
from .models import Notification


# --------------------
# Student Registration
# --------------------
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Create tokens and add only safe claims to access token
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token
        access['user_id'] = user.id
        access['email'] = user.email
        access['role'] = user.role

        return Response({
            "access": str(access),
            "refresh": str(refresh),
        })


# --------------------
# Login (Student + Librarian + Admin)
# --------------------
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data

        refresh = RefreshToken.for_user(user)
        access = refresh.access_token
        # include only safe, non-sensitive fields
        access['user_id'] = user.id
        access['email'] = user.email
        access['role'] = user.role

        return Response({
            "access": str(access),
            "refresh": str(refresh),
            "role": user.role,
        })


# --------------------
# Current User Info
# --------------------
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        user = request.user

        # Update User model fields
        for field in ('first_name', 'last_name', 'email'):
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()

        # Update UserProfile fields
        if hasattr(user, 'profile'):
            profile = user.profile
            if 'preferred_categories' in request.data:
                profile.preferred_categories = request.data['preferred_categories']
            if 'department' in request.data:
                from .models import Department
                dept_name = request.data['department']
                if dept_name:
                    dept, _ = Department.objects.get_or_create(name=dept_name)
                    profile.department = dept
                else:
                    profile.department = None
            if 'year' in request.data:
                profile.year = request.data['year'] or None
            if 'student_id' in request.data:
                profile.student_id = request.data['student_id']
            profile.save()

        # Re-fetch from DB so serializer reflects saved state
        user.refresh_from_db()
        if hasattr(user, 'profile'):
            user.profile.refresh_from_db()

        serializer = UserSerializer(user)
        return Response(serializer.data)


# --------------------
# Notification Views
# --------------------
class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        is_read = request.query_params.get('is_read')
        notifications = Notification.objects.filter(user=request.user)
        
        if is_read is not None:
            is_read_bool = is_read.lower() in ('true', '1', 'yes')
            notifications = notifications.filter(is_read=is_read_bool)
        
        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data)


class MarkNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        notification_id = request.data.get('notification_id')
        try:
            notification = Notification.objects.get(id=notification_id, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({'message': 'Notification marked as read'})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=404)


class MarkAllNotificationsReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read'})
