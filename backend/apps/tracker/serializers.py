from rest_framework import serializers
from rest_framework.exceptions import NotFound
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


class PrayerValuesField(serializers.DictField):
    prayer_keys = ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')

    def __init__(self, **kwargs):
        super().__init__(
            child=serializers.BooleanField(allow_null=True),
            **kwargs,
        )

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        unknown_keys = set(values) - set(self.prayer_keys)
        if unknown_keys:
            raise serializers.ValidationError(
                f"Unknown prayer: {sorted(unknown_keys)[0]}."
            )
        return {key: values.get(key) for key in self.prayer_keys}


class EntryWriteSerializer(serializers.Serializer):
    tracker_id = serializers.IntegerField(min_value=1)
    date = serializers.DateField(input_formats=['%Y-%m-%d'])
    delete_entry = serializers.BooleanField(default=False)
    binary_value = serializers.BooleanField(required=False)
    number_value = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
    )
    time_value = serializers.TimeField(
        input_formats=['%H:%M'],
        required=False,
    )
    duration_minutes = serializers.IntegerField(min_value=0, required=False)
    text_value = serializers.CharField(
        allow_blank=True,
        required=False,
        trim_whitespace=False,
    )
    rating_value = serializers.IntegerField(required=False)
    prayer_values = PrayerValuesField(required=False)

    value_field_by_type = {
        'binary': 'binary_value',
        'number': 'number_value',
        'time': 'time_value',
        'duration': 'duration_minutes',
        'text': 'text_value',
        'rating': 'rating_value',
        'prayer': 'prayer_values',
    }

    def validate_tracker_id(self, value):
        try:
            self.tracker = Tracker.objects.get(
                pk=value,
                user=self.context['request'].user,
            )
        except Tracker.DoesNotExist as error:
            raise NotFound("Tracker not found.") from error
        return value

    def validate(self, attrs):
        if attrs['delete_entry']:
            return attrs

        value_field = self.value_field_by_type[self.tracker.tracker_type]
        if value_field not in attrs:
            raise serializers.ValidationError(
                {value_field: "This field is required for this tracker type."}
            )

        if self.tracker.tracker_type == 'rating':
            rating = attrs['rating_value']
            if self.tracker.min_value is not None and rating < self.tracker.min_value:
                raise serializers.ValidationError({
                    'rating_value': f"Rating must be at least {self.tracker.min_value}."
                })
            if self.tracker.max_value is not None and rating > self.tracker.max_value:
                raise serializers.ValidationError({
                    'rating_value': f"Rating must be at most {self.tracker.max_value}."
                })

        return attrs

    @property
    def value_field(self):
        return self.value_field_by_type[self.tracker.tracker_type]
