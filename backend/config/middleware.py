from django.conf import settings


class FrontendProxyHostMiddleware:
    """Use the allowlisted public frontend host for proxied OAuth requests."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        public_host = request.META.get("HTTP_X_TRACKED_PUBLIC_HOST", "")
        if public_host in settings.FRONTEND_PROXY_HOSTS:
            request.META["HTTP_HOST"] = public_host
        return self.get_response(request)
