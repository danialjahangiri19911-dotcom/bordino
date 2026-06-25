from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import LotteryWheelSpin
from apps.lottery.serializers.lottery_wheel_prize.minimal import LotteryWheelPrizeMinimalSerializer
from apps.lottery.services.lottery.lottery_wheel import LotteryWheelService
from apps.wallet.models import TokenWalletAccount
from apps.wallet.services.utils import get_max_negative_limit, would_deduction_exceed_negative_limit


class LotteryWheelSpinCRUDSerializer(BaseModelSerializer):
    token_wallet_account = serializers.PrimaryKeyRelatedField(
        queryset=TokenWalletAccount.objects.all(), write_only=True
    )
    prize = LotteryWheelPrizeMinimalSerializer(read_only=True)

    class Meta:
        model = LotteryWheelSpin
        fields = (
            "lottery_wheel",
            "token_wallet_account",
            "prize",
            "count",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.lottery_wheel_serive = LotteryWheelService()

    def create(self, validated_data):
        try:
            selected_prize, spin = self.lottery_wheel_serive.spin_wheel(
                self.lottery_wheel_serive.SpinWheelDTO(
                    customer=self.context["request"].user.customer,
                    lottery_wheel=validated_data["lottery_wheel"],
                    token_wallet_account=validated_data["token_wallet_account"],
                )
            )
            # Add the prize to the spin instance for serialization
            spin.prize = selected_prize
            return spin
        except DjangoValidationError as e:
            detail = serializers.as_serializer_error(e)
            raise DRFValidationError(detail) from e

    def validate(self, validated_data):
        lottery_wheel = validated_data["lottery_wheel"]
        user = self.context["request"].user
        token_wallet_account = validated_data["token_wallet_account"]

        # Check total spins for the wheel (only this wheel)
        total_spins = (
            LotteryWheelSpin.objects.filter(lottery_wheel=lottery_wheel)
            .aggregate(Sum("count"))
            .get("count__sum")
            or 0
        )

        if total_spins >= lottery_wheel.max_spins:
            raise serializers.ValidationError(_("Maximum spins for this wheel has been reached"))

        # check spins limit for current user
        try:
            customer_spins = LotteryWheelSpin.objects.get(
                lottery_wheel=lottery_wheel, customer=user.customer
            ).count

            if customer_spins >= lottery_wheel.max_spins_per_customer:
                raise serializers.ValidationError(
                    _("You have reached your maximum spins for this wheel")
                )
        except LotteryWheelSpin.DoesNotExist:
            pass

        if would_deduction_exceed_negative_limit(
            token_wallet_account.amount,
            lottery_wheel.cost_per_spin,
            get_max_negative_limit(token_wallet_account),
        ):
            raise serializers.ValidationError(
                _("Cannot spin: would exceed maximum negative points limit.")
            )

        return validated_data
