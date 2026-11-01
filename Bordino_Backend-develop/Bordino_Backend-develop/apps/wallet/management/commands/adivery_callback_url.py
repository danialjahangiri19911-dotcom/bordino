"""Prints the reward-confirmation address to enter in the Adivery panel (rewarded placement)."""

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.wallet.services import ad_reward


class Command(BaseCommand):
    help = "The Adivery reward callback address for the panel (keep it private: it pays rewards)."

    def handle(self, *args, **options):
        base = getattr(settings, "MISSIONS_PUBLIC_URL", "https://lottery.bordino.co").rstrip("/")
        self.stdout.write(f"{base}/api/v1/wallet/ad-reward/adivery/{ad_reward.adivery_callback_secret()}/")
