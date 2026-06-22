from apps.configuration.models.scoring import ScoreConfiguration


class ScoreConfigurationQueryRepository:
    @staticmethod
    def get_active_config_by_content_object(
        content_type_id: int,
        object_id,
        action_type: str,
    ) -> ScoreConfiguration | None:
        return ScoreConfiguration.objects.get(
            content_type_id=content_type_id,
            object_id=object_id,
            action_type=action_type.strip(),
            is_active=True,
        )

    @staticmethod
    def get_active_config(
        section: str,
        action_type: str,
    ) -> ScoreConfiguration | None:
        section = section.lower() if section else section
        return ScoreConfiguration.objects.get(
            section=section,
            action_type=action_type,
            is_active=True,
            content_type__isnull=True,
        )

    @staticmethod
    def get_configs_by_section(section: str) -> list[ScoreConfiguration]:
        section = section.lower() if section else section
        return list(
            ScoreConfiguration.objects.filter(
                section=section,
                is_active=True,
            )
        )
