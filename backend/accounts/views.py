from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    RequestOTPSerializer,
    VerifyOTPSerializer,
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    NotificationSerializer
)
from .models import Notification, Department
from .services.otp import request_otp, verify_otp


# --------------------
# Department List (Public for Registration)
# --------------------
class DepartmentListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        departments = Department.objects.all().order_by('name')
        return Response([{"id": d.id, "name": d.name} for d in departments])


# --------------------
# Request OTP
# --------------------
class RequestOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        success, message = request_otp(email)
        if not success:
            return Response({'error': message}, status=400)

        return Response({'message': message})


# --------------------
# Verify OTP
# --------------------
class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']

        success, message, token = verify_otp(email, otp)
        if not success:
            return Response({'error': message}, status=400)

        return Response({
            'message': message,
            'verification_token': token,
            'email': email
        })


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
        approval_status = user.profile.approval_status if user.role == 'student' and hasattr(user, 'profile') else 'approved'
        access['approval_status'] = approval_status

        return Response({
            "access": str(access),
            "refresh": str(refresh),
            "role": user.role,
            "approval_status": approval_status,
            "message": "Registration submitted. Pending approval from department librarian." if approval_status == "pending" else "Registration successful.",
        }, status=201)


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
        approval_status = user.profile.approval_status if user.role == 'student' and hasattr(user, 'profile') else 'approved'
        access['approval_status'] = approval_status

        return Response({
            "access": str(access),
            "refresh": str(refresh),
            "role": user.role,
            "approval_status": approval_status,
        })


# --------------------
# Google OAuth Login & Registration
# --------------------
class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        import json
        import urllib.request
        from django.conf import settings
        from django.utils.crypto import get_random_string
        from .models import User, Department

        token = request.data.get('credential') or request.data.get('id_token') or request.data.get('access_token')
        if not token:
            return Response({'error': 'Google credential or token is required'}, status=400)

        # Extra registration metadata if provided by frontend
        req_department = request.data.get('department')
        req_year = request.data.get('year')
        req_role = request.data.get('role', 'student')

        google_user_info = None

        # 1. Try Google ID Token verification endpoint
        try:
            req_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
            req = urllib.request.Request(req_url, headers={'User-Agent': 'Django-Backend'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode('utf-8'))
                    if 'email' in data:
                        google_user_info = data
        except Exception:
            pass

        # 2. Fallback: Try Google Access Token userinfo endpoint
        if not google_user_info:
            try:
                req_url = "https://www.googleapis.com/oauth2/v3/userinfo"
                req = urllib.request.Request(req_url, headers={'Authorization': f'Bearer {token}', 'User-Agent': 'Django-Backend'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode('utf-8'))
                        if 'email' in data:
                            google_user_info = data
            except Exception:
                pass

        if not google_user_info or not google_user_info.get('email'):
            return Response({'error': 'Invalid or expired Google token. Please try again.'}, status=400)

        # Validate token audience matches our client ID
        expected_client_id = settings.GOOGLE_CLIENT_ID
        if expected_client_id:
            aud = google_user_info.get('aud') or google_user_info.get('azp')
            if aud != expected_client_id:
                return Response({'error': 'Google token audience mismatch.'}, status=400)

        email = google_user_info.get('email', '').lower().strip()
        first_name = google_user_info.get('given_name') or google_user_info.get('name', '').split(' ')[0] or ''
        last_name = google_user_info.get('family_name') or (google_user_info.get('name', '').split(' ')[-1] if ' ' in google_user_info.get('name', '') else '')

        # Check if user with this email already exists
        user = User.objects.filter(email=email).first()

        if not user:
            # Check if user exists by username derived from email
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            # Only allow student role creation via public Google OAuth
            role = 'student' if req_role not in ['librarian', 'admin'] else 'student'

            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=role
            )
            user.set_unusable_password()
            user.save()

            # Configure student profile
            if hasattr(user, 'profile'):
                profile = user.profile
                # Set a friendly student ID based on username if default
                if not profile.student_id or profile.student_id == username:
                    profile.student_id = f"G-{username}"
                
                if req_department:
                    dept_obj, _ = Department.objects.get_or_create(name=req_department)
                    profile.department = dept_obj

                if req_year:
                    try:
                        profile.year = int(req_year)
                    except (ValueError, TypeError):
                        pass

                profile.save()
        else:
            # Optionally update profile details if provided
            if hasattr(user, 'profile') and (req_department or req_year):
                profile = user.profile
                if req_department:
                    dept_obj, _ = Department.objects.get_or_create(name=req_department)
                    profile.department = dept_obj
                if req_year:
                    try:
                        profile.year = int(req_year)
                    except (ValueError, TypeError):
                        pass
                profile.save()

        # Create JWT tokens
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token
        access['user_id'] = user.id
        access['email'] = user.email
        access['role'] = user.role
        approval_status = user.profile.approval_status if user.role == 'student' and hasattr(user, 'profile') else 'approved'
        access['approval_status'] = approval_status

        return Response({
            "access": str(access),
            "refresh": str(refresh),
            "role": user.role,
            "username": user.username,
            "email": user.email,
            "approval_status": approval_status,
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
            if 'department' in request.data and (user.is_staff or user.is_superuser):
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
        if not notification_id:
            return Response({'error': 'notification_id is required'}, status=400)
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
