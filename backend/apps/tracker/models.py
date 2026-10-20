from django.db import models
from django.conf import settings
from decimal import Decimal
from datetime import datetime


class AccountSetup(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="account_setup",
    )
    username_is_set = models.BooleanField(default=False)

    def __str__(self):
        return f"Account setup for {self.user_id}"

class Tracker(models.Model):
    """
    Defines WHAT to track.
    replaces the column header in Excel sheet.
    """
    id:int
    TYPE_CHOICES = [
        ('binary', 'Yes/No (Binary)'),
        ('number', 'Number'),
        ('time', 'Time'),
        ('duration', 'Duration (Start/End Time)'),
        ('text', 'Text/Notes'),
        ('rating', 'Rating/Scale'),
        ('prayer', 'Islamic Prayer (5x)'),
    ]
    
    name = models.CharField(max_length=100)
    tracker_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    unit = models.CharField(max_length=20, blank=True, null=True)
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Rating-specific fields
    min_value = models.IntegerField(null=True, blank=True, help_text="Minimum rating value (e.g., 1)")
    max_value = models.IntegerField(null=True, blank=True, help_text="Maximum rating value (e.g., 5 or 10)")
    
    class Meta:
        ordering = ['display_order', 'created_at']
    
    def __str__(self):
        return self.name


class DailySnapshot(models.Model):
    """
    Represents one day in the tracking sheet.
    its a container that groups all entries for a certain day.
    """
    date = models.DateField(unique=True)
    
    class Meta:
        ordering = ['-date']
    
    def __str__(self):
        return str(self.date)


class Entry(models.Model):
    """
    The ACTUAL DATA. This is the value in a cell of your Excel sheet.
    """
    id:int
    tracker = models.ForeignKey(Tracker, on_delete=models.CASCADE)
    daily_snapshot = models.ForeignKey(DailySnapshot, on_delete=models.CASCADE)

    # Entry type
    binary_value = models.BooleanField(null=True, blank=True)
    number_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    time_value = models.TimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True, help_text="Duration in minutes")
    text_value = models.TextField(null=True, blank=True, help_text="For text/notes tracker")
    rating_value = models.IntegerField(null=True, blank=True, help_text="For rating tracker")
    prayer_values = models.JSONField(null=True, blank=True, help_text="For prayer tracker")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['tracker', 'daily_snapshot']
        indexes = [
            models.Index(fields=['daily_snapshot', 'tracker']),
        ]
    
    def __str__(self):
        return f"{self.tracker.name} - {self.daily_snapshot.date}"

    def get_duration_display(self):
        """Format duration as '4h 30min' or '5h' or '45min'"""
        if self.duration_minutes is None:
            return ""

        hours = self.duration_minutes // 60
        minutes = self.duration_minutes % 60
        
        if hours > 0 and minutes > 0:
            return f"{hours}h {minutes}min"
        elif hours > 0:
            return f"{hours}h"
        else:
            return f"{minutes}min"
    
    def get_rating_display(self):
        """Format rating with context from tracker
        Ratings may come from trackers with or without a defined scale.
        When a scale exists, we show the rating in context (e.g. 4/5) so
        users can immediately understand its meaning. If no scale is
        defined, we fall back to displaying the raw value.
        """
        if self.rating_value is None:
            return ""
        
        if self.tracker.min_value and self.tracker.max_value:
            return f"{self.rating_value}/{self.tracker.max_value}"
        return str(self.rating_value)
    
    def clear_values(self):
        """Clear all value fields before setting a new value"""
        self.binary_value = None
        self.number_value = None
        self.time_value = None
        self.duration_minutes = None
        self.text_value = None
        self.rating_value = None
        self.prayer_values = None

    def set_value_from_data(self, data):
        """
        Set entry value based on tracker type and validate.
        Raises ValueError if validation fails.
        """
        tracker = self.tracker
        
        if tracker.tracker_type == 'binary':
            self.binary_value = data.get('binary_value')
        
        elif tracker.tracker_type == 'number':
            self.number_value = Decimal(str(data.get('number_value')))
        
        elif tracker.tracker_type == 'time':
            self.time_value = datetime.strptime(data.get('time_value'), '%H:%M').time()
        
        elif tracker.tracker_type == 'duration':
            duration = data.get('duration_minutes')
            self.duration_minutes = int(duration) if duration is not None else None
        
        elif tracker.tracker_type == 'text':
            self.text_value = data.get('text_value', '')
        
        elif tracker.tracker_type == 'rating':
            self._set_rating_value(data)

        elif tracker.tracker_type == 'prayer':
            self._set_prayer_values(data)
    
    def _set_rating_value(self, data):
        """Set and validate rating value"""
        rating_val = data.get('rating_value')
        if rating_val is None:
            return
        
        rating_int = int(rating_val)
        
        if self.tracker.min_value and rating_int < self.tracker.min_value:
            raise ValueError(f'Rating must be at least {self.tracker.min_value}')
        
        if self.tracker.max_value and rating_int > self.tracker.max_value:
            raise ValueError(f'Rating must be at most {self.tracker.max_value}')
        
        self.rating_value = rating_int

    def _set_prayer_values(self, data):
        """Set and validate prayer values"""
        values = data.get('prayer_values')
        if values is None:
            self.prayer_values = None
            return

        if isinstance(values, str):
            try:
                import json
                values = json.loads(values)
            except Exception:
                raise ValueError('Invalid prayer values')

        if not isinstance(values, dict):
            raise ValueError('Invalid prayer values')

        prayer_keys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
        normalized = {}
        for key in prayer_keys:
            raw = values.get(key, None)
            if raw is True or raw is False or raw is None:
                normalized[key] = raw
            elif isinstance(raw, str):
                lowered = raw.lower()
                if lowered == 'true':
                    normalized[key] = True
                elif lowered == 'false':
                    normalized[key] = False
                elif lowered in ['null', 'none', '']:
                    normalized[key] = None
                else:
                    raise ValueError('Invalid prayer values')
            else:
                raise ValueError('Invalid prayer values')

        self.prayer_values = normalized
