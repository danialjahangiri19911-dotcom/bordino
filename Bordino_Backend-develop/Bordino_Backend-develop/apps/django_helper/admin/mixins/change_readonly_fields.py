class ChangeReadonlyFieldsMixin:
    change_readonly_fields = None

    def get_change_readonly_fields(self):
        if not self.change_readonly_fields:
            raise Exception(
                f"{self.__class__.__name__} must contain `change_readonly_fields` attribute"
            )

        return self.change_readonly_fields

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = super().get_readonly_fields(request, obj)

        if obj:
            readonly_fields = readonly_fields + self.get_change_readonly_fields()

        return readonly_fields
