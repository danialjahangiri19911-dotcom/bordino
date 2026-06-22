from rest_framework import mixins
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import extend_schema

from apps.user_management.serializers.user.registration import UserRegistrationSerializer


@extend_schema(tags=["auth"])
class UserRegistrationView(mixins.CreateModelMixin, GenericViewSet):
    serializer_class = UserRegistrationSerializer
    permission_classes = (AllowAny,)
