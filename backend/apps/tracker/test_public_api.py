from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Tracker


class AuthenticatedTrackerApiTests(APITestCase):
    def test_tracker_api_rejects_unauthenticated_requests(self):
        listing = self.client.get("/api/v1/tracker/trackers/")
        self.assertEqual(listing.status_code, 403)

    def test_tracker_api_allows_authenticated_requests(self):
        user = get_user_model().objects.create_user(
            username="tracker-user",
            email="tracker@example.com",
            password="correct horse battery staple",
        )
        self.client.force_authenticate(user=user)

        created = self.client.post(
            "/api/v1/tracker/trackers/create/",
            {"name": "Mood", "tracker_type": "rating"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertNotIn("user", created.json())

        month = self.client.get("/api/v1/tracker/month/2026/10/")
        self.assertEqual(month.status_code, 200)
        self.assertEqual(len(month.json()["trackers"]), 1)

    def test_entry_save_returns_updated_entry_and_monthly_summary(self):
        user = get_user_model().objects.create_user(
            username="entry-user",
            email="entry@example.com",
            password="correct horse battery staple",
        )
        self.client.force_authenticate(user=user)
        tracker = Tracker.objects.create(name="Mood", tracker_type="rating", max_value=5)

        created = self.client.post(
            "/api/v1/tracker/entries/create/",
            {"tracker_id": tracker.id, "date": "2026-10-18", "rating_value": 4},
            format="json",
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["entry"]["rating_value"], 4)
        self.assertEqual(created.json()["summary"]["tracker_id"], tracker.id)
        self.assertEqual(created.json()["summary"]["display"], "4.0/5")
        self.assertEqual(created.json()["summary"]["count"], 1)

        deleted = self.client.post(
            "/api/v1/tracker/entries/create/",
            {"tracker_id": tracker.id, "date": "2026-10-18", "delete_entry": True},
            format="json",
        )

        self.assertEqual(deleted.status_code, 200)
        self.assertIsNone(deleted.json()["entry"])
        self.assertEqual(deleted.json()["summary"]["display"], "—")
        self.assertEqual(deleted.json()["summary"]["count"], 0)
