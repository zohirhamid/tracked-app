from datetime import datetime, date
import calendar
from .models import AccountSetup, Tracker, DailySnapshot, Entry
from rest_framework.response import Response
from .serializers import TrackerSerializer, EntrySerializer, UsernameSerializer
from .services import MonthDataBuilder
from .utils import get_month_navigation
from rest_framework import generics, status
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError


class UsernameView(generics.GenericAPIView):
    serializer_class = UsernameSerializer

    def get(self, request):
        setup, _ = AccountSetup.objects.get_or_create(user=request.user)
        return Response({
            **self.get_serializer(request.user).data,
            "is_complete": setup.username_is_set,
        })

    def post(self, request):
        serializer = self.get_serializer(request.user, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        setup, _ = AccountSetup.objects.get_or_create(user=request.user)
        setup.username_is_set = True
        setup.save(update_fields=["username_is_set"])
        return Response(
            {**serializer.data, "is_complete": True},
            status=status.HTTP_200_OK,
        )


class MonthView(generics.GenericAPIView):
    """The main Excel-like grid view API for a specific month"""
    serializer_class = TrackerSerializer
    
    def get(self, request, year, month):
        if year < 1 or month < 1 or month > 12:
            raise ValidationError({"month": "Use a valid year and a month from 1 to 12."})

        trackers = Tracker.objects.filter(is_active=True).order_by('display_order')
        
        # Use the MonthDataBuilder service
        month_builder = MonthDataBuilder(year, month)
        weeks = month_builder.build_weeks(trackers)
        
        # Serialize trackers
        tracker_serializer = self.get_serializer(trackers, many=True)
        
        data = {
            'trackers': tracker_serializer.data,
            'weeks': weeks,
            'summaries': month_builder.build_summaries(trackers),
            'month_name': calendar.month_name[month],
            'months': [{'name': calendar.month_abbr[m], 'number': m} for m in range(1, 13)],
            
            'total_days': calendar.monthrange(year, month)[1],
            'today': date.today().isoformat(),
            **get_month_navigation(year, month),
        }

        return Response(data, status=status.HTTP_200_OK)


class TrackerListView(generics.ListAPIView):
    """Returns all trackers in a list format"""
    serializer_class = TrackerSerializer

    def get_queryset(self) -> QuerySet[Tracker]: # type: ignore[override]
        return Tracker.objects.order_by('-is_active', 'display_order', 'name')
        
class TrackerCreateView(generics.CreateAPIView):
    serializer_class = TrackerSerializer

class TrackerUpdateView(generics.UpdateAPIView):
    serializer_class = TrackerSerializer

    def get_queryset(self):
        return Tracker.objects.all()

class EntryCreateView(generics.GenericAPIView):
    @staticmethod
    def response_data(tracker, date_obj, entry=None):
        summaries = MonthDataBuilder(date_obj.year, date_obj.month).build_summaries([tracker])
        return {
            "success": True,
            "entry_id": entry.id if entry else None,
            "entry": EntrySerializer(entry).data if entry else None,
            "summary": summaries[0],
        }

    def post(self, request):
        data = request.data

        tracker = get_object_or_404(Tracker, id=data.get('tracker_id'))
        date_obj = self.parse_date(data.get('date'))
        snapshot, _ = DailySnapshot.objects.get_or_create(date=date_obj)

        # Handle delete request (no need to fetch first)
        if data.get("delete_entry"):
            Entry.objects.filter(tracker=tracker, daily_snapshot=snapshot).delete()
            return Response(
                self.response_data(tracker, date_obj),
                status=status.HTTP_200_OK,
            )

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
            self.response_data(tracker, date_obj, entry),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def parse_date(self, date_str):
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            raise ValidationError({"date": "Invalid date format. Use YYYY-MM-DD."})

class TrackerDeleteView(generics.DestroyAPIView):
    serializer_class = TrackerSerializer

    def get_queryset(self):
        return Tracker.objects.all()

class EntryDeleteView(generics.DestroyAPIView):
    serializer_class = EntrySerializer

    def get_queryset(self):
        return Entry.objects.all()
