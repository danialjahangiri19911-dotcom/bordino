import logging

from django.db import transaction

from apps.users.models.customer import Customer


class CustomerCommandRepository:
    @staticmethod
    def create(customer: Customer):
        try:
            with transaction.atomic():
                customer.registration_step = Customer.Step.PROFILE_SETUP
                customer.full_clean()
                customer.save()
            return customer
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error while creating customer: %s", e)
            return None
        # TODO: Handle and raise an appropriate exception here when needed.

    @staticmethod
    def update(customer: Customer):
        try:
            with transaction.atomic():
                customer.full_clean()
                customer.save()
            return customer
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error while updating customer: %s", e)
            return None
        # TODO: Handle and raise an appropriate exception here when needed.

    @staticmethod
    def updated_instance(instance, **kwargs):
        many_to_many_updates = {}
        regular_updates = {}

        for key, value in kwargs.items():
            if hasattr(instance, key):
                field = instance._meta.get_field(key)  # pylint: disable=protected-access

                # Handle ManyToManyField explicitly
                if field.many_to_many:
                    if isinstance(value, list):
                        many_to_many_updates[key] = value
                    else:
                        raise ValueError(f"Expected a list for ManyToManyField '{key}'")
                # Handle other field types
                else:
                    regular_updates[key] = value

        for key, value in regular_updates.items():
            setattr(instance, key, value)

        if regular_updates or many_to_many_updates:
            if instance.pk is None or regular_updates:
                instance.save()

        for key, value in many_to_many_updates.items():
            getattr(instance, key).set(value)

        return instance
