from rest_framework import serializers
from .models import Borrow

class BorrowSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source='book.title', read_only=True)
    book_authors = serializers.CharField(source='book.authors', read_only=True)
    book_categories = serializers.CharField(source='book.categories', read_only=True)
    book_quantity = serializers.IntegerField(source='book.quantity', read_only=True)
    student_name = serializers.SerializerMethodField()
    student_id = serializers.CharField(source='user.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Borrow
        fields = '__all__'

    def get_student_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username

    def get_approved_by_name(self, obj):
        return None
