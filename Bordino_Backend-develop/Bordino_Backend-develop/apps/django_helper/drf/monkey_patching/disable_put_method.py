from rest_framework.mixins import UpdateModelMixin


def _custom_partial_update(self, request, *args, **kwargs):
    kwargs["partial"] = True
    return self.copy_of_update_method(request, *args, **kwargs)


UpdateModelMixin.copy_of_update_method = UpdateModelMixin.update
del UpdateModelMixin.update
UpdateModelMixin.partial_update = _custom_partial_update
