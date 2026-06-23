from django.core.management.base import BaseCommand

from apps.configuration.models.scoring import ScoreConfiguration

SECTION = "sudoku"

# action_type -> default score value (0 = recorded but no points).
# Every action_type the frontend records must exist here, otherwise the
# record-action endpoint returns an error for that action.
# Values are tunable later via the Django admin (Score configuration).
SCORES = {
    "start_game": 0,
    "hint_used": 0,
    "game_over": 0,
    "max_mistakes_reached": 0,
    "row_completed": 1,
    "box_completed": 1,
    "win_game": 10,
    "easy_level_completed": 5,
    "medium_level_completed": 8,
    "hard_level_completed": 12,
}


class Command(BaseCommand):
    help = "Seed standalone ScoreConfiguration rows for Sudoku actions. Idempotent."

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for action_type, score_value in SCORES.items():
            _, was_created = ScoreConfiguration.objects.update_or_create(
                section=SECTION,
                action_type=action_type,
                content_type=None,
                object_id=None,
                defaults={"score_value": score_value, "is_active": True},
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Sudoku scores: {created} created, {updated} updated.")
        )
