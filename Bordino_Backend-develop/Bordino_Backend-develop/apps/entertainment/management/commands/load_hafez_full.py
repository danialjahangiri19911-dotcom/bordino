import hafez
import requests
from hafez.entry import get_mp3_url
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.entertainment.models.fortune_reading import FortuneReading


def _verses_to_text(verses):
    if not verses:
        return ""
    return "\n".join(str(v).strip() for v in verses if str(v).strip())


class Command(BaseCommand):
    help = "Load all Hafez poems (text + interpretation + audio) from the hafez PyPI package."

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-audio",
            action="store_true",
            help="Skip downloading MP3 audio files.",
        )

    def handle(self, *args, **options):
        skip_audio = options["no_audio"]
        audio_dir = Path(settings.MEDIA_ROOT) / "hafez" / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)

        self.stdout.write("Deleting old FortuneReading records...")
        FortuneReading.objects.all().delete()

        total = hafez.total_poems()
        self.stdout.write(f"Loading {total} poems (audio={'off' if skip_audio else 'on'})...")

        downloaded = 0
        failed_audio = 0

        for i in range(1, total + 1):
            poem_data = hafez.get_poem(i)
            verses = poem_data.get("poem", [])
            interpretation = poem_data.get("interpretation", "") or ""

            poem_text = _verses_to_text(verses)
            result_text = f"{poem_text}\n===\n{interpretation.strip()}"

            audio_path = None
            local_file = audio_dir / f"{i}.mp3"
            if not skip_audio:
                if not local_file.exists():
                    # get_poem()['mp3'] points to a dead host; the package's
                    # get_mp3_url() builds the working GitHub-raw URL instead.
                    _, url = get_mp3_url(i)
                    try:
                        resp = requests.get(url, timeout=60)
                        ctype = resp.headers.get("Content-Type", "")
                        if resp.status_code == 200 and "audio" in ctype:
                            local_file.write_bytes(resp.content)
                            downloaded += 1
                        else:
                            failed_audio += 1
                    except Exception:
                        failed_audio += 1
                if local_file.exists():
                    audio_path = f"hafez/audio/{i}.mp3"

            FortuneReading.objects.create(
                question=f"غزل {i}",
                result=result_text,
                audio_url=audio_path,
                type=FortuneReading.ReadingType.HAFEZ,
            )
            if i % 25 == 0:
                self.stdout.write(
                    f"  {i}/{total} ... (downloaded={downloaded}, failed={failed_audio})"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done: {total} poems, {downloaded} audio downloaded, {failed_audio} failed."
            )
        )
