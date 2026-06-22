def updated_instance(instance, **kwargs):
    for key, value in kwargs.items():
        if hasattr(instance, key):
            field = instance._meta.get_field(key)  # pylint: disable=protected-access

            if field.many_to_many:
                if isinstance(value, list):
                    getattr(instance, key).set(value)
                else:
                    raise ValueError(f"Expected a list for ManyToManyField '{key}'")

            else:
                setattr(instance, key, value)
    instance.save()
    return instance
