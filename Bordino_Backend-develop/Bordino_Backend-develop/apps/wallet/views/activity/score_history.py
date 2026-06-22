from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.configuration.services.scoring import ScoreService
from apps.wallet.serializers.activity.score_history import ActivityTransactionSerializer


class ScoreHistoryView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=["activity"],
        summary="Get User Score History",
        description="Get the authenticated user's score history. Can be filtered by section and action_type, and limited by count.",
        parameters=[
            OpenApiParameter(
                name="section",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter by section (e.g., 'sudoku', 'game_2048', 'watch_video', 'click_ad', 'questionnaire', 'signup')",
            ),
            OpenApiParameter(
                name="action_type",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter by action type",
            ),
            OpenApiParameter(
                name="limit",
                type=int,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Limit the number of results returned",
            ),
        ],
        responses={200: ActivityTransactionSerializer(many=True)},
    )
    def get(self, request):
        user = request.user

        if not hasattr(user, "customer"):
            return Response(
                {"error": "User does not have a customer profile"},
                status=400,
            )

        section = request.query_params.get("section")
        action_type = request.query_params.get("action_type")
        limit = request.query_params.get("limit")

        if limit:
            try:
                limit = int(limit)
                if limit < 1:
                    raise ValidationError({"limit": "Limit must be a positive integer"})
            except ValueError:
                raise ValidationError({"limit": "Limit must be a valid integer"})

        history = ScoreService.get_user_score_history(
            user=user,
            section=section,
            action_type=action_type,
            limit=limit,
        )

        serializer = ActivityTransactionSerializer(history, many=True)
        return Response(serializer.data)
