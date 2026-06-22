class ListSerializerMixin:
    serializer_list_class = None

    def get_serializer_list_class(self):
        if not self.serializer_list_class:
            raise Exception(
                f"{self.__class__.__name__} must contain `serializer_list_class` attribute"
            )

        return self.serializer_list_class

    def get_serializer_class(self):
        if self.action == "list":
            return self.get_serializer_list_class()

        return super().get_serializer_class()
