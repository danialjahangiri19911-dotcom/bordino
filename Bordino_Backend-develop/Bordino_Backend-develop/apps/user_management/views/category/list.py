from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.django_helper.drf.pagination.custom_page_number import CustomPageNumberPagination
from apps.user_management.serializers.category.list import CategorySerializer
from apps.users.models.category import Category


class CategoryListView(APIView):
    permission_classes = (IsAuthenticated,)
    pagination_class = CustomPageNumberPagination

    @extend_schema(
        tags=["onboarding"],
        summary="List Interest Selection Options",
        description="Get a paginated list of all interest selection options.",
        responses={200: CategorySerializer(many=True)},
        operation_id="list_interest_selection_options",
    )
    def get(self, request):
        queryset = Category.objects.all()
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = CategorySerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
