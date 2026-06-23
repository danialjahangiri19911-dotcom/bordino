import hafez

from django.core.management.base import BaseCommand

from apps.entertainment.models.fortune_reading import FortuneReading


def _verses_to_text(verses):
    if not verses:
        return ""
    return "\n".join(str(v).strip() for v in verses if str(v).strip())


class Command(BaseCommand):
    help = "Load all Hafez poems (text + interpretation) from the hafez PyPI package."

    def handle(self, *args, **options):
        self.stdout.write("Deleting old FortuneReading records...")
        FortuneReading.objects.all().delete()

        total = hafez.total_poems()
        self.stdout.write(f"Loading {total} poems...")

        for i in range(1, total + 1):
            poem_data = hafez.get_poem(i)
            verses = poem_data.get("poem", [])
            interpretation = poem_data.get("interpretation", "") or ""

            poem_text = _verses_to_text(verses)
            result_text = f"{poem_text}\n===\n{interpretation.strip()}"

            FortuneReading.objects.create(
                question=f"غزل {i}",
                result=result_text,
                audio_url=None,
                type=FortuneReading.ReadingType.HAFEZ,
            )
            if i % 50 == 0:
                self.stdout.write(f"  {i}/{total} done...")

        self.stdout.write(self.style.SUCCESS(f"Done: {total} poems loaded."))
