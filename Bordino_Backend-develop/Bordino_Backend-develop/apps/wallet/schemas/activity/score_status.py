from drf_spectacular.utils import OpenApiParameter, extend_schema

score_status_schema = extend_schema(
    tags=["activity"],
    summary="Validate score status",
    description="Returns whether the user is out of score",
    parameters=[
        OpenApiParameter(
            name="token_wallet_account_id",
            type=str,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Token wallet account ID. If omitted, uses the user's last active points account.",
        ),
    ],
    responses={
        200: {
            "type": "object",
            "properties": {
                "balance": {"type": "integer"},
                "max_negative_allowed": {"type": "integer"},
            },
        },
    },
)
