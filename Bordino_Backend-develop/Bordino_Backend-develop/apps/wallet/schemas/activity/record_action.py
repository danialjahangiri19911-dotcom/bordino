from drf_spectacular.utils import extend_schema

from apps.wallet.serializers.activity.record_action import RecordActionSerializer

record_action_schema = extend_schema(
    tags=["activity"],
    summary="Record Action",
    description="Record an action for the authenticated user. Creates an ActivityTransaction if it doesn't exist for this user/action combination.",
    request=RecordActionSerializer,
    responses={
        200: {
            "type": "object",
            "properties": {
                "message": {"type": "string"},
                "activity_transaction_id": {"type": "string"},
                "score_awarded": {"type": "integer"},
                "already_exists": {"type": "boolean"},
            },
        },
        400: {
            "type": "object",
            "properties": {
                "error": {"type": "string"},
            },
        },
    },
)
