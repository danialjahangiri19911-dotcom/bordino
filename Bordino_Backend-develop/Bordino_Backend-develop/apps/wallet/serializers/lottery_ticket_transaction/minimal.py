from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.wallet.models import LotteryTicketTransaction


class LotteryTicketTransactionSerializer(BaseModelSerializer):
    action_label = serializers.SerializerMethodField()
    amount_sum = serializers.SerializerMethodField()
    txn_count = serializers.CharField()

    class Meta:
        model = LotteryTicketTransaction
        fields = (
            "amount_sum",
            "action_label",
            "txn_count",
        )

    def get_amount_sum(self, obj):
        return str(-abs(obj["amount_sum"]))

    def get_action_label(self, obj):
        if int(obj["txn_count"]) > 1:
            return _("Buy {count} Tickets").format(count=obj["txn_count"])
        return _("Buy Ticket")
