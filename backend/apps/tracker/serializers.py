from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Tracker, Entry


class UsernameSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ["username"]

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise serializers.ValidationError("Enter a username.")

        user_model = get_user_model()
        existing_users = user_model.objects.filter(username__iexact=username)
        if self.instance:
            existing_users = existing_users.exclude(pk=self.instance.pk)
        if existing_users.exists():
            raise serializers.ValidationError("This username is already taken.")
        return username

class TrackerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tracker
        fields = [
            'id', 'name', 'tracker_type', 'unit',
            'display_order', 'is_active', 'min_value', 'max_value', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class EntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Entry
        fields = [
            'id', 'tracker', 'daily_snapshot',
            'binary_value', 'number_value', 'time_value', 
            'duration_minutes', 'text_value', 'rating_value', 'prayer_values',
            'created_at', 'updated_at'
        ]
