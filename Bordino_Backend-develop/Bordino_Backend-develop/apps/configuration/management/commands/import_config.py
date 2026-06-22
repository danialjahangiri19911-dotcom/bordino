import os
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.configuration.enums import SystemConfigCategory, SystemConfigValueType
from apps.configuration.models import SystemConfiguration


def _get_existing_raw_value(key: str, file_value: str) -> str | None:
    obj = SystemConfiguration.objects.filter(key=key).first()
    if obj and (obj.value or obj.default_value):
        raw = (obj.value or obj.default_value or "").strip()
        if raw:
            return raw
    env_val = os.environ.get(key)
    if env_val is not None and str(env_val).strip():
        return str(env_val).strip()
    return (file_value or "").strip() or None


KEY_SPEC = {
    "WALLET_CURRENCY_EXPIRATION_DAYS": (
        SystemConfigCategory.WALLET,
        SystemConfigValueType.INT,
    ),
    "WALLET_TOKEN_EXPIRATION_DAYS": (
        SystemConfigCategory.WALLET,
        SystemConfigValueType.INT,
    ),
    "WALLET_MAX_NEGATIVE_POINTS": (
        SystemConfigCategory.WALLET,
        SystemConfigValueType.INT,
    ),
    "WALLET_MAX_NEGATIVE_CURRENCY": (
        SystemConfigCategory.WALLET,
        SystemConfigValueType.INT,
    ),
    "COMPLETE_PROFILE_REWARD_POINTS": (
        SystemConfigCategory.WALLET,
        SystemConfigValueType.INT,
    ),
    "FILE_VALIDATOR_MAX_FILE_SIZE": (
        SystemConfigCategory.FILE_UPLOAD,
        SystemConfigValueType.INT,
    ),
    "FILE_VALIDATOR_ALLOWED_CONTENT_TYPES": (
        SystemConfigCategory.FILE_UPLOAD,
        SystemConfigValueType.LIST,
    ),
    "FILE_VALIDATOR_ALLOWED_FILE_EXTENSIONS": (
        SystemConfigCategory.FILE_UPLOAD,
        SystemConfigValueType.LIST,
    ),
    "FILE_VALIDATOR_MAX_FILENAME_LENGTH": (
        SystemConfigCategory.FILE_UPLOAD,
        SystemConfigValueType.INT,
    ),
    "FILE_UPLOAD_PATH_PREFIX": (
        SystemConfigCategory.FILE_UPLOAD,
        SystemConfigValueType.STR,
    ),
    "DOCUMENT_UPLOAD_MAX_FILE_SIZE": (
        SystemConfigCategory.FILE_UPLOAD,
        SystemConfigValueType.INT,
    ),
    "DOCUMENT_UPLOAD_ALLOWED_CONTENT_TYPES": (
        SystemConfigCategory.FILE_UPLOAD,
        SystemConfigValueType.LIST,
    ),
    "DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS": (
        SystemConfigCategory.FILE_UPLOAD,
        SystemConfigValueType.LIST,
    ),
    "DOCUMENT_UPLOAD_MAX_FILENAME_LENGTH": (
        SystemConfigCategory.FILE_UPLOAD,
        SystemConfigValueType.INT,
    ),
}


def _parse_env_file(path: Path) -> dict[str, str]:
    out = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip("'\"")
            if key:
                out[key] = val
    return out


def _guess_spec(key: str) -> tuple[str, str]:
    return SystemConfigCategory.API, SystemConfigValueType.STR


class Command(BaseCommand):
    help = "Import config from env file into SystemConfiguration (DB → env → file)."

    def add_arguments(self, parser):
        parser.add_argument(
            "env_file",
            nargs="?",
            default="main_app/.env.example",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
        )

    def handle(self, *args, **options):
        env_file = options["env_file"]
        dry_run = options["dry_run"]
        base_dir = Path.cwd()
        path = base_dir / env_file
        pairs = _parse_env_file(path) if path.exists() else {}
        created = 0
        updated = 0
        for key in KEY_SPEC:
            file_value = pairs.get(key, "")
            category, value_type = KEY_SPEC.get(key, _guess_spec(key))
            existing_raw = _get_existing_raw_value(key, file_value)
            if dry_run:
                created += 1
                continue
            defaults = {
                "default_value": (file_value or "").strip() or None,
                "category": category,
                "value_type": value_type,
            }
            if existing_raw is not None:
                defaults["value"] = existing_raw
            obj, was_created = SystemConfiguration.objects.update_or_create(
                key=key,
                defaults=defaults,
            )
            SystemConfiguration.objects.invalidate(key=key)
            if was_created:
                created += 1
            else:
                updated += 1
        if not dry_run:
            self.stdout.write(self.style.SUCCESS(f"Done: {created} created, {updated} updated."))
