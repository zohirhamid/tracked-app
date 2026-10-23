from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.urls import include, path
from django.views.decorators.http import require_GET


def health_check(request):
    return JsonResponse({"status": "ok"})


@require_GET
def csrf_token(request):
    """Expose the token value to browser clients hosted on another origin."""
    return JsonResponse({"csrf_token": get_token(request)})


urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("api/health/", health_check, name="api_health_check"),
    path("api/v1/auth/csrf/", csrf_token, name="csrf_token"),
    # Allauth's app client issues X-Session-Token credentials to the React frontend.
    path("api/v1/_allauth/", include("allauth.headless.urls")),
    path('accounts/', include('allauth.urls')), #
    path("api/v1/tracker/", include("apps.tracker.urls")),
]
