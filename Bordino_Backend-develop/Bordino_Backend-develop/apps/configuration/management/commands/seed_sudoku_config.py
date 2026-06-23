from django.core.management.base import BaseCommand

from apps.configuration.enums import DifficultyLevel
from apps.configuration.models.game import GameConfiguration

GAME_NAME = "sudoku"

# Sensible defaults; tune later via the Django admin (Game configuration).
# timer is in seconds (0 = unlimited / no countdown).
DEFAULTS = {
    DifficultyLevel.EASY: {
        "timer": 900,
        "max_errors": 3,
        "hint_count": 5,
        "daily_score_limit": 0,
    },
    DifficultyLevel.MEDIUM: {
        "timer": 600,
        "max_errors": 3,
        "hint_count": 3,
        "daily_score_limit": 0,
    },
    DifficultyLevel.HARD: {
        "timer": 420,
        "max_errors": 3,
        "hint_count": 1,
        "daily_score_limit": 0,
    },
}


class Command(BaseCommand):
    help = "Seed default GameConfiguration rows for Sudoku (easy/medium/hard). Idempotent."

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for difficulty, values in DEFAULTS.items():
            _, was_created = GameConfiguration.objects.update_or_create(
                game_name=GAME_NAME,
                difficulty_level=difficulty,
                defaults={**values, "is_active": True},
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Sudoku config: {created} created, {updated} updated.")
        )
