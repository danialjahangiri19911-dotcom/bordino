from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.user_management.serializers.signup_reason.list import SignupReasonSerializer
from apps.users.models.signup_reason import SignupReason


class SignupReasonListView(APIView):
    permission_classes = (IsAuthenticated,)
    pagination_class = CustomPageNumberPagination

    @extend_schema(
        tags=["onboarding"],
        summary="List Usage Goal Options",
        description="Get a paginated list of all available usage goal options.",
        responses={200: SignupReasonSerializer(many=True)},
        operation_id="list_usage_goal_options",
    )
    def get(self, request):
        queryset = SignupReason.objects.all()
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = SignupReasonSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
