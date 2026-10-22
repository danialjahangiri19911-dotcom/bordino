# yourapp/views.py
from rest_framework import mixins
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import GenericViewSet

from drf_spectacular.utils import extend_schema

from apps.user_management.serializers.user.logout import LogoutSerializer


@extend_schema(tags=["auth"])
class LogoutView(mixins.CreateModelMixin, GenericViewSet):
    # Logout must work with an expired access token too: the refresh token in the body is what
    # it ends, and anyone holding it may end it. No authentication class, so an expired or
    # revoked Authorization header is not a 401 here (the serializer reads it itself).
    authentication_classes = ()
    permission_classes = [AllowAny]
    serializer_class = LogoutSerializer
