import json

from django.contrib.auth import get_user_model
from django.contrib.sites.models import Site
from django.test import Client, override_settings
from allauth.socialaccount.models import SocialApp
from rest_framework.test import APITestCase


class AllauthFrontendIntegrationTests(APITestCase):
    @override_settings(
        SOCIALACCOUNT_PROVIDERS={
            "google": {
                "SCOPE": ["profile", "email"],
                "AUTH_PARAMS": {"access_type": "online"},
                "OAUTH_PKCE_ENABLED": True,
            }
        }
    )
    def test_google_button_can_start_backend_redirect_flow(self):
        site = Site.objects.get(pk=1)
        google_app = SocialApp.objects.create(
            provider="google",
            name="Google",
            client_id="test-client.apps.googleusercontent.com",
            secret="test-secret",
        )
        google_app.sites.add(site)

        client = Client(enforce_csrf_checks=True, HTTP_HOST="localhost")
        config = client.get("/api/v1/_allauth/browser/v1/config")
        self.assertEqual(config.status_code, 200)
        google_provider = next(
            provider
            for provider in config.json()["data"]["socialaccount"]["providers"]
            if provider["id"] == "google"
        )
        self.assertEqual(
            google_provider["client_id"],
            "test-client.apps.googleusercontent.com",
        )
        csrf = client.get(
            "/api/v1/auth/csrf/",
            HTTP_ORIGIN="http://localhost:5173",
        )
        self.assertEqual(csrf.status_code, 200)
        self.assertEqual(
            csrf["Access-Control-Allow-Origin"],
            "http://localhost:5173",
        )
        csrf_token = csrf.json()["csrf_token"]
        self.assertTrue(csrf_token)

        response = client.post(
            "/api/v1/_allauth/browser/v1/auth/provider/redirect",
            {
                "csrfmiddlewaretoken": csrf_token,
                "provider": "google",
                "process": "login",
                "callback_url": "http://localhost:5173/?social=google",
            },
            HTTP_ORIGIN="http://localhost:5173",
            HTTP_REFERER="http://localhost:5173/",
        )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].startswith("https://accounts.google.com/"))

        failure = client.get(
            "/accounts/google/login/callback/?error=access_denied",
        )
        self.assertEqual(failure.status_code, 302)
        self.assertTrue(
            failure["Location"].startswith("http://localhost:5173/?"),
            failure["Location"],
        )
        self.assertIn("error=", failure["Location"])

    def test_frontend_origin_can_send_the_session_token_header(self):
        for origin in ("http://localhost:5173", "http://[::]:5173"):
            with self.subTest(origin=origin):
                response = self.client.options(
                    "/api/v1/tracker/trackers/",
                    HTTP_ORIGIN=origin,
                    HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
                    HTTP_ACCESS_CONTROL_REQUEST_HEADERS="x-session-token",
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response["Access-Control-Allow-Origin"], origin)
                self.assertIn(
                    "x-session-token",
                    response["Access-Control-Allow-Headers"].lower(),
                )

    def test_signup_token_authenticates_tracker_api_and_can_sign_out(self):
        signup = self.client.post(
            "/api/v1/_allauth/app/v1/auth/signup",
            {"email": "new-user@example.com", "password": "a-secure-test-password"},
            format="json",
        )
        self.assertEqual(signup.status_code, 200, signup.content)
        token = signup.json()["meta"]["session_token"]

        self.client.credentials(HTTP_X_SESSION_TOKEN=token)
        session = self.client.get("/api/v1/_allauth/app/v1/auth/session")
        self.assertEqual(session.status_code, 200)
        self.assertEqual(session.json()["data"]["user"]["email"], "new-user@example.com")

        account_setup = self.client.get("/api/v1/tracker/profile/username/")
        self.assertEqual(account_setup.status_code, 200)
        self.assertFalse(account_setup.json()["is_complete"])

        username = self.client.post(
            "/api/v1/tracker/profile/username/",
            {"username": "new_user"},
            format="json",
        )
        self.assertEqual(username.status_code, 200, username.content)
        self.assertEqual(username.json()["username"], "new_user")
        self.assertTrue(username.json()["is_complete"])
        self.assertEqual(
            get_user_model().objects.get(email="new-user@example.com").username,
            "new_user",
        )

        trackers = self.client.get("/api/v1/tracker/trackers/")
        self.assertEqual(trackers.status_code, 200)

        signed_out = self.client.delete("/api/v1/_allauth/app/v1/auth/session")
        self.assertEqual(signed_out.status_code, 401)

        rejected = self.client.get("/api/v1/tracker/trackers/")
        self.assertEqual(rejected.status_code, 403)

        self.client.credentials()
        login = self.client.post(
            "/api/v1/_allauth/app/v1/auth/login",
            {"email": "new-user@example.com", "password": "a-secure-test-password"},
            format="json",
        )
        self.assertEqual(login.status_code, 200, login.content)
        new_token = login.json()["meta"]["session_token"]
        self.assertNotEqual(new_token, token)

        self.client.credentials(HTTP_X_SESSION_TOKEN=new_token)
        accepted = self.client.get("/api/v1/tracker/trackers/")
        self.assertEqual(accepted.status_code, 200)

    def test_browser_session_csrf_can_complete_username_setup(self):
        user = get_user_model().objects.create_user(
            username="google-user-initial",
            email="google-user@example.com",
        )
        client = Client(enforce_csrf_checks=True, HTTP_HOST="localhost")
        client.force_login(user)
        origin = "http://localhost:5173"

        csrf = client.get("/api/v1/auth/csrf/", HTTP_ORIGIN=origin)
        csrf_token = csrf.json()["csrf_token"]
        response = client.post(
            "/api/v1/tracker/profile/username/",
            data=json.dumps({"username": "google_user"}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
            HTTP_ORIGIN=origin,
            HTTP_REFERER=f"{origin}/",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["username"], "google_user")
        self.assertTrue(response.json()["is_complete"])

    def test_browser_session_rejects_missing_csrf_token(self):
        user = get_user_model().objects.create_user(
            username="csrf-missing",
            email="csrf-missing@example.com",
        )
        client = Client(enforce_csrf_checks=True, HTTP_HOST="localhost")
        client.force_login(user)

        response = client.post(
            "/api/v1/tracker/profile/username/",
            data=json.dumps({"username": "csrf_missing"}),
            content_type="application/json",
            HTTP_ORIGIN="http://localhost:5173",
            HTTP_REFERER="http://localhost:5173/",
        )

        self.assertEqual(response.status_code, 403)

    def test_browser_session_rejects_untrusted_origin(self):
        user = get_user_model().objects.create_user(
            username="csrf-origin",
            email="csrf-origin@example.com",
        )
        client = Client(enforce_csrf_checks=True, HTTP_HOST="localhost")
        client.force_login(user)
        csrf = client.get(
            "/api/v1/auth/csrf/",
            HTTP_ORIGIN="http://localhost:5173",
        )
        csrf_token = csrf.json()["csrf_token"]

        response = client.post(
            "/api/v1/tracker/profile/username/",
            data=json.dumps({"username": "csrf_origin"}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
            HTTP_ORIGIN="https://attacker.example",
            HTTP_REFERER="https://attacker.example/",
        )

        self.assertEqual(response.status_code, 403)

    def test_csrf_token_response_is_not_cacheable(self):
        response = self.client.get(
            "/api/v1/auth/csrf/",
            HTTP_ORIGIN="http://localhost:5173",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)
        self.assertIn("no-cache", response["Cache-Control"])
        self.assertIn("no-store", response["Cache-Control"])

    def test_username_must_be_unique_ignoring_case(self):
        current_user = get_user_model().objects.create_user(
            username="current-user",
            email="current@example.com",
            password="a-secure-test-password",
        )
        get_user_model().objects.create_user(
            username="AlreadyUsed",
            email="other@example.com",
            password="a-secure-test-password",
        )
        self.client.force_authenticate(user=current_user)

        response = self.client.post(
            "/api/v1/tracker/profile/username/",
            {"username": "alreadyused"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["username"], ["This username is already taken."])
