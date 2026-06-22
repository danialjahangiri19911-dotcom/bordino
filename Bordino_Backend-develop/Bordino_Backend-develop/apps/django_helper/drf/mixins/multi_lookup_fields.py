from django.http import Http404


class MultiLookUpFieldsMixin:
    # pylint: disable=inconsistent-return-statements

    lookup_field = None
    lookup_url_kwarg = "identifier"

    lookup_fields = ()

    def get_object(self):
        lookup_fields = self.get_lookup_fields()
        last_lookup_field = lookup_fields[-1]

        for lookup_field in lookup_fields:
            self.lookup_field = lookup_field

            try:
                return super().get_object()
            except Http404 as err:
                if lookup_field == last_lookup_field:
                    raise err

    def get_lookup_fields(self):
        try:
            lookup_fields = self.lookup_fields
        except AttributeError as err:
            raise Exception(
                f"Please add 'lookup_fields' class attribute to the '{self.__class__.__name__}'"
                "or override the 'get_lookup_fields' method in it."
            ) from err

        return lookup_fields
