"""The starting categories and the daily video mission (safe to run again: nothing is duplicated).

Partner missions (sign-up, app install, banner, QR) need real links and are made in the admin.
"""

from django.core.management.base import BaseCommand

from apps.missions.models import Mission, MissionCategory

CATEGORIES = [
    ("ویدیو", "clapperboard", 1),
    ("تبلیغات", "mouse-pointer-click", 2),
    ("ثبت‌نام", "user-plus", 3),
    ("نصب اپ", "smartphone", 4),
    ("حضوری", "map-pin", 5),
]


class Command(BaseCommand):
    help = "Creates the missions' categories and the daily rewarded-video mission."

    def handle(self, *args, **options):
        made = {}
        for name, icon, order in CATEGORIES:
            made[name], created = MissionCategory.objects.get_or_create(name=name, defaults={"icon": icon, "order": order})
            self.stdout.write(f"{'+' if created else '='} category {name}")
        video, created = Mission.objects.get_or_create(
            kind=Mission.Kind.VIDEO,
            title="تماشای ویدیوی کوتاه",
            defaults={
                "summary": "یک ویدیوی کوتاه ببین و امتیاز بگیر.",
                "category": made["ویدیو"],
                "points": 5,
                "repeat": Mission.Repeat.DAILY,
                "daily_limit": 5,
            },
        )
        self.stdout.write(f"{'+' if created else '='} mission {video.title}")
