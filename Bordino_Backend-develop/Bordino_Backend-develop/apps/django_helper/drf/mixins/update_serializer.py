class UpdateSerializerMixin:
    serializer_update_class = None

    def get_serializer_update_class(self):
        if not self.serializer_update_class:
            raise Exception(
                f"{self.__class__.__name__} must contain `serializer_update_class` attribute"
            )

        return self.serializer_update_class

    def get_serializer_class(self):
        if self.action in ["update", "partial_update"]:
            return self.get_serializer_update_class()

        return super().get_serializer_class()
