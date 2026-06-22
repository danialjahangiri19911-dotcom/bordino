from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.user_management.serializers.daily_usage.list import DailyUsageSerializer
from apps.users.models.dailyusage import DailyUsage


class DailyUsageListView(APIView):
    permission_classes = (IsAuthenticated,)
    pagination_class = CustomPageNumberPagination

    @extend_schema(
        tags=["onboarding"],
        summary="List Daily Usage Records",
        description="Get a paginated list of all daily usage records with their reward points.",
        responses={200: DailyUsageSerializer(many=True)},
        operation_id="list_daily_usage_records",
    )
    def get(self, request):
        queryset = DailyUsage.objects.all()
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = DailyUsageSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
