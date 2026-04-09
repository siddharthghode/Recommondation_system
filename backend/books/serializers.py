from rest_framework import serializers
from .models import Book, BookInteraction, SearchHistory, BookDwellTime

class BookSerializer(serializers.ModelSerializer):
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