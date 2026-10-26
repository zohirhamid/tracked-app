import importlib.util
import os
from pathlib import Path

import dj_database_url
from dotenv import dotenv_values, load_dotenv
from corsheaders.defaults import default_headers

# ─────────────────────────────────────────────
# BASE CONFIG
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")


def env_bool(name, *, default=False):
    value = os.getenv(name)
    if value is None:
        return default

    normalized = value.strip().lower()
    if normalized not in {"1", "true", "yes", "on", "0", "false", "no", "off"}:
        raise ValueError(f"{name} must be a boolean value")
    return normalized in {"1", "true", "yes", "on"}


SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set")

DEBUG = env_bool("DJANGO_DEBUG")

# Older local setups keep their Google credentials in backend/.env while the
# application settings live in the repository-root .env. Read only those OAuth
# values as a development fallback; do not import the second file's database or
# secret-key settings.
LOCAL_GOOGLE_ENV = dotenv_values(BASE_DIR / ".env") if DEBUG else {}

# Hostnames Django may serve, protecting against forged Host headers.
ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "tracked.zohirhamid.com",
    "api.tracked.zohirhamid.com",
    "tracked-app-production-8314.up.railway.app",
    "healthcheck.railway.app",
    ".railway.app",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# The Vite frontend runs on a separate origin during local development.
# Session cookies and the allauth app-session header must both be accepted.
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Support Python's IPv6 development-server URL.
    "http://[::]:5173",
    "http://[::1]:5173",
    "https://tracked.zohirhamid.com",
    "https://frontend-production-9e32.up.railway.app",
]

COOKIE_SECURE = env_bool("COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = COOKIE_SECURE
SESSION_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_SAMESITE = "None" if COOKIE_SECURE else "Lax"
SESSION_COOKIE_SAMESITE = "None" if COOKIE_SECURE else "Lax"

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [*default_headers, "x-session-token"]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::]:5173",
    "http://[::1]:5173",
    "https://tracked.zohirhamid.com",
    "https://frontend-production-9e32.up.railway.app",
]

# ─────────────────────────────────────────────
# APPLICATIONS
# ─────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    # Gives allauth access to the current domain through Django's Site model.
    "django.contrib.sites",
    "django.contrib.sessions",
    "django.contrib.messages",

    # Provides django-allauth's shared authentication infrastructure.
    "allauth",
    # Enables email/password signup, login, logout, and account management.
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.headless",

    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    # Local apps
    "apps.tracker",
]

# Optional dev-only apps (avoid hard failure if not installed)
if importlib.util.find_spec("django_extensions") is not None:
    INSTALLED_APPS.append("django_extensions")

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend", #
]

SITE_ID = 1 #

ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
# Lets users sign in immediately without first confirming their email address.
ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_UNIQUE_EMAIL = True
HEADLESS_ONLY = True

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    (
        "http://localhost:5173"
        if DEBUG
        else "https://frontend-production-9e32.up.railway.app"
    ),
).rstrip("/")

# Any provider failure that occurs before Allauth can recover the callback URL
# must return to the React app, never to Allauth's stock Django templates.
HEADLESS_FRONTEND_URLS = {
    "socialaccount_login_error": f"{FRONTEND_URL}/?social=google",
}

# ─────────────────────────────────────────────
# MIDDLEWARE
# ─────────────────────────────────────────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",

    # Adds allauth account information and helpers to each request.
    "allauth.account.middleware.AccountMiddleware",
]

# Google OAuth credentials belong in the environment or an Allauth SocialApp,
# never in source control. Allauth exposes the public client ID to the frontend
# configuration endpoint while keeping the client secret server-side.
GOOGLE_CLIENT_ID = (
    os.getenv("GOOGLE_CLIENT_ID") or LOCAL_GOOGLE_ENV.get("GOOGLE_CLIENT_ID") or ""
).strip()
GOOGLE_CLIENT_SECRET = (
    os.getenv("GOOGLE_CLIENT_SECRET")
    or LOCAL_GOOGLE_ENV.get("GOOGLE_CLIENT_SECRET")
    or ""
).strip()

GOOGLE_PROVIDER_SETTINGS = {
    # Request only the identity information required to create/sign in a
    # TRACKED account.
    "SCOPE": ["profile", "email"],
    # A short-lived online token is sufficient; no offline refresh token is
    # needed because Google is used only for authentication.
    "AUTH_PARAMS": {"access_type": "online"},
    "OAUTH_PKCE_ENABLED": True,
}

# Register environment credentials only when both are present. Otherwise, let
# django-allauth use the Google SocialApp stored in the database. Never register
# an empty APP block: it overrides a valid SocialApp and sends Google an empty
# client_id. A deployment should use one credential source, not both.
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    GOOGLE_PROVIDER_SETTINGS["APP"] = {
        "client_id": GOOGLE_CLIENT_ID,
        "secret": GOOGLE_CLIENT_SECRET,
        "key": "",
    }

SOCIALACCOUNT_PROVIDERS = {"google": GOOGLE_PROVIDER_SETTINGS}

# Google marks the returned email as verified. Allow that verified address to
# sign in to an existing email/password account and attach the Google identity
# so the same person does not end up with duplicate accounts.
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True

# ─────────────────────────────────────────────
# REST FRAMEWORK
# ─────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "allauth.headless.contrib.rest_framework.authentication.XSessionTokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}


# ─────────────────────────────────────────────
# URLS / WSGI
# ─────────────────────────────────────────────
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# ─────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ─────────────────────────────────────────────
# STATIC FILES
# ─────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Serve the compiled React frontend from the same origin as the API.
WHITENOISE_ROOT = BASE_DIR.parent / "frontend" / "dist"
WHITENOISE_INDEX_FILE = True

# ─────────────────────────────────────────────
# INTERNATIONALIZATION
# ─────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ─────────────────────────────────────────────
# DEFAULTS
# ─────────────────────────────────────────────
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

LOGIN_REDIRECT_URL = "/"  # redirect users to the homepage after logging in
