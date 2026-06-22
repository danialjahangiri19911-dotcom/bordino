from django.utils.translation import gettext as _
from rest_framework.exceptions import NotFound

from apps.users.models.customer import Customer


class CurrentCustomerMixin:
    lookup_field = None
    lookup_url_kwarg = "id"

    main_lookup_field = "pk"

    def get_object(self):
        if self._check_to_return_current_user():
            try:
                return Customer.objects.get(user=self.request.user)
            except Customer.DoesNotExist as exc:
                raise NotFound(
                    {
                        "customer": [
                            _("customer does not exist."),
                        ]
                    }
                ) from exc

        self.lookup_field = self.main_lookup_field
        return super().get_object()

    def _check_to_return_current_user(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field

        return self.kwargs[lookup_url_kwarg] == "me"
