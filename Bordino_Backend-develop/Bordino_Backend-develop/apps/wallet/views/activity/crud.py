from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.configuration.services.scoring import RecordActionService
from apps.wallet.schemas.activity.record_action import record_action_schema
from apps.wallet.serializers.activity.record_action import RecordActionSerializer


# What the app may record by itself: events that pay nothing and prove nothing. Anything that pays
# is decided by the server (Sudoku board rewards: apps/crash sudoku; ads: ad_reward), never by a
# request saying it happened — e.g. «game_2048 win_game» after one paid play.
APP_EVENTS = {
    ("sudoku", "start_game"),
    ("sudoku", "hint_used"),
    ("sudoku", "game_over"),
    ("sudoku", "max_mistakes_reached"),
}


class RecordActionCRUDView(GenericViewSet):
    serializer_class = RecordActionSerializer
    permission_classes = (IsAuthenticated,)

    @record_action_schema
    @action(detail=False, methods=["post"], url_path="record-action")
    def record_action(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        section = (serializer.validated_data["section"] or "").lower()
        if (section, serializer.validated_data["action_type"]) not in APP_EVENTS:
            return Response(
                {"error": "This action is not recorded from the app."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = RecordActionService.record_action(
                user=request.user,
                section=serializer.validated_data["section"],
                action_type=serializer.validated_data["action_type"],
                metadata=serializer.validated_data.get("metadata", {}),
                description=serializer.validated_data.get("description"),
                # The app's own report proves nothing: never paid, whatever the configuration says.
                event_only=True,
            )

            response_status = (
                status.HTTP_200_OK if result.already_exists else status.HTTP_201_CREATED
            )

            return Response(
                {
                    "message": result.message,
                    "activity_transaction_id": str(result.activity_transaction.id),
                    "score_awarded": result.activity_transaction.score_value or 0,
                    "already_exists": result.already_exists,
                },
                status=response_status,
            )
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
