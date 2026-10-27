from django.db import models
from django.conf import settings


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
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trackers",
    )
    name = models.CharField(max_length=100)
    tracker_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    unit = models.CharField(max_length=20, blank=True, null=True)
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Rating-specific fields
    min_value = models.IntegerField(null=True, blank=True, help_text="Minimum rating value (e.g., 1)")
    max_value = models.IntegerField(null=True, blank=True, help_text="Maximum rating value (e.g., 5 or 10)")
    color_rule = models.JSONField(
        default=dict,
        blank=True,
        help_text="Optional rule used to colour good and bad entries in the grid",
    )
    
    class Meta:
        ordering = ['display_order', 'created_at']
        indexes = [
            models.Index(fields=['user', 'is_active', 'display_order']),
        ]
    
    def __str__(self):
        return self.name


class DailySnapshot(models.Model):
    """
    Represents one day in the tracking sheet.
    its a container that groups all entries for a certain day.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_snapshots",
    )
    date = models.DateField()
    
    class Meta:
        ordering = ['-date']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'date'],
                name='unique_snapshot_per_user_date',
            ),
        ]
    
    def __str__(self):
        return str(self.date)


class Entry(models.Model):
    """
    The ACTUAL DATA. This is the value in a cell of your Excel sheet.
    """
    id:int
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tracker_entries",
    )
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
            models.Index(fields=['user', 'daily_snapshot']),
        ]
    
    def __str__(self):
        return f"{self.tracker.name} - {self.daily_snapshot.date}"

    def get_duration_display(self):
        """Format the stored minute value as decimal hours."""
        if self.duration_minutes is None:
            return ""
        hours = round(self.duration_minutes / 60, 2)
        return f"{hours:g}h"
    
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
