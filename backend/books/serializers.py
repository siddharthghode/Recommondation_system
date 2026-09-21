from rest_framework import serializers
from .models import Book, BookInteraction, SearchHistory, BookDwellTime, BookReview

class BookSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True, default='')

    class Meta:
        model = Book
        fields = '__all__'

class BookInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookInteraction
        fields = "__all__"


class SearchHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SearchHistory
        fields = "__all__"


class BookDwellTimeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookDwellTime
        fields = "__all__"


class BookReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = BookReview
        fields = ('id', 'username', 'rating', 'comment', 'created_at', 'updated_at')
        read_only_fields = ('id', 'username', 'created_at', 'updated_at')

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value