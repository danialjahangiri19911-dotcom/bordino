import logging
from dataclasses import dataclass

from django.contrib.auth import get_user_model

from apps.user_management.repositories.otp.command import OTPCommandRepository
from apps.user_management.repositories.user.query import UserQueryRepository
from apps.user_management.services.otp.utils import generate_random_code
from apps.user_management.services.sms.sms import SMSService

User = get_user_model()


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
        try:
            user = self.otp_query_repository.filter_by_phone_number(dto.phone_number).first()

            otp = self.create_otp(dto.phone_number)
            self.send_otp(dto.phone_number, otp)

            return user
        except User.DoesNotExist as e:
            logging.error("No user found with phone number %s : %s", dto.phone_number, e)
            return None
        except ValueError as e:
            logging.error("Multiple users found with phone number %s : %s", dto.phone_number, e)
            return None
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error resending OTP: %s", e)
            return None
        # TODO: Handle and raise an appropriate exception here when needed.

    def send_otp(self, phone_number: str, otp: str):
        """
        Send the OTP via SMS.
        Args:
            phone_number (str): The phone number to send the OTP to.
            otp (str): The OTP to send.
        """
        try:
            # Send the OTP (or log it in dev mode)
            self.sms_service.send_sms(phone_number, otp)

        except Exception as e:  # pylint: disable=broad-except
            logging.error("Error sending OTP: %s", e)
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
