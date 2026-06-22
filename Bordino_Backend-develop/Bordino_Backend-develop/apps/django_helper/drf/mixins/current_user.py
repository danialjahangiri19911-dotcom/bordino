class CurrentUserMixin:
    lookup_field = None
    lookup_url_kwarg = "identifier"

    main_lookup_field = "pk"

    def get_object(self):
        if self._check_to_return_current_user():
            return self.request.user

        self.lookup_field = self.main_lookup_field
        return super().get_object()

    def _check_to_return_current_user(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field

        return self.kwargs[lookup_url_kwarg] == "me"
