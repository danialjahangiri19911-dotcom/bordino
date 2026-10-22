from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.django_helper.models.base import AbstractBaseModel


class GamePlayCharge(AbstractBaseModel):
    """One paid play of a points game (Sudoku, 2048): the wallet-history row for its cost, and the
    proof that the player has played before that game's activity rewards are given."""

    class Meta(AbstractBaseModel.Meta):
        verbose_name = _("Game play charge")
        verbose_name_plural = _("Game play charges")
        indexes = [models.Index(fields=["customer", "game_name"])]

    customer = models.ForeignKey(
        "users.Customer", on_delete=models.CASCADE, related_name="game_play_charges"
    )
    token_account = models.ForeignKey(
        "wallet.TokenWalletAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="game_play_charges",
    )
    game_name = models.CharField(max_length=50)
    cost = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.customer_id} {self.game_name} -{self.cost}"
