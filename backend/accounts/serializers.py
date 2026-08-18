from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate
from django.utils import timezone
from datetime import timedelta
from .models import User, UserProfile, Department, Notification, EmailOTP


# --------------------
# Request OTP Serializer
# --------------------
class RequestOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


# --------------------
# Verify OTP Serializer
# --------------------
class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_otp(self, value):
        val = value.strip()
        if not val.isdigit() or len(val) != 6:
            raise serializers.ValidationError("Verification code must be 6 digits.")
        return val


# --------------------
# Register Serializer (Student)
# --------------------
class RegisterSerializer(serializers.ModelSerializer):
    # Accept either a department PK or department name from frontend
    department = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    year = serializers.IntegerField(required=False, allow_null=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=False, default='student')
    password_confirm = serializers.CharField(write_only=True, required=False)
    student_id = serializers.CharField(write_only=True, required=False)
    verification_token = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            'username',
            'password',
            'password_confirm',
            'role',
            'student_id',
            'email',
            'first_name',
            'last_name',
            'department',
            'year',
            'verification_token',
        )
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate(self, attrs):
        role = attrs.get('role', 'student')
        if role in ['librarian', 'admin']:
            request = self.context.get('request') if hasattr(self, 'context') else None
            user_making_request = getattr(request, 'user', None)
            if not (user_making_request and (user_making_request.is_staff or user_making_request.is_superuser)):
                raise serializers.ValidationError({'role': f'Public registration is only allowed for students. Cannot register as {role}.'})

        email = attrs.get('email', '').strip().lower()
        if not email:
            raise serializers.ValidationError({'email': 'Email is required for registration.'})

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({'email': 'An account with this email already exists.'})

        # OTP Verification Token check for student registration
        if role == 'student':
            token = attrs.get('verification_token')
            if not token:
                raise serializers.ValidationError({
                    'verification_token': 'Email verification is required. Please verify your OTP first.'
                })

            otp_record = EmailOTP.objects.filter(
                email=email,
                verification_token=token,
                is_verified=True
            ).first()

            if not otp_record:
                raise serializers.ValidationError({
                    'verification_token': 'Invalid or expired email verification. Please request a new OTP.'
                })

            # Check token freshness (verified within last 30 minutes)
            if otp_record.verified_at and timezone.now() - otp_record.verified_at > timedelta(minutes=30):
                raise serializers.ValidationError({
                    'verification_token': 'Verification session expired. Please verify OTP again.'
                })

        # If password_confirm provided, ensure it matches
        pw = attrs.get('password')
        pwc = attrs.get('password_confirm')
        if pw and pwc and pw != pwc:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match'})
        return attrs

    def _resolve_department(self, value):
        if not value:
            return None
        # try pk first
        from django.core.exceptions import ObjectDoesNotExist
        try:
            # if it's numeric string convert
            if isinstance(value, str) and value.isdigit():
                return Department.objects.get(pk=int(value))
            return Department.objects.get(name=value)
        except ObjectDoesNotExist:
            return None

    def create(self, validated_data):
        role = validated_data.pop('role', 'student')
        # optional student_id and verification_token
        student_id = validated_data.pop('student_id', None)
        token = validated_data.pop('verification_token', None)
        department_val = validated_data.pop('department', None)
        year = validated_data.pop('year', None)

        # ensure username exists; if not, for students fallback to student_id
        username = validated_data.get('username') or student_id
        if not username:
            raise serializers.ValidationError({'username': 'Username or student_id is required'})

        # resolve department if provided (allows frontend to send name or pk)
        department_obj = self._resolve_department(department_val)

        # create user instance and set password using Django hashing
        password = validated_data.get('password')
        user = User(
            username=username,
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=role
        )
        if password:
            user.set_password(password)
        user.save()

        # if librarian, attach department on user (if provided)
        if role == 'librarian':
            if department_obj:
                user.department = department_obj
                user.save()

        # if student, ensure profile fields are set
        if role == 'student':
            if not department_obj:
                raise serializers.ValidationError({'department': 'A valid department is required for student registration'})
            # profile created by signal
            profile = user.profile
            # prefer explicit student_id, otherwise use username
            profile.student_id = student_id or username
            profile.department = department_obj
            profile.year = year
            profile.approval_status = 'pending'
            profile.save()

            # Invalidate the verification token to prevent reuse
            if token:
                EmailOTP.objects.filter(verification_token=token).update(verification_token=None)

        return user


# --------------------
# Login Serializer
# --------------------
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(
            username=data['username'],
            password=data['password']
        )
        if not user:
            # AuthenticationFailed maps to HTTP 401
            raise AuthenticationFailed('Invalid username or password')
        return user


# --------------------
# User Serializer (/auth/me)
# --------------------
class UserSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    approval_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'department',
            'approval_status',
            'is_staff',
            'profile',
        )

    def get_profile(self, obj):
        if obj.role == "student" and hasattr(obj, 'profile'):
            return {
                "student_id": obj.profile.student_id,
                "department": obj.profile.department.name if obj.profile.department else None,
                "department_id": obj.profile.department.id if obj.profile.department else None,
                "year": obj.profile.year,
                "preferred_categories": obj.profile.preferred_categories,
                "approval_status": obj.profile.approval_status,
            }
        return None

    def get_department(self, obj):
        return obj.department.name if obj.department else None

    def get_approval_status(self, obj):
        if obj.role == "student" and hasattr(obj, 'profile'):
            return obj.profile.approval_status
        return "approved"


# --------------------
# Notification Serializer
# --------------------
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'message', 'is_read', 'created_at')
        read_only_fields = ('id', 'created_at')
