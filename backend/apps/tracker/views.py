from datetime import datetime, date
import calendar
from .models import Tracker, DailySnapshot, Entry
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import TrackerSerializer, EntrySerializer
from .services import MonthDataBuilder
from .utils import get_month_navigation
from .permissions import CanCreateTracker, IsOwner, IsEntryOwner
from rest_framework import generics, status
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError


class MonthView(generics.GenericAPIView):
    """The main Excel-like grid view API for a specific month"""
    permission_classes = [IsAuthenticated]
    serializer_class = TrackerSerializer
    
    def get(self, request, year, month):
        trackers = Tracker.objects.filter(
            user=request.user,
            is_active=True
        ).order_by('display_order')
        
        # Use the MonthDataBuilder service
        month_builder = MonthDataBuilder(request.user, year, month)
        weeks = month_builder.build_weeks(trackers)
        
        # Serialize trackers
        tracker_serializer = self.get_serializer(trackers, many=True)
        
        data = {
            'trackers': tracker_serializer.data,
            'weeks': weeks,
            'month_name': calendar.month_name[month],
            'months': [{'name': calendar.month_abbr[m], 'number': m} for m in range(1, 13)],
            
            'total_days': calendar.monthrange(year, month)[1],
            'today': date.today().isoformat(),
            **get_month_navigation(year, month),
        }

        return Response(data, status=status.HTTP_200_OK)


class TodayView(generics.GenericAPIView):
    """A focused view for logging a single day (defaults to today)."""
    permission_classes = [IsAuthenticated]
    serializer_class = TrackerSerializer

    def get(self, request):
        trackers = Tracker.objects.filter(
            user=request.user,
            is_active=True
        ).order_by('display_order')

        requested_date = request.query_params.get('date')
        if requested_date:
            day_date = self.parse_date(requested_date)
        else:
            day_date = date.today()

        snapshot, _ = DailySnapshot.objects.get_or_create(user=request.user, date=day_date)
        entries = Entry.objects.filter(
            daily_snapshot=snapshot,
            tracker__in=trackers
        ).select_related('tracker')

        entries_dict = {}
        for entry in entries:
            entries_dict[entry.tracker.id] = EntrySerializer(entry).data

        tracker_serializer = self.get_serializer(trackers, many=True)

        data = {
            'trackers': tracker_serializer.data,
            'day': {
                'date': day_date.isoformat(),
                'day': day_date.day,
                'entries': entries_dict,
            },
            # Server "today" is still useful for UI hints, even if date=... is passed.
            'today': date.today().isoformat(),
        }

        return Response(data, status=status.HTTP_200_OK)

    def parse_date(self, date_str):
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            raise ValidationError({"date": "Invalid date format. Use YYYY-MM-DD."})

class TrackerListView(generics.ListAPIView):
    """Returns all user's trackers in a list format"""
    permission_classes = [IsAuthenticated, IsOwner]
    serializer_class = TrackerSerializer

    def get_queryset(self) -> QuerySet[Tracker]: # type: ignore[override]
        return Tracker.objects.filter(user=self.request.user).order_by('-is_active', 'display_order', 'name')
        
class TrackerCreateView(generics.CreateAPIView):
    serializer_class = TrackerSerializer
    permission_classes = [IsAuthenticated, CanCreateTracker]

    # sets the owner at creation time
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class TrackerUpdateView(generics.UpdateAPIView):
    queryset = Tracker.objects.all()
    serializer_class = TrackerSerializer
    permission_classes = [IsAuthenticated, IsOwner]

class EntryCreateView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data

        tracker = get_object_or_404(Tracker, id=data.get('tracker_id'), user=request.user)
        date_obj = self.parse_date(data.get('date'))
        snapshot, _ = DailySnapshot.objects.get_or_create(user=request.user, date=date_obj)

        # Handle delete request (no need to fetch first)
        if data.get("delete_entry"):
            Entry.objects.filter(tracker=tracker, daily_snapshot=snapshot).delete()
            return Response({"success": True}, status=status.HTTP_200_OK)

        # Get or create the entry
        entry, created = Entry.objects.get_or_create(
            tracker=tracker,
            daily_snapshot=snapshot
        )

        # If updating existing entry, clear old values first
        if not created:
            entry.clear_values()

        try:
            entry.set_value_from_data(data)
            entry.save()
        except ValueError as e:
            # keep your old behavior: if we created it and validation fails, remove it
            if created:
                entry.delete()
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {"success": True, "entry_id": entry.id},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    def parse_date(self, date_str):
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            raise ValidationError({"date": "Invalid date format. Use YYYY-MM-DD."})

class TrackerDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated, IsOwner]
    queryset = Tracker.objects.all()
    serializer_class = TrackerSerializer

class EntryDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated, IsEntryOwner]
    queryset = Entry.objects.all()
    serializer_class = EntrySerializer
