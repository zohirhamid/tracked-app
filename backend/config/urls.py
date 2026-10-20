from django.urls import include, path

urlpatterns = [
    # Allauth's app client issues X-Session-Token credentials to the static frontend.
    path("api/v1/_allauth/", include("allauth.headless.urls")),
    path('accounts/', include('allauth.urls')), #
    path("api/v1/tracker/", include("apps.tracker.urls")),
]
