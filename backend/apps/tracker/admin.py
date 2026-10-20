from django.contrib import admin
from .models import Tracker, DailySnapshot, Entry


@admin.register(Tracker)
class TrackerAdmin(admin.ModelAdmin):
    list_display = ('name', 'tracker_type', 'is_active')
    list_filter = ('tracker_type', 'is_active')
    search_fields = ('name',)


@admin.register(DailySnapshot)
class DailySnapshotAdmin(admin.ModelAdmin):
    list_display = ('date',)
    list_filter = ('date',)
    date_hierarchy = 'date'


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = ('tracker', 'daily_snapshot', 'updated_at')
    list_filter = ('tracker__tracker_type',)
    search_fields = ('tracker__name',)
