import logging
from dataclasses import dataclass

from django.contrib.auth import get_user_model

from apps.user_management.repositories.otp.command import OTPCommandRepository
from apps.user_management.repositories.user.query import UserQueryRepository
from apps.user_management.services.otp.attempts import OtpAttempts
from apps.user_management.services.otp.utils import generate_random_code
from apps.user_management.services.sms.sms import SMSService

User = get_user_model()


class OtpNotSent(Exception):
    """The SMS could not be sent (provider error) or the number asked for too many codes."""

    def __init__(self, too_many=False):
        super().__init__("too many codes" if too_many else "sms failed")
        self.too_many = too_many


class OTPService:
    def __init__(self):
        self.otp_command_repository = OTPCommandRepository()
        self.otp_query_repository = UserQueryRepository()
        self.sms_service = SMSService()

    @dataclass
    class ResendDTO:
        phone_number: str

    def generate_otp(self):
        """
        Generate a random numeric OTP.
        """
        return generate_random_code()

    def resend_otp(self, dto: ResendDTO):
        """
        Resend the OTP for a phone number.
        Args:
            phone_number (str): The phone number to resend the OTP for.
        """
        refused = OtpAttempts(dto.phone_number).refuse_send()
        if refused:
            raise OtpNotSent(too_many=refused == "phone")
        try:
            user = self.otp_query_repository.filter_by_phone_number(dto.phone_number).first()

            otp = self.create_otp(dto.phone_number)
            sent = self.send_otp(dto.phone_number, otp)
        except User.DoesNotExist as e:
            logging.error("No user found with phone number %s : %s", dto.phone_number, e)
            return None
        except ValueError as e:
            logging.error("Multiple users found with phone number %s : %s", dto.phone_number, e)
            return None
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error resending OTP: %s", e)
            return None
        if not sent:
            # Never report a code as sent when it was not; and let the player retry at once.
            self.otp_command_repository.delete_otp(dto.phone_number)
            raise OtpNotSent()
        return user

    def send_otp(self, phone_number: str, otp: str) -> bool:
        """
        Send the OTP via SMS.
        Args:
            phone_number (str): The phone number to send the OTP to.
            otp (str): The OTP to send.
        Returns:
            bool: whether the SMS provider accepted it.
        """
        try:
            # Send the OTP (or log it in dev mode)
            return self.sms_service.send_sms(phone_number, otp) is not None

        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error sending OTP: %s", e)
            return False
        # TODO: Handle and raise an appropriate exception here when needed.

    def create_otp(self, phone_number: str):
        """
        Create an OTP, save it to Redis, and send it via SMS.
        Args:
            phone_number (str): The phone number to send the OTP to.
        """
        otp = self.generate_otp()
        self.otp_command_repository.create(phone_number, otp)

        return otp
