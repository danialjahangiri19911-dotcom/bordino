import logging
from dataclasses import dataclass
from datetime import datetime

from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.configuration.models import SystemConfiguration
from apps.user_management.repositories.category.query import CategoryQueryRepository
from apps.user_management.repositories.customer.command import CustomerCommandRepository
from apps.user_management.repositories.signup_reason.query import SignupReasonQueryRepository
from apps.user_management.repositories.user.command import UserCommandRepository
from apps.users.models.customer import Customer
from apps.wallet.models import Token
from apps.wallet.repositories.token_wallet_account.query import TokenWalletAccountQueryRepository
from apps.wallet.repositories.wallet.query import WalletQueryRepository


class CustomerUpdateService:  # pylint: disable=too-many-instance-attributes
    def __init__(self):
        self.user_command_repository = UserCommandRepository()
        self.customer_command_repository = CustomerCommandRepository()
        self.category_query_repository = CategoryQueryRepository()
        self.signup_reason_query_repository = SignupReasonQueryRepository()
        self.wallet_query_repository = WalletQueryRepository()
        self.token_wallet_account_query_repository = TokenWalletAccountQueryRepository()
        self.step_order = {
            Customer.Step.OTP_VERIFICATION: 1,
            Customer.Step.PROFILE_SETUP: 2,
            Customer.Step.DAILY_USAGE_TIME: 3,
            Customer.Step.USAGE_GOAL: 4,
            Customer.Step.INTEREST_SELECTION: 5,
        }
        self.step_sequence = [
            Customer.Step.OTP_VERIFICATION,
            Customer.Step.PROFILE_SETUP,
            Customer.Step.DAILY_USAGE_TIME,
            Customer.Step.USAGE_GOAL,
            Customer.Step.INTEREST_SELECTION,
        ]

    @dataclass
    class StepProfileSetupDTO:
        customer: Customer
        username: str
        birthdate: datetime
        gender: str

    @dataclass
    class StepDailyUsageTimeDTO:
        customer: Customer
        daily_usage_minutes: str

    @dataclass
    class StepUsageGoalDTO:
        customer: Customer
        signup_reasons: list[str]

    @dataclass
    class StepInterestSelectionDTO:
        customer: Customer
        favorite_categories: list[str]

    def update_step_profile_setup(self, dto: StepProfileSetupDTO):
        try:
            next_step = self._get_next_step(Customer.Step.PROFILE_SETUP)
            registration_step = self._check_registration_step(
                dto.customer.registration_step, next_step
            )
            with transaction.atomic():
                updated_customer = self.customer_command_repository.updated_instance(
                    instance=dto.customer,
                    birthdate=dto.birthdate,
                    gender=dto.gender,
                    registration_step=registration_step,
                )
                customer = self.customer_command_repository.update(updated_customer)
                self.user_command_repository.change_username(dto.customer.user, dto.username)
            return customer
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error updating customer: %s", e)
            return None

    def update_step_daily_usage_time(self, dto: StepDailyUsageTimeDTO):
        try:
            next_step = self._get_next_step(Customer.Step.DAILY_USAGE_TIME)
            registration_step = self._check_registration_step(
                dto.customer.registration_step, next_step
            )
            with transaction.atomic():
                updated_customer = self.customer_command_repository.updated_instance(
                    instance=dto.customer,
                    daily_usage_minutes=dto.daily_usage_minutes,
                    registration_step=registration_step,
                )
                customer = self.customer_command_repository.update(updated_customer)
            return customer
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error updating customer: %s", e)
            return None
        # TODO: Handle and raise an appropriate exception here when needed.

    def update_step_usage_goal(self, dto: StepUsageGoalDTO):
        try:
            next_step = self._get_next_step(Customer.Step.USAGE_GOAL)
            registration_step = self._check_registration_step(
                dto.customer.registration_step, next_step
            )
            signup_reasons = list(
                self.signup_reason_query_repository.filter_by_reasons(dto.signup_reasons)
            )
            with transaction.atomic():
                updated_customer = self.customer_command_repository.updated_instance(
                    instance=dto.customer,
                    signup_reasons=signup_reasons,
                    registration_step=registration_step,
                )
                customer = self.customer_command_repository.update(updated_customer)
            return customer
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error updating customer: %s", e)
            return None
        # TODO: Handle and raise an appropriate exception here when needed.

    def update_step_interest_selection(self, dto: StepInterestSelectionDTO):
        try:
            next_step = self._get_next_step(Customer.Step.INTEREST_SELECTION)
            registration_step = self._check_registration_step(
                dto.customer.registration_step, next_step
            )
            favorite_categories = list(
                self.category_query_repository.filter_by_names(names=dto.favorite_categories)
            )
            with transaction.atomic():
                updated_customer = self.customer_command_repository.updated_instance(
                    instance=dto.customer,
                    favorite_categories=favorite_categories,
                    registration_step=registration_step,
                )
                customer = self.customer_command_repository.update(updated_customer)

                wallet = self.wallet_query_repository.filter_by_user(customer.user).first()
                if not wallet:
                    logging.error("Wallet not found for user %s", customer.user.id)
                    raise ValidationError(_("Wallet not found. Please contact support."))

                token = Token.objects.filter(symbol="L").first()
                if not token:
                    logging.error("Token with symbol 'L' not found")
                    raise ValidationError(_("Token not found. Please contact support."))

                token_wallet_account = (
                    self.token_wallet_account_query_repository.filter_by_customer_and_token(
                        customer, token
                    ).first()
                )

                if not token_wallet_account:
                    logging.error("Token wallet account not found for customer %s", customer.id)
                    raise ValidationError(
                        _("Token wallet account not found. Please contact support.")
                    )

                self._award_complete_profile_points(customer, token_wallet_account)

            return customer
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error updating customer: %s", e)
            return None
        # TODO: Handle and raise an appropriate exception here when needed.

    def _get_next_step(self, completed_step):
        try:
            idx = self.step_sequence.index(completed_step)
            if idx < len(self.step_sequence) - 1:
                return self.step_sequence[idx + 1]
        except (ValueError, IndexError):
            pass
        return completed_step

    def _check_registration_step(self, current_step, target_step):
        current_index = self.step_order[current_step]
        target_index = self.step_order[target_step]

        return current_step if current_index > target_index else target_step

    def _award_complete_profile_points(self, customer: Customer, token_wallet_account):
        try:
            if not token_wallet_account:
                logging.warning(
                    "Token wallet account not provided. Cannot award complete profile points."
                )
                raise ValidationError(
                    _("Token wallet account not provided. Cannot award complete profile points.")
                )

            if not token_wallet_account.token or token_wallet_account.token.symbol != "L":
                logging.warning(
                    "Token wallet account does not have points token (L). Cannot award complete profile points."
                )
                raise ValidationError(
                    _(
                        "Token wallet account does not have points token (L). Cannot award complete profile points."
                    )
                )

            reward_points = SystemConfiguration.objects.get("COMPLETE_PROFILE_REWARD_POINTS", 25)
            token_wallet_account.amount += reward_points
            token_wallet_account.save(update_fields=["amount"])
            logging.info(
                "Awarded %d points to customer %s for completing profile",
                reward_points,
                customer.user.username,
            )
        except Exception as e:
            logging.error("Error awarding complete profile points: %s", e)
