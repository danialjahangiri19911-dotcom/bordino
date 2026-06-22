from apps.configuration.models.game import GameConfiguration


class GameConfigurationQueryRepository:
    @staticmethod
    def filter_active():
        return GameConfiguration.objects.filter(is_active=True)

    @staticmethod
    def get_by_game_name(
        game_name: str, difficulty_level: str | None = None
    ) -> GameConfiguration | None:
        game_name = game_name.lower() if game_name else game_name

        queryset = GameConfiguration.objects.filter(game_name=game_name, is_active=True)

        if difficulty_level:
            queryset = queryset.filter(difficulty_level=difficulty_level)
            try:
                return queryset.get()
            except GameConfiguration.DoesNotExist:
                return None

        return queryset.first()

    @staticmethod
    def filter_by_game_name(game_name: str):
        game_name = game_name.lower() if game_name else game_name
        return GameConfiguration.objects.filter(game_name=game_name, is_active=True)
