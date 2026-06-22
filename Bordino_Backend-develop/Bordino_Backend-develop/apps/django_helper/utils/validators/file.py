from __future__ import annotations

from collections.abc import Callable
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.configuration.models import SystemConfiguration


def _get_file_extension(name: str) -> str:
    if not name or "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


def _validate_uploaded_file(
    value: Any,
    *,
    max_size: int | None = None,
    allowed_content_types: list[str] | None = None,
    allowed_extensions: list[str] | None = None,
    max_filename_length: int | None = None,
    allow_empty: bool = False,
) -> None:
    if value is None:
        if allow_empty:
            return
        raise DjangoValidationError(_("No file provided."))

    size = getattr(value, "size", None)
    if size is not None and size == 0:
        if allow_empty:
            return
        raise DjangoValidationError(_("Uploaded file is empty."))

    if max_size is not None and size is not None and size > max_size:
        raise DjangoValidationError(
            _("File size must not exceed %(max_mb)sMB.") % {"max_mb": max_size // (1024 * 1024)}
        )

    if allowed_content_types is not None:
        content_type = getattr(value, "content_type", None) or ""
        content_type_base = content_type.split(";")[0].strip().lower()
        allowed_normalized = [t.split(";")[0].strip().lower() for t in allowed_content_types]
        if content_type_base not in allowed_normalized:
            raise DjangoValidationError(
                _("File type not allowed. Allowed: %(allowed)s.")
                % {"allowed": ", ".join(allowed_content_types)}
            )

    if allowed_extensions is not None:
        name = getattr(value, "name", None) or ""
        ext = _get_file_extension(name)
        allowed_normalized = [
            e.lower() if e.startswith(".") else f".{e.lower()}" for e in allowed_extensions
        ]
        if ext not in allowed_normalized:
            raise DjangoValidationError(
                _("File format not allowed. Allowed extensions: %(allowed)s.")
                % {"allowed": ", ".join(allowed_normalized)}
            )

    if max_filename_length is not None:
        name = getattr(value, "name", None) or ""
        if len(name) > max_filename_length:
            raise DjangoValidationError(
                _("File name must be at most %(max)s characters.") % {"max": max_filename_length}
            )


def _resolve_file_options(
    *,
    max_size: int | None = None,
    max_file_size: int | None = None,
    allowed_content_types: list[str] | None = None,
    allowed_extensions: list[str] | None = None,
    allowed_file_extensions: list[str] | None = None,
    max_filename_length: int | None = None,
) -> tuple[int | None, list[str] | None, list[str] | None, int | None]:
    size = (
        max_size
        or max_file_size
        or SystemConfiguration.objects.get("FILE_VALIDATOR_MAX_FILE_SIZE", None)
    )
    if size is not None and not isinstance(size, int):
        try:
            size = int(size)
        except (ValueError, TypeError):
            size = None
    ct = allowed_content_types or SystemConfiguration.objects.get(
        "FILE_VALIDATOR_ALLOWED_CONTENT_TYPES", None
    )
    if ct is not None and not isinstance(ct, list):
        ct = [x.strip() for x in str(ct).split(",") if x.strip()] or None
    ext = (
        allowed_extensions
        or allowed_file_extensions
        or SystemConfiguration.objects.get("FILE_VALIDATOR_ALLOWED_FILE_EXTENSIONS", None)
    )
    if ext is not None and not isinstance(ext, list):
        ext = [x.strip() for x in str(ext).split(",") if x.strip()] or None
    name_len = max_filename_length or SystemConfiguration.objects.get(
        "FILE_VALIDATOR_MAX_FILENAME_LENGTH", None
    )
    if name_len is not None and not isinstance(name_len, int):
        try:
            name_len = int(name_len)
        except (ValueError, TypeError):
            name_len = None
    return size, ct, ext, name_len


def validate_file(
    value: Any,
    *,
    field_name: str | None = None,
    max_size: int | None = None,
    max_file_size: int | None = None,
    allowed_content_types: list[str] | None = None,
    allowed_extensions: list[str] | None = None,
    allowed_file_extensions: list[str] | None = None,
    max_filename_length: int | None = None,
    allow_empty: bool = False,
) -> None:
    if value is None and allow_empty:
        return
    max_sz, allowed_ct, allowed_ext, max_name_len = _resolve_file_options(
        max_size=max_size,
        max_file_size=max_file_size,
        allowed_content_types=allowed_content_types,
        allowed_extensions=allowed_extensions,
        allowed_file_extensions=allowed_file_extensions,
        max_filename_length=max_filename_length,
    )
    try:
        _validate_uploaded_file(
            value,
            max_size=max_sz,
            allowed_content_types=allowed_ct,
            allowed_extensions=allowed_ext,
            max_filename_length=max_name_len,
            allow_empty=allow_empty,
        )
    except DjangoValidationError as e:
        if field_name is not None:
            msgs = e.messages if hasattr(e, "messages") else [str(e)]
            raise serializers.ValidationError({field_name: msgs}) from e
        raise


def file_validator(
    *,
    max_size: int | None = None,
    allowed_content_types: list[str] | None = None,
    allowed_extensions: list[str] | None = None,
    max_filename_length: int | None = None,
    allow_empty: bool = False,
) -> Callable[[Any], None]:
    def validator(value: Any) -> None:
        validate_file(
            value,
            field_name=None,
            max_size=max_size,
            allowed_content_types=allowed_content_types,
            allowed_extensions=allowed_extensions,
            max_filename_length=max_filename_length,
            allow_empty=allow_empty,
        )

    return validator


def document_validator(value: Any) -> None:
    validate_file(
        value,
        field_name=None,
        allowed_extensions=[".pdf", ".doc", ".docx", ".txt"],
        allowed_content_types=[
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
        ],
    )


def image_validator(value: Any) -> None:
    validate_file(
        value,
        field_name=None,
        allowed_extensions=[".jpg", ".jpeg", ".png", ".gif", ".webp"],
        allowed_content_types=["image/jpeg", "image/png", "image/gif", "image/webp"],
    )
