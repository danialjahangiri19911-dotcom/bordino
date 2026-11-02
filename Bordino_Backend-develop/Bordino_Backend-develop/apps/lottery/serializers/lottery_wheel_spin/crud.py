from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import LotteryWheel, LotteryWheelSpin
from apps.lottery.serializers.lottery_wheel_prize.minimal import LotteryWheelPrizeMinimalSerializer
from apps.lottery.services.lottery.lottery_wheel import LotteryWheelService
from apps.wallet.models import TokenWalletAccount
from apps.wallet.services import balance
from apps.wallet.services.utils import get_max_negative_limit, would_deduction_exceed_negative_limit


class LotteryWheelSpinCRUDSerializer(BaseModelSerializer):
    # Only active wheels take new spins (checked in validate and the service); a retry of a spin
    # made before the wheel was switched off still gets its answer.
    lottery_wheel = serializers.PrimaryKeyRelatedField(queryset=LotteryWheel.objects.all())
    # Accepted for old clients and ignored: the spin is always paid from the player's own points
    # account, which the server picks (an id from the client could name anyone's account).
    token_wallet_account = serializers.PrimaryKeyRelatedField(
        queryset=TokenWalletAccount.objects.all(), write_only=True, required=False
    )
    multiplier = serializers.IntegerField(
        min_value=1, max_value=5, default=1, write_only=True, required=False
    )
    # The player's bet (between the wheel's min_bet and max_bet); absent = cost_per_spin.
    bet = serializers.IntegerField(min_value=1, required=False, write_only=True)
    # Required (the app always sends one): a retry after a lost answer is the same spin, charged once.
    request_id = serializers.CharField(max_length=64, write_only=True)
    prize = LotteryWheelPrizeMinimalSerializer(read_only=True)

    class Meta:
        model = LotteryWheelSpin
        fields = (
            "lottery_wheel",
            "token_wallet_account",
            "multiplier",
            "bet",
            "request_id",
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
                    multiplier=validated_data.get("multiplier", 1),
                    bet=validated_data.get("bet"),
                    request_id=validated_data.get("request_id"),
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
        token_wallet_account = balance.points_account(user)
        if token_wallet_account is None:
            raise serializers.ValidationError(_("Points account not found."))
        validated_data["token_wallet_account"] = token_wallet_account
        # A retry of a spin that already happened: the service returns it (no limit checks here,
        # the player may be at the limit because of that very spin).
        from apps.lottery.models import LotteryWheelSpinLog  # pylint: disable=import-outside-toplevel

        request_id = validated_data.get("request_id")
        if request_id and LotteryWheelSpinLog.objects.filter(customer=user.customer, request_id=request_id).exists():
            return validated_data
        if lottery_wheel.status != LotteryWheel.Status.ACTIVE:
            raise serializers.ValidationError(_("This wheel is not active."))

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

        bet = validated_data.get("bet")
        if bet is not None and not lottery_wheel.cost_per_spin:
            raise serializers.ValidationError(_("این گردونه رایگان است و شرط نمی‌پذیرد."))
        # A paid wheel's range holds for every spin: a request without `bet` costs cost_per_spin,
        # which must be inside it too.
        effective = bet if bet is not None else int(lottery_wheel.cost_per_spin)
        if lottery_wheel.cost_per_spin and not lottery_wheel.min_bet <= effective <= lottery_wheel.max_bet:
            raise serializers.ValidationError(
                _("شرط باید بین %(min)s و %(max)s امتیاز باشد.") % {"min": lottery_wheel.min_bet, "max": lottery_wheel.max_bet}
            )
        if would_deduction_exceed_negative_limit(
            token_wallet_account.amount,
            bet if bet is not None else lottery_wheel.cost_per_spin,
            get_max_negative_limit(token_wallet_account),
        ):
            raise serializers.ValidationError(
                _("Cannot spin: would exceed maximum negative points limit.")
            )

        return validated_data
