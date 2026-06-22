from rest_framework.renderers import JSONRenderer

from apps.django_helper.drf.responses.standard import StandardResponse


class CustomJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        status_code = int(renderer_context["response"].status_code)
        clean_data = StandardResponse(status_code, data).generate_body()

        return super().render(clean_data, accepted_media_type, renderer_context)
