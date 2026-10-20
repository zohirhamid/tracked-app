import os
import importlib.util
from pathlib import Path
from dotenv import load_dotenv, dotenv_values
import dj_database_url
from corsheaders.defaults import default_headers

# ─────────────────────────────────────────────
# BASE CONFIG
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv()

def _parse_bool(value, *, default=False):
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set")

_debug_raw = os.getenv("DJANGO_DEBUG")
if _debug_raw is None:
    # Avoid collisions with platform-provided DEBUG values like "release".
    _env_debug = os.getenv("DEBUG")
    if _env_debug is not None and str(_env_debug).strip().lower() in {
        "1", "true", "yes", "on", "0", "false", "no", "off",
    }:
        _debug_raw = _env_debug
    else:
        _dotenv_path = BASE_DIR / ".env"
        if _dotenv_path.exists():
            _debug_raw = dotenv_values(_dotenv_path).get("DEBUG")

DEBUG = _parse_bool(_debug_raw, default=False)

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "tracked.zohirhamid.com",
    "api.tracked.zohirhamid.com",
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

# The static frontend runs on a separate origin during local development.
# Session cookies and the allauth app-session header must both be accepted.
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Support Python's IPv6 development-server URL.
    "http://[::]:5173",
    "http://[::1]:5173",
    "https://tracked.zohirhamid.com",
]

_cookie_secure_raw = os.getenv("COOKIE_SECURE")
COOKIE_SECURE = (
    not DEBUG
    if _cookie_secure_raw is None
    else _parse_bool(_cookie_secure_raw, default=not DEBUG)
)
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
HEADLESS_ONLY = False

# ─────────────────────────────────────────────
# MIDDLEWARE
# ─────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",

    # Adds allauth account information and helpers to each request.
    "allauth.account.middleware.AccountMiddleware",
]

# Google OAuth credentials belong in the environment, never in source control.
# The client ID is also safe to expose through a public-config API when the
# frontend initializes Google Identity Services; the client secret is not.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        # Register the Google OAuth application directly from environment
        # variables instead of requiring a SocialApp record in Django admin.
        "APP": {
            "client_id": GOOGLE_CLIENT_ID,
            "secret": GOOGLE_CLIENT_SECRET,
            "key": "",
        },
        # Request only the identity information required to create/sign in a
        # TRACKED account.
        "SCOPE": ["profile", "email"],
        # A short-lived online token is sufficient; no offline refresh token
        # is needed because Google is used only for authentication.
        "AUTH_PARAMS": {"access_type": "online"},
    }
}

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
USE_POSTGRES = os.getenv("USE_POSTGRES", "False") == "True"

if USE_POSTGRES:
    DATABASES = {
        "default": dj_database_url.config(
            default=os.getenv("DATABASE_URL"),
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
