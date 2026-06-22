# yourapp/views.py
from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import extend_schema

from apps.user_management.serializers.user.logout import LogoutSerializer


@extend_schema(tags=["auth"])
class LogoutView(mixins.CreateModelMixin, GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LogoutSerializer
