from django.contrib.auth import get_user_model

from apps.configuration.repositories.game import GameConfigurationQueryRepository
from apps.configuration.services.scoring.dto import AwardScoreDTO
from apps.configuration.services.scoring.record_action_result import RecordActionResult
from apps.configuration.services.scoring.service import ScoreService
from apps.wallet.models import GamePlayCharge
from apps.wallet.repositories.activity_transaction import ActivityTransactionQueryRepository

User = get_user_model()

# Sections whose rewards come from a game charged per play (GamePlayChargeService game names).
PAID_GAMES = ("sudoku", "game_2048")


class RecordActionService:
    @staticmethod
    def record_action(
        user: User,
        section: str,
        action_type: str,
        metadata: dict | None = None,
        description: str | None = None,
    ) -> RecordActionResult:
        if not hasattr(user, "customer"):
            raise ValueError("User does not have a customer profile")

        customer = user.customer
        section = section.lower() if section else section

        existing_transaction = ActivityTransactionQueryRepository.get_by_customer_section_action(
            customer=customer,
            section=section,
            action_type=action_type,
        )

        if existing_transaction:
            if section in ["sudoku", "game_2048"]:
                game_config = GameConfigurationQueryRepository.filter_by_game_name(
                    game_name=section
                ).first()

                if game_config and game_config.daily_score_limit > 0:
                    current_daily_score = ScoreService.get_user_daily_score(user, section)
                    if current_daily_score >= game_config.daily_score_limit:
                        return RecordActionResult(
                            activity_transaction=existing_transaction,
                            already_exists=True,
                            message="Action already recorded and daily limit reached",
                        )

            return RecordActionResult(
                activity_transaction=existing_transaction,
                already_exists=True,
                message="Action already recorded",
            )

        # Sudoku and 2048 run in the browser, so the server cannot see a game being won; it can
        # see that one was paid for. No paid play of that game, no reward for it (each action
        # pays once per customer, see above).
        if section in PAID_GAMES and not GamePlayCharge.objects.filter(
            customer=customer, game_name=section
        ).exists():
            raise ValueError("Play the game before its rewards can be recorded")

        score_service = ScoreService()
        activity_transaction = score_service.award_score(
            AwardScoreDTO(
                user=user,
                section=section,
                action_type=action_type,
                metadata=metadata,
                description=description,
            )
        )

        return RecordActionResult(
            activity_transaction=activity_transaction,
            already_exists=False,
            message="Action recorded successfully",
        )
