import logging
from dataclasses import dataclass

from django.db import transaction
from django.utils.crypto import get_random_string

from apps.user_management.repositories.customer.command import CustomerCommandRepository
from apps.user_management.repositories.customer.query import CustomerQueryRepository
from apps.user_management.repositories.otp.command import OTPCommandRepository
from apps.user_management.repositories.referral_code.command import ReferralCodeCommandRepository
from apps.user_management.repositories.user.command import UserCommandRepository
from apps.user_management.repositories.user.query import UserQueryRepository
from apps.user_management.services.otp.otp import OTPService
from apps.users.models.customer import Customer
from apps.users.models.user import User
from apps.wallet.services.currency_wallet_account.creation import (
    CurrencyWalletAccountCreationService,
)
from apps.wallet.services.token_wallet_account.creation import TokenWalletAccountCreationService
from apps.wallet.services.wallet.creation import WalletCreationService


class UserRegistrationService:
    def __init__(self):
        self.user_command_repository = UserCommandRepository()
        self.user_query_repository = UserQueryRepository()
        self.otp_command_repository = OTPCommandRepository()
        self.otp_service = OTPService()
        self.referral_code_command_repository = ReferralCodeCommandRepository()
        self.customer_query_repository = CustomerQueryRepository()
        self.customer_command_repository = CustomerCommandRepository()
        self.wallet_service = WalletCreationService()
        self.currency_wallet_account_service = CurrencyWalletAccountCreationService()
        self.token_wallet_account_service = TokenWalletAccountCreationService()

    @dataclass
    class RegisterDTO:
        phone_number: str

    @dataclass
    class LoginDTO:
        phone_number: str
        referral_code: str = None

    def register(self, dto: RegisterDTO):
        with transaction.atomic():
            user, created = self._create_user(dto)
            if created:
                otp_code = self._create_sms_otp(user)
                self._send_sms(user.phone_number, otp_code)
                self._create_customer_for_user(user)
                self._create_wallet_for_user(user)

        return user, created

    def login(self, dto: LoginDTO):
        try:
            user = self._get_user(dto)
            with transaction.atomic():
                self.otp_command_repository.mark_otp_as_used(dto.phone_number)
                if not user.is_active:
                    UserRegistrationService.activate(user)

                if dto.referral_code:
                    # کد معرف نباید ورود را مسدود کند. اگر نامعتبر بود فقط همین بخش
                    # (savepoint داخلی) لغو می‌شود و کاربر همچنان با موفقیت وارد می‌شود.
                    try:
                        with transaction.atomic():
                            self._validate_and_store_referral_code(dto.referral_code, user)
                    except ValueError as e:
                        logging.warning(
                            "Ignoring invalid referral code '%s' for %s: %s",
                            dto.referral_code,
                            dto.phone_number,
                            e,
                        )

            return user

        except User.DoesNotExist as e:
            logging.error("No user found with phone number %s : %s", dto.phone_number, e)
            return None
        except ValueError as e:
            logging.error("Multiple users found with phone number %s : %s", dto.phone_number, e)
            return None
            raise
        except Exception as e:  # pylint: disable=broad-exception-caught
            logging.error("Unexpected error while login user : %s", e)
            return None
        # TODO: Handle and raise an appropriate exception here when needed.

    def _validate_and_store_referral_code(self, referral_code: str, user: User):
        try:
            customer = self.customer_query_repository.all().get(user=user)
            if customer.invited_by:
                raise ValueError("User already has a referral")

            referrer_customer = self.customer_query_repository.filter_by_referral_code(
                referral_code
            )

            if referrer_customer.user == user:
                raise ValueError("Cannot use your own referral code")

            if not referrer_customer.user.is_active:
                raise ValueError("Referrer is not active")

            self.referral_code_command_repository.save(user.phone_number, referral_code)
        except Customer.DoesNotExist:
            raise ValueError("Invalid referral code")
        except ValueError:
            raise
        except Exception as e:
            logging.error("Error validating referral code: %s", e)
            raise ValueError("Invalid referral code") from e

    @staticmethod
    def activate(user: User):
        user.is_active = True
        user.save()

    def issue_token(self, user: User):
        return self.user_command_repository.issue_token(user)

    def _get_user(self, dto: LoginDTO):
        return self.user_query_repository.filter_by_phone_number(dto.phone_number).first()

    def _create_user(self, dto: RegisterDTO):
        created = False
        try:
            user = self.user_query_repository.filter_by_phone_number(dto.phone_number)
            return user, created
        except User.DoesNotExist:
            user_model = User(
                phone_number=dto.phone_number,
                is_active=True,
            )
            user = self.user_command_repository.create(user_model)
            created = True

            return user, created
        # TODO: Handle and raise an appropriate exception here when needed.

    def _create_sms_otp(self, user: User):
        return self.otp_service.create_otp(user.phone_number)

    def _send_sms(self, phone_number, code):
        self.otp_service.send_otp(phone_number, code)

    def _create_wallet_for_user(self, user: User):
        wallet = self.wallet_service.create_wallet(self.wallet_service.CreateWalletDTO(user))
        self.currency_wallet_account_service.create_currency_wallet_account_by_system(
            self.currency_wallet_account_service.CreateCurrencyWalletAccountDTO(
                wallet=wallet, name="کیف پول ریالی", symbol="IRR", primary=True
            )
        )
        self.token_wallet_account_service.create_token_wallet_account_by_system(
            self.token_wallet_account_service.CreateTokenWalletAccountDTO(
                wallet=wallet, name="کیف پول امتیاز بوردینو", symbol="L"
            )
        )

    def _create_customer_for_user(self, user: User):
        try:
            existing_customer = self.customer_query_repository.all().get(user=user)
            return existing_customer
        except Customer.DoesNotExist:
            pass

        stored_referral_code = self.referral_code_command_repository.get(user.phone_number)
        referrer_user = None

        if stored_referral_code:
            try:
                referrer_customer = self.customer_query_repository.filter_by_referral_code(
                    stored_referral_code
                )
                if referrer_customer.user != user and referrer_customer.user.is_active:
                    referrer_user = referrer_customer.user
                    self.referral_code_command_repository.delete(user.phone_number)
            except (Customer.DoesNotExist, ValueError) as e:
                logging.warning(
                    "Invalid referral code %s for user %s: %s",
                    stored_referral_code,
                    user.phone_number,
                    e,
                )

        referral_code = self._generate_referral_code()

        customer_model = Customer(
            user=user,
            gender=Customer.Gender.UNSET,
            birthdate=None,
            referral_code=referral_code,
            invited_by=referrer_user,
            registration_step=Customer.Step.REGISTRATION,
        )
        customer = self.customer_command_repository.create(customer_model)

        if not customer:
            logging.error("Failed to create customer for user %s", user.id)
            raise ValueError("Failed to create customer")

        return customer

    def _generate_referral_code(self):
        max_attempts = 10
        for _ in range(max_attempts):
            code = get_random_string(length=6, allowed_chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
            if not Customer.objects.filter(referral_code=code).exists():
                return code
        raise ValueError("Failed to generate unique referral code")
