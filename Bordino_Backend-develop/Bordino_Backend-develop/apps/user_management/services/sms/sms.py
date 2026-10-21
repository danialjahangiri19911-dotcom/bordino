import logging

from django.conf import settings

from kavenegar import APIException, HTTPException, KavenegarAPI

from apps.user_management.services.utils import normalize_phone_number


class SMSService:
    def __init__(self):
        self.kavenegar_api_key = settings.KAVENEGAR_API_KEY

    def send_sms(self, phone_number, message):
        """
        Send an SMS using the Kave Negar API.
        Args:
            phone_number (str): The recipient's phone number.
            message (str): The message to send.
        """

        if settings.ENVIRONMENT == "dev":
            logging.info("Dev Mode: sending OTP for %s: %s", phone_number, message)

        try:
            phone_number = normalize_phone_number(phone_number)

            api = KavenegarAPI(self.kavenegar_api_key)
            params = {
                "receptor": phone_number,
                "template": settings.KAVENEGAR_OTP_TEMPLATE,
                "token": message,
                "type": "sms",
            }
            response = api.verify_lookup(params)
            return response
        except APIException as e:
            logging.error("Error while sending otp to %s : %s", phone_number, e)
        except HTTPException as e:
            logging.error("Error while sending otp to %s : %s", phone_number, e)
        return None
        # TODO: Handle and raise an appropriate exception here when needed.
