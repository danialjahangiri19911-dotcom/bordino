import logging
from dataclasses import dataclass
from datetime import datetime

from django.db import transaction
from django.utils.crypto import get_random_string

from apps.user_management.repositories.customer.command import CustomerCommandRepository
from apps.user_management.repositories.customer.query import CustomerQueryRepository
from apps.user_management.repositories.referral_code.command import ReferralCodeCommandRepository
from apps.user_management.repositories.user.command import UserCommandRepository
from apps.users.models.customer import Customer
from apps.users.models.user import User


class CustomerRegistrationService:
    def __init__(self):
        self.user_command_repository = UserCommandRepository()
        self.customer_command_repository = CustomerCommandRepository()
        self.customer_query_repository = CustomerQueryRepository()
        self.referral_code_command_repository = ReferralCodeCommandRepository()

    @dataclass
    class RegisterDTO:
        user: User
        username: str
        birthdate: datetime
        gender: str
        referral_code: str = None

    def register(self, dto: RegisterDTO):
        with transaction.atomic():
            customer = self._create_customer(dto)
            self.user_command_repository.change_username(dto.user, dto.username)

        return customer

    def _create_customer(self, dto: RegisterDTO):
        referral_code = dto.referral_code
        if not referral_code:
            referral_code = self.referral_code_command_repository.get(dto.user.phone_number)

        referrer_user = None
        if referral_code:
            referrer_user = self._resolve_referrer(referral_code, dto.user)
            self.referral_code_command_repository.delete(dto.user.phone_number)

        new_referral_code = self._generate_referral_code()

        customer_model = Customer(
            user=dto.user,
            birthdate=dto.birthdate,
            gender=dto.gender,
            invited_by=referrer_user,
            referral_code=new_referral_code,
        )
        customer = self.customer_command_repository.create(customer_model)

        if not customer:
            raise ValueError("Failed to create customer")

        return customer

    def _resolve_referrer(self, referral_code: str, current_user: User):
        try:
            referrer_customer = self.customer_query_repository.filter_by_referral_code(
                referral_code
            )

            if referrer_customer.user == current_user:
                raise ValueError("Cannot use your own referral code")

            if not referrer_customer.user.is_active:
                raise ValueError("Referrer is not active")

            return referrer_customer.user
        except Customer.DoesNotExist:
            raise ValueError("Invalid referral code")
        except Exception as e:
            logging.error("Error resolving referrer: %s", e)
            raise ValueError("Invalid referral code") from e

    def _generate_referral_code(self):
        max_attempts = 10
        for _ in range(max_attempts):
            code = get_random_string(length=6, allowed_chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
            if not Customer.objects.filter(referral_code=code).exists():
                return code
        raise ValueError("Failed to generate unique referral code")
