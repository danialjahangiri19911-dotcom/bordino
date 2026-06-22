import logging

from rest_framework import status
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first, to get the standard error response
    response = exception_handler(exc, context)

    # Now log the 400 error reason
    if response is not None and response.status_code == status.HTTP_400_BAD_REQUEST:
        logging.warning("Bad request %s: %s", context["request"].path, response.data)

    return response
