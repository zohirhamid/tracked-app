from django.test import SimpleTestCase


class HealthCheckTests(SimpleTestCase):
    def test_api_health_check_is_public_for_railway_hosts(self):
        for host in (
            "healthcheck.railway.app",
            "tracked-app-production.up.railway.app",
        ):
            with self.subTest(host=host):
                response = self.client.get("/api/health/", HTTP_HOST=host)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), {"status": "ok"})
