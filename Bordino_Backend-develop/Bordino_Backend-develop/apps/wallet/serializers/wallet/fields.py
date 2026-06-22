from rest_framework import serializers


class AbsoluteURLField(serializers.Field):
    def __init__(self, **kwargs):
        kwargs["read_only"] = True
        super().__init__(**kwargs)

    def to_representation(self, value):
        if not value:
            return None

        url = None
        if hasattr(value, "file"):
            url = value.file.url if value.file else None
        elif isinstance(value, str):
            url = value
        else:
            return None

        if not url:
            return None

        request = self.context.get("request")
        if request:
            if url.startswith("http://") or url.startswith("https://"):
                return url
            return request.build_absolute_uri(url)
        return url
