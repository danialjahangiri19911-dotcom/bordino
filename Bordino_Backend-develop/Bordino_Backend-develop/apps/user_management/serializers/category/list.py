from apps.django_helper.drf.serializers import BaseModelSerializer
from apps.users.models.category import Category
from apps.wallet.serializers.wallet.fields import AbsoluteURLField


class CategorySerializer(BaseModelSerializer):
    icon = AbsoluteURLField()

    class Meta:
        model = Category
        fields = ("name", "icon")
