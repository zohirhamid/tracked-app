from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase


class AllauthFrontendIntegrationTests(APITestCase):
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
