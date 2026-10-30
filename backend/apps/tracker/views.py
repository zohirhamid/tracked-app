from datetime import date
import calendar
from .models import AccountSetup, Tracker, DailySnapshot, Entry
from rest_framework.response import Response
from .serializers import (
    EntrySerializer,
    EntryWriteSerializer,
    TrackerSerializer,
    UsernameSerializer,
)
from .services import MonthDataBuilder
from .utils import get_month_navigation
from rest_framework import generics, status
from django.db.models import QuerySet
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

        trackers = Tracker.objects.filter(
            user=request.user,
            is_active=True,
        ).order_by('display_order')
        
        # Use the MonthDataBuilder service
        month_builder = MonthDataBuilder(request.user, year, month)
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
        return Tracker.objects.filter(user=self.request.user).order_by(
            'display_order', 'name'
        )
        
class TrackerCreateView(generics.CreateAPIView):
    serializer_class = TrackerSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class TrackerUpdateView(generics.UpdateAPIView):
    serializer_class = TrackerSerializer

    def get_queryset(self):
        return Tracker.objects.filter(user=self.request.user)

class EntryCreateView(generics.GenericAPIView):
    @staticmethod
    def response_data(user, tracker, date_obj, entry=None):
        summaries = MonthDataBuilder(user, date_obj.year, date_obj.month).build_summaries([tracker])
        return {
            "success": True,
            "entry_id": entry.id if entry else None,
            "entry": EntrySerializer(entry).data if entry else None,
            "summary": summaries[0],
        }

    def post(self, request):
        serializer = EntryWriteSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        tracker = serializer.tracker
        date_obj = serializer.validated_data['date']
        snapshot, _ = DailySnapshot.objects.get_or_create(
            user=request.user,
            date=date_obj,
        )

        # Handle delete request (no need to fetch first)
        if serializer.validated_data['delete_entry']:
            Entry.objects.filter(
                user=request.user,
                tracker=tracker,
                daily_snapshot=snapshot,
            ).delete()
            return Response(
                self.response_data(request.user, tracker, date_obj),
                status=status.HTTP_200_OK,
            )

        # Get or create the entry
        entry, created = Entry.objects.get_or_create(
            user=request.user,
            tracker=tracker,
            daily_snapshot=snapshot
        )

        # If updating existing entry, clear old values first
        if not created:
            entry.clear_values()

        setattr(
            entry,
            serializer.value_field,
            serializer.validated_data[serializer.value_field],
        )
        entry.save()

        return Response(
            self.response_data(request.user, tracker, date_obj, entry),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

class TrackerDeleteView(generics.DestroyAPIView):
    serializer_class = TrackerSerializer

    def get_queryset(self):
        return Tracker.objects.filter(user=self.request.user)

class EntryDeleteView(generics.DestroyAPIView):
    serializer_class = EntrySerializer

    def get_queryset(self):
        return Entry.objects.filter(user=self.request.user)
