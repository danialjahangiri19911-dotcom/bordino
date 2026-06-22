from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model

User = get_user_model()


@dataclass
class AwardScoreDTO:
    user: User
    section: str
    action_type: str
    metadata: dict[str, Any] | None = None
    description: str | None = None
