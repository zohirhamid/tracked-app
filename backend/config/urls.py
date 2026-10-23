from django.http import JsonResponse
from django.urls import include, path


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("api/health/", health_check, name="api_health_check"),
    # Allauth's app client issues X-Session-Token credentials to the React frontend.
    path("api/v1/_allauth/", include("allauth.headless.urls")),
    path('accounts/', include('allauth.urls')), #
    path("api/v1/tracker/", include("apps.tracker.urls")),
]
