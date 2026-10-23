from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.configuration.repositories.game import GameConfigurationQueryRepository
from apps.configuration.services.scoring.dto import AwardScoreDTO
from apps.configuration.services.scoring.record_action_result import RecordActionResult
from apps.configuration.services.scoring.service import ScoreService
from apps.wallet.models import GamePlayCharge
from apps.wallet.repositories.activity_transaction import ActivityTransactionQueryRepository

User = get_user_model()

# Sections whose rewards come from a game charged per play (GamePlayChargeService game names).
PAID_GAMES = ("sudoku", "game_2048")
RECENT_PLAY = timedelta(hours=3)


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
        # A paid play of this game in the last few hours (not "ever"): the reward must follow a
        # game the player actually started.
        if section in PAID_GAMES and not GamePlayCharge.objects.filter(
            customer=customer,
            game_name=section,
            create_time__gte=timezone.now() - RECENT_PLAY,
        ).exists():
            raise ValueError("Play the game before its rewards can be recorded")

        score_service = ScoreService()
        try:
            activity_transaction = score_service.award_score(
                AwardScoreDTO(
                    user=user,
                    section=section,
                    action_type=action_type,
                    metadata=metadata,
                    description=description,
                )
            )
        except (IntegrityError, ValidationError):
            # Another claim for the same action got there first (unique per customer): one
            # reward, and this request reports it like any repeat.
            existing = ActivityTransactionQueryRepository.get_by_customer_section_action(
                customer=customer, section=section, action_type=action_type
            )
            if existing is None:
                raise
            return RecordActionResult(
                activity_transaction=existing,
                already_exists=True,
                message="Action already recorded",
            )

        return RecordActionResult(
            activity_transaction=activity_transaction,
            already_exists=False,
            message="Action recorded successfully",
        )
