import importlib
import os
from types import SimpleNamespace
from unittest.mock import patch

from django.apps import apps
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import DailySnapshot, Entry, Tracker
from .serializers import EntryWriteSerializer


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
        tracker = Tracker.objects.create(
            user=user,
            name="Mood",
            tracker_type="rating",
            max_value=5,
        )

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

    def test_users_cannot_access_or_mutate_each_others_tracking_data(self):
        owner = get_user_model().objects.create_user(
            username="owner",
            email="owner@example.com",
            password="a-secure-test-password",
        )
        other_user = get_user_model().objects.create_user(
            username="other-user",
            email="other@example.com",
            password="a-secure-test-password",
        )
        owner_tracker = Tracker.objects.create(
            user=owner,
            name="Private mood",
            tracker_type="rating",
            min_value=1,
            max_value=5,
        )
        owner_snapshot = DailySnapshot.objects.create(
            user=owner,
            date="2026-10-18",
        )
        owner_entry = Entry.objects.create(
            user=owner,
            tracker=owner_tracker,
            daily_snapshot=owner_snapshot,
            rating_value=4,
        )

        self.client.force_authenticate(user=other_user)

        tracker_list = self.client.get("/api/v1/tracker/trackers/")
        self.assertEqual(tracker_list.status_code, 200)
        self.assertEqual(tracker_list.json(), [])

        month = self.client.get("/api/v1/tracker/month/2026/10/")
        self.assertEqual(month.status_code, 200)
        self.assertEqual(month.json()["trackers"], [])
        self.assertTrue(
            all(not day["entries"] for week in month.json()["weeks"] for day in week)
        )

        update = self.client.patch(
            f"/api/v1/tracker/trackers/{owner_tracker.id}/",
            {"name": "Changed"},
            format="json",
        )
        self.assertEqual(update.status_code, 404)

        create_entry = self.client.post(
            "/api/v1/tracker/entries/create/",
            {
                "tracker_id": owner_tracker.id,
                "date": "2026-10-18",
                "rating_value": 1,
            },
            format="json",
        )
        self.assertEqual(create_entry.status_code, 404)

        delete_entry = self.client.delete(
            f"/api/v1/tracker/entries/{owner_entry.id}/delete/"
        )
        self.assertEqual(delete_entry.status_code, 404)

        delete_tracker = self.client.delete(
            f"/api/v1/tracker/trackers/{owner_tracker.id}/delete/"
        )
        self.assertEqual(delete_tracker.status_code, 404)

        owner_tracker.refresh_from_db()
        owner_entry.refresh_from_db()
        self.assertEqual(owner_tracker.name, "Private mood")
        self.assertEqual(owner_entry.rating_value, 4)

    def test_new_tracking_records_are_owned_by_authenticated_user(self):
        user = get_user_model().objects.create_user(
            username="record-owner",
            email="record-owner@example.com",
            password="a-secure-test-password",
        )
        self.client.force_authenticate(user=user)

        tracker_response = self.client.post(
            "/api/v1/tracker/trackers/create/",
            {"name": "Sleep", "tracker_type": "duration"},
            format="json",
        )
        self.assertEqual(tracker_response.status_code, 201)
        tracker = Tracker.objects.get(pk=tracker_response.json()["id"])
        self.assertEqual(tracker.user, user)

        entry_response = self.client.post(
            "/api/v1/tracker/entries/create/",
            {
                "tracker_id": tracker.id,
                "date": "2026-10-20",
                "duration_minutes": 480,
            },
            format="json",
        )
        self.assertEqual(entry_response.status_code, 201)
        entry = Entry.objects.get(pk=entry_response.json()["entry_id"])
        self.assertEqual(entry.user, user)
        self.assertEqual(entry.daily_snapshot.user, user)

    def test_malformed_and_missing_typed_values_return_400(self):
        user = get_user_model().objects.create_user(
            username="validation-user",
            email="validation@example.com",
            password="a-secure-test-password",
        )
        self.client.force_authenticate(user=user)
        cases = [
            ("number", {"number_value": "not-a-number"}),
            ("time", {"time_value": "25:99"}),
            ("duration", {"duration_minutes": "several"}),
            ("rating", {"rating_value": "high"}),
        ]

        for index, (tracker_type, value) in enumerate(cases):
            with self.subTest(tracker_type=tracker_type):
                tracker = Tracker.objects.create(
                    user=user,
                    name=f"Invalid {tracker_type}",
                    tracker_type=tracker_type,
                )
                response = self.client.post(
                    "/api/v1/tracker/entries/create/",
                    {
                        "tracker_id": tracker.id,
                        "date": f"2026-10-{index + 1:02d}",
                        **value,
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, 400, response.content)
                self.assertFalse(Entry.objects.filter(tracker=tracker).exists())

        for tracker_type in (
            "binary", "number", "time", "duration", "text", "rating", "prayer"
        ):
            with self.subTest(tracker_type=tracker_type, missing=True):
                tracker = Tracker.objects.create(
                    user=user,
                    name=f"Missing {tracker_type}",
                    tracker_type=tracker_type,
                )
                response = self.client.post(
                    "/api/v1/tracker/entries/create/",
                    {"tracker_id": tracker.id, "date": "2026-11-01"},
                    format="json",
                )
                self.assertEqual(response.status_code, 400, response.content)
                self.assertIn(
                    EntryWriteSerializer.value_field_by_type[tracker_type],
                    response.json(),
                )

    def test_production_ownership_migration_requires_verified_backup(self):
        user = get_user_model().objects.create_user(
            username="migration-owner",
            email="migration-owner@example.com",
            password="a-secure-test-password",
        )
        Tracker.objects.create(
            user=user,
            name="Existing tracker",
            tracker_type="binary",
        )
        migration = importlib.import_module(
            "apps.tracker.migrations.0014_add_per_user_ownership"
        )
        schema_editor = SimpleNamespace(
            connection=SimpleNamespace(alias="default", vendor="postgresql")
        )

        with patch.dict(
            os.environ,
            {"TRACKER_OWNERSHIP_BACKUP_VERIFIED": ""},
        ):
            with self.assertRaisesRegex(RuntimeError, "backup"):
                migration.assign_legacy_data_to_oldest_account(apps, schema_editor)
