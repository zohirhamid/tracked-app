from datetime import date
import calendar
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import logout
from django.http import JsonResponse
from django.utils import timezone
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


class AccountExportView(generics.GenericAPIView):
    """Download the signed-in user's LIFELOG data without auth secrets."""

    def get(self, request):
        user = request.user
        setup = AccountSetup.objects.filter(user=user).first()
        trackers = list(
            Tracker.objects.filter(user=user)
            .order_by("display_order", "created_at")
            .values(
                "id",
                "name",
                "group_name",
                "tracker_type",
                "unit",
                "display_order",
                "is_active",
                "min_value",
                "max_value",
                "color_rule",
                "created_at",
            )
        )
        snapshots = list(
            DailySnapshot.objects.filter(user=user)
            .order_by("date")
            .values("id", "date")
        )
        entries = list(
            Entry.objects.filter(user=user)
            .order_by("daily_snapshot__date", "tracker_id")
            .values(
                "id",
                "tracker_id",
                "daily_snapshot_id",
                "daily_snapshot__date",
                "binary_value",
                "number_value",
                "time_value",
                "duration_minutes",
                "text_value",
                "rating_value",
                "prayer_values",
                "created_at",
                "updated_at",
            )
        )
        email_addresses = list(
            EmailAddress.objects.filter(user=user)
            .order_by("email")
            .values("email", "verified", "primary")
        )
        social_accounts = list(
            SocialAccount.objects.filter(user=user)
            .order_by("provider", "uid")
            .values("provider", "uid", "extra_data")
        )

        payload = {
            "format_version": 1,
            "exported_at": timezone.now(),
            "account": {
                "id": user.pk,
                "email": user.email,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "date_joined": user.date_joined,
                "last_login": user.last_login,
                "username_setup_complete": bool(setup and setup.username_is_set),
            },
            "authentication": {
                "email_addresses": email_addresses,
                "social_accounts": social_accounts,
            },
            "trackers": trackers,
            "daily_snapshots": snapshots,
            "entries": entries,
        }
        response = JsonResponse(payload, json_dumps_params={"indent": 2})
        response["Cache-Control"] = "no-store"
        response["Content-Disposition"] = (
            f'attachment; filename="lifelog-export-{timezone.localdate().isoformat()}.json"'
        )
        return response


class AccountDeleteView(generics.GenericAPIView):
    """Permanently delete the signed-in user and all cascading account data."""

    def delete(self, request):
        if request.data.get("confirmation") != "DELETE":
            raise ValidationError({
                "confirmation": 'Type "DELETE" to confirm permanent account deletion.'
            })

        user = request.user
        logout(request)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
