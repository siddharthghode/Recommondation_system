from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Message


class UserBriefSerializer(serializers.ModelSerializer):
    """Brief user info for message listings"""
    
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'email', 'role']
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class MessageSerializer(serializers.ModelSerializer):
    sender_details = UserBriefSerializer(source='sender', read_only=True)
    recipient_details = UserBriefSerializer(source='recipient', read_only=True)
    reply_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'sender_details', 'recipient', 'recipient_details',
            'subject', 'body', 'is_read', 'created_at', 'updated_at',
            'parent_message', 'reply_count'
        ]
        read_only_fields = ['sender', 'created_at', 'updated_at', 'is_read']
    
    def get_reply_count(self, obj):
        return obj.replies.count()
    
    def create(self, validated_data):
        # Automatically set sender from request user
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)


class MessageCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for creating messages"""
    
    class Meta:
        model = Message
        fields = ['recipient', 'subject', 'body', 'parent_message']
    
    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)
