from django.middleware.locale import LocaleMiddleware


class ApiLocaleMiddleware(LocaleMiddleware):
    """LocaleMiddleware for /api/ only: API messages follow Accept-Language, the admin does not."""

    def process_request(self, request):
        if request.path.startswith("/api/"):
            super().process_request(request)

    def process_response(self, request, response):
        if request.path.startswith("/api/"):
            return super().process_response(request, response)
        return response
