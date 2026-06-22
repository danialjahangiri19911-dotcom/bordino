from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.lottery.models import Ticket


class TicketMinimalSerializer(BaseModelSerializer):
    class Meta:
        model = Ticket
        fields = ("name", "numbers")
