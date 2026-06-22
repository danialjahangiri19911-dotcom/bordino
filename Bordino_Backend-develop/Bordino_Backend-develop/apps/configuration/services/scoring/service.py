from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db import models, transaction
from django.utils import timezone

from apps.configuration.models.game import GameConfiguration
from apps.configuration.repositories.game import GameConfigurationQueryRepository
from apps.configuration.repositories.scoring import ScoreConfigurationQueryRepository
from apps.configuration.services.scoring.dto import AwardScoreDTO
from apps.wallet.models.transactions.activity import ActivityTransaction
from apps.wallet.repositories.activity_transaction import (
    ActivityTransactionCommandRepository,
    ActivityTransactionQueryRepository,
)

User = get_user_model()


def _get_score_config_for_section(
    section: str,
    action_type: str,
    difficulty: str | None = None,
):
    section = section.lower() if section else section
    game_config = GameConfigurationQueryRepository.get_by_game_name(
        game_name=section,
        difficulty_level=difficulty,
    )
    if game_config:
        content_type = ContentType.objects.get_for_model(GameConfiguration)
        config = ScoreConfigurationQueryRepository.get_active_config_by_content_object(
            content_type_id=content_type.id,
            object_id=game_config.id,
            action_type=action_type,
        )
        if config:
            return config
    return ScoreConfigurationQueryRepository.get_active_config(section, action_type)


class ScoreService:
    @staticmethod
    def get_score_for_action(
        section: str,
        action_type: str,
    ) -> int | None:
        config = _get_score_config_for_section(section, action_type)
        return config.score_value if config else None

    @staticmethod
    def get_user_daily_score(user: User, section: str) -> int:
        if not hasattr(user, "customer"):
            return 0

        section = section.lower() if section else section
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        queryset = ActivityTransactionQueryRepository.filter_by_customer_and_section(
            customer=user.customer,
            section=section,
        ).filter(
            status=ActivityTransaction.Status.COMPLETED,
            create_time__gte=today_start,
            create_time__lt=today_end,
        )

        result = queryset.aggregate(total=models.Sum("score_value"))["total"]
        return result or 0

    @transaction.atomic
    def award_score(self, dto: AwardScoreDTO) -> ActivityTransaction:
        dto.section = dto.section.lower() if dto.section else dto.section
        difficulty = (dto.metadata or {}).get("difficulty")
        config = _get_score_config_for_section(dto.section, dto.action_type, difficulty=difficulty)

        if not config:
            raise ValueError(
                f"No active score configuration found for section='{dto.section}', "
                f"action_type='{dto.action_type}'"
            )

        if not hasattr(dto.user, "customer"):
            raise ValueError(f"User {dto.user.id} does not have a customer profile")

        customer = dto.user.customer

        if dto.section in ["sudoku", "game_2048"]:
            game_config_query = GameConfigurationQueryRepository.get_by_game_name(
                game_name=dto.section,
                difficulty_level=difficulty,
            )

            if game_config_query and game_config_query.daily_score_limit > 0:
                current_daily_score = ScoreService.get_user_daily_score(dto.user, dto.section)
                new_score = current_daily_score + config.score_value

                if new_score > game_config_query.daily_score_limit:
                    remaining = game_config_query.daily_score_limit - current_daily_score
                    if remaining <= 0:
                        raise ValueError(
                            f"Daily score limit ({game_config_query.daily_score_limit}) reached for {dto.section}. "
                            f"Current daily score: {current_daily_score}"
                        )
                    else:
                        config.score_value = remaining

        description = dto.description or (
            f"Score awarded: {config.score_value} points for {dto.section}/{dto.action_type}"
        )

        activity_transaction = ActivityTransaction(
            customer=customer,
            section=dto.section,
            action_type=dto.action_type,
            score_value=config.score_value,
            reward_data={"score": config.score_value},
            metadata=dto.metadata or {},
            status=ActivityTransaction.Status.COMPLETED,
            description=description,
        )

        return ActivityTransactionCommandRepository.create(activity_transaction)

    @staticmethod
    def get_user_total_score(user: User, section: str | None = None) -> int:
        if not hasattr(user, "customer"):
            return 0

        queryset = ActivityTransactionQueryRepository.filter_by_customer(
            customer=user.customer
        ).filter(status=ActivityTransaction.Status.COMPLETED)

        if section:
            section = section.lower()
            queryset = ActivityTransactionQueryRepository.filter_by_customer_and_section(
                customer=user.customer, section=section
            ).filter(status=ActivityTransaction.Status.COMPLETED)

        result = queryset.aggregate(total=models.Sum("score_value"))["total"]
        return result or 0

    @staticmethod
    def get_user_score_history(
        user: User,
        section: str | None = None,
        action_type: str | None = None,
        limit: int | None = None,
    ) -> list[ActivityTransaction]:
        if not hasattr(user, "customer"):
            return []

        queryset = ActivityTransactionQueryRepository.filter_by_customer(customer=user.customer)

        if section:
            section = section.lower()
            queryset = ActivityTransactionQueryRepository.filter_by_customer_and_section(
                customer=user.customer, section=section
            )

        if action_type:
            queryset = queryset.filter(action_type=action_type)

        queryset = queryset.order_by("-create_time")

        if limit:
            queryset = queryset[:limit]

        return list(queryset)
