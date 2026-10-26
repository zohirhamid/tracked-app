# tracker/services.py
from collections import defaultdict
from datetime import datetime, timedelta
import calendar
from .models import Entry
from .serializers import EntrySerializer

class MonthDataBuilder:
    """Service for building month view data structure"""
    
    def __init__(self, user, year, month):
        self.user = user
        self.year = year
        self.month = month
        self._entries = None

    def _get_entries(self, trackers):
        if self._entries is None:
            self._entries = list(
                Entry.objects.filter(
                    user=self.user,
                    daily_snapshot__date__year=self.year,
                    daily_snapshot__date__month=self.month,
                    tracker__in=trackers,
                ).select_related('tracker', 'daily_snapshot')
            )
        return self._entries
    
    def build_weeks(self, trackers):
        """
        Build week structure for the month with entries.
        
        Returns:
            list: List of weeks, where each week is a list of day data
        """
        weeks = []
        first_day = datetime(self.year, self.month, 1).date()
        last_day = datetime(
            self.year,
            self.month,
            calendar.monthrange(self.year, self.month)[1],
        ).date()
        calendar_start = first_day - timedelta(days=first_day.weekday())
        calendar_end = last_day + timedelta(days=6 - last_day.weekday())
        entries_by_date = defaultdict(dict)

        entries = Entry.objects.filter(
            user=self.user,
            daily_snapshot__date__range=(calendar_start, calendar_end),
            tracker__in=trackers,
        ).select_related('tracker', 'daily_snapshot')
        for entry in entries:
            entries_by_date[entry.daily_snapshot.date][entry.tracker_id] = EntrySerializer(entry).data

        current_week = []
        date_obj = calendar_start
        while date_obj <= calendar_end:
            day_data = self._build_day_data(date_obj, entries_by_date)
            day_data['outside_month'] = date_obj.month != self.month
            current_week.append(day_data)

            if date_obj.weekday() == 6:
                weeks.append(current_week)
                current_week = []
            date_obj += timedelta(days=1)

        return weeks
    
    def _build_day_data(self, date_obj, entries_by_date):
        """
        Build data for a single day including all entries.
        
        Args:
            date_obj: Date object for the day
            entries_by_date: Entries already grouped by snapshot date
        
        Returns:
            dict: Day data with date and entries
        """
        return {
            'date': date_obj.isoformat(),
            'day': date_obj.day,
            'entries': entries_by_date.get(date_obj, {})
        }

    def build_summaries(self, trackers):
        """Return a compact, type-aware summary for each active tracker."""
        entries_by_tracker = defaultdict(list)
        for entry in self._get_entries(trackers):
            entries_by_tracker[entry.tracker_id].append(entry)

        summaries = []
        for tracker in trackers:
            entries = entries_by_tracker.get(tracker.id, [])
            summary = {
                'tracker_id': tracker.id,
                'tracker_type': tracker.tracker_type,
                'count': len(entries),
                'value': None,
                'display': '—',
            }

            values = []
            if tracker.tracker_type == 'binary':
                values = [entry.binary_value for entry in entries if entry.binary_value is not None]
                if values:
                    average = sum(values) / len(values) * 100
                    summary.update(value=round(average, 1), display=f'{average:.0f}%')
            elif tracker.tracker_type == 'number':
                values = [float(entry.number_value) for entry in entries if entry.number_value is not None]
                if values:
                    average = sum(values) / len(values)
                    unit = f' {tracker.unit}' if tracker.unit else ''
                    summary.update(value=round(average, 2), display=f'{average:.1f}{unit}')
            elif tracker.tracker_type == 'duration':
                values = [entry.duration_minutes for entry in entries if entry.duration_minutes is not None]
                if values:
                    average_minutes = round(sum(values) / len(values))
                    average_hours = round(average_minutes / 60, 2)
                    display_hours = f'{average_hours:.2f}'.rstrip('0').rstrip('.')
                    summary.update(value=average_hours, display=f'{display_hours}h')
            elif tracker.tracker_type == 'rating':
                values = [entry.rating_value for entry in entries if entry.rating_value is not None]
                if values:
                    average = sum(values) / len(values)
                    scale = f'/{tracker.max_value}' if tracker.max_value else ''
                    summary.update(value=round(average, 2), display=f'{average:.1f}{scale}')
            elif tracker.tracker_type == 'time':
                values = [
                    entry.time_value.hour * 60 + entry.time_value.minute
                    for entry in entries if entry.time_value is not None
                ]
                if values:
                    average = round(sum(values) / len(values)) % (24 * 60)
                    hours, minutes = divmod(average, 60)
                    summary.update(value=average, display=f'{hours:02d}:{minutes:02d}')
            elif tracker.tracker_type == 'prayer':
                completed = 0
                possible = 0
                for entry in entries:
                    for value in (entry.prayer_values or {}).values():
                        if value is not None:
                            possible += 1
                            completed += int(value is True)
                if possible:
                    average = completed / possible * 100
                    summary.update(value=round(average, 1), display=f'{average:.0f}%')
            elif tracker.tracker_type == 'text':
                values = [entry.text_value for entry in entries if entry.text_value]
                summary.update(value=len(values), display=f'{len(values)} notes')

            summaries.append(summary)

        return summaries
