from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate
from .models import User, UserProfile, Department, Notification


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
        )
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate(self, attrs):
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
        # Only allow creating librarian accounts when request is from a staff/superuser
        request = self.context.get('request') if hasattr(self, 'context') else None
        role = validated_data.pop('role', 'student')
        if role == 'librarian':
            user_making_request = getattr(request, 'user', None)
            if not (user_making_request and (user_making_request.is_staff or user_making_request.is_superuser)):
                raise serializers.ValidationError({'role': 'Only admin users can create librarian accounts'})
        # optional student_id
        student_id = validated_data.pop('student_id', None)
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
            # profile created by signal
            profile = user.profile
            # prefer explicit student_id, otherwise use username
            profile.student_id = student_id or username
            profile.department = department_obj
            profile.year = year
            profile.save()

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
            'is_staff',
            'profile',
        )

    def get_profile(self, obj):
        if obj.role == "student" and hasattr(obj, 'profile'):
            return {
                "student_id": obj.profile.student_id,
                "department": obj.profile.department.name if obj.profile.department else None,
                "year": obj.profile.year,
                "preferred_categories": obj.profile.preferred_categories,
            }
        return None

    def get_department(self, obj):
        return obj.department.name if obj.department else None


# --------------------
# Notification Serializer
# --------------------
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'message', 'is_read', 'created_at')
        read_only_fields = ('id', 'created_at')
