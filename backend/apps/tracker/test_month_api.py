from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import DailySnapshot, Entry, Tracker


class MonthApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="month-owner",
            email="owner@example.com",
            password="test-password",
        )
        self.other_user = user_model.objects.create_user(
            username="other-owner",
            email="other@example.com",
            password="test-password",
        )
        self.tracker = Tracker.objects.create(
            user=self.user,
            name="Mood",
            tracker_type="rating",
            min_value=1,
            max_value=5,
            display_order=1,
        )
        self.client.force_authenticate(self.user)

    def month_url(self, year, month):
        return reverse("tracker:month_view", kwargs={"year": year, "month": month})

    def test_month_get_has_every_day_without_creating_snapshots(self):
        response = self.client.get(self.month_url(2026, 10))

        self.assertEqual(response.status_code, 200)
        days = [day for week in response.data["weeks"] for day in week]
        self.assertEqual(len(days), 31)
        self.assertEqual(days[0]["date"], "2026-10-01")
        self.assertEqual(days[-1]["date"], "2026-10-31")
        self.assertEqual(DailySnapshot.objects.count(), 0)

    def test_month_get_handles_leap_year(self):
        response = self.client.get(self.month_url(2028, 2))

        days = [day for week in response.data["weeks"] for day in week]
        self.assertEqual(len(days), 29)
        self.assertEqual(days[-1]["date"], "2028-02-29")

    def test_month_get_handles_thirty_day_month(self):
        response = self.client.get(self.month_url(2026, 4))

        days = [day for week in response.data["weeks"] for day in week]
        self.assertEqual(len(days), 30)
        self.assertEqual(days[-1]["date"], "2026-04-30")

    def test_month_get_rejects_invalid_month(self):
        response = self.client.get(self.month_url(2026, 13))

        self.assertEqual(response.status_code, 400)

    def test_month_data_is_user_scoped_and_includes_summary(self):
        snapshot = DailySnapshot.objects.create(user=self.user, date=date(2026, 10, 1))
        Entry.objects.create(tracker=self.tracker, daily_snapshot=snapshot, rating_value=4)

        other_tracker = Tracker.objects.create(
            user=self.other_user,
            name="Private",
            tracker_type="number",
        )
        other_snapshot = DailySnapshot.objects.create(
            user=self.other_user,
            date=date(2026, 10, 1),
        )
        Entry.objects.create(
            tracker=other_tracker,
            daily_snapshot=other_snapshot,
            number_value=999,
        )

        response = self.client.get(self.month_url(2026, 10))
        trackers = response.data["trackers"]
        days = [day for week in response.data["weeks"] for day in week]

        self.assertEqual([tracker["id"] for tracker in trackers], [self.tracker.id])
        self.assertEqual(days[0]["entries"][self.tracker.id]["rating_value"], 4)
        self.assertEqual(response.data["summaries"][0]["display"], "4.0/5")
