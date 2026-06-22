from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.users.models.signup_reason import SignupReason
from apps.wallet.serializers.wallet.fields import AbsoluteURLField


class SignupReasonSerializer(BaseModelSerializer):
    icon = AbsoluteURLField()

    class Meta:
        model = SignupReason
        fields = ("reason", "icon")
