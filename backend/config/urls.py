from django.contrib import admin
from django.urls import path, include

from .views import csrf_view, public_config_view

urlpatterns = [
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/config/public/", public_config_view, name="public-config"),
    path("api/v1/auth/csrf/", csrf_view, name="csrf"),
    path("api/v1/_allauth/", include("allauth.headless.urls")),
    path("api/v1/tracker/", include("apps.tracker.urls")),
]
