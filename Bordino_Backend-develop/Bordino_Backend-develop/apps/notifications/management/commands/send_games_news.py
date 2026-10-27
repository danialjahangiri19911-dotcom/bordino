from django.core.management.base import BaseCommand

from apps.notifications import services
from apps.notifications.models import Category


class Command(BaseCommand):
    help = "«خبرهای بازی‌ها»: notify every player who has games news on (e.g. a new game is out)."

    def add_arguments(self, parser):
        parser.add_argument("title")
        parser.add_argument("body", nargs="?", default="")
        parser.add_argument("--url", default="/pwa/gameNet")
        parser.add_argument("--key", required=True, help="A unique name for this news (sent once per player).")

    def handle(self, *args, **opts):
        reached = services.broadcast_now(Category.GAMES, opts["title"], opts["body"], opts["url"], f"games:{opts['key']}")
        self.stdout.write(self.style.SUCCESS(f"Delivered to {reached} device(s)."))
