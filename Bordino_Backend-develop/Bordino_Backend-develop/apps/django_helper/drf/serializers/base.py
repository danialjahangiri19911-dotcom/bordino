from typing import Any, ClassVar

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.configuration.models import SystemConfiguration


class ModelCleanValidationMixin:
    def _validate_model_clean(self, validation_attrs: dict[str, Any]) -> None:
        model_class = self.Meta.model
        if self.instance:
            instance_data = {
                f.name: getattr(self.instance, f.name)
                for f in model_class._meta.fields
                if hasattr(self.instance, f.name)
            }
            instance_data.update(validation_attrs)
            instance = model_class(**instance_data)
            instance.pk = self.instance.pk
        else:
            instance = model_class(**validation_attrs)
        try:
            instance.clean()
        except DjangoValidationError as e:
            if hasattr(e, "error_dict"):
                raise serializers.ValidationError(e.error_dict) from e
            if hasattr(e, "message_dict"):
                raise serializers.ValidationError(e.message_dict) from e
            raise serializers.ValidationError(e.messages) from e


class BaseModelSerializer(serializers.ModelSerializer):
    BASE_READ_ONLY_FIELDS: ClassVar = [
        "id",
        "create_time",
        "update_time",
    ]

    def __init__(self, *args, **kwargs):
        self._inject_base_fields()
        super().__init__(*args, **kwargs)
        self._apply_base_read_only_fields()

    def _inject_base_fields(self) -> None:
        if not hasattr(self.Meta, "fields"):
            return
        model_field_names = {f.name for f in self.Meta.model._meta.get_fields()}
        existing = list(self.Meta.fields) if isinstance(self.Meta.fields, (list, tuple)) else []
        to_prepend = [
            f for f in self.BASE_READ_ONLY_FIELDS if f in model_field_names and f not in existing
        ]
        if to_prepend:
            new_fields = to_prepend + existing
            self.Meta.fields = (
                tuple(new_fields) if isinstance(self.Meta.fields, tuple) else new_fields
            )

    def _apply_base_read_only_fields(self) -> None:
        if not hasattr(self.Meta, "read_only_fields"):
            self.Meta.read_only_fields = []

        if isinstance(self.Meta.read_only_fields, tuple):
            read_only_fields = list(self.Meta.read_only_fields)
        else:
            read_only_fields = list(self.Meta.read_only_fields or [])

        model_fields = {f.name for f in self.Meta.model._meta.get_fields()}

        for field_name in self.BASE_READ_ONLY_FIELDS:
            if field_name in model_fields and field_name not in read_only_fields:
                read_only_fields.append(field_name)

        self.Meta.read_only_fields = read_only_fields

    def _get_file_extension(self, name: str) -> str:
        if not name or "." not in name:
            return ""
        return "." + name.rsplit(".", 1)[-1].lower()

    def _validate_file_field(self, field_name: str, value: Any) -> None:
        if value is None:
            return

        size = getattr(value, "size", None)
        if size is not None and size == 0:
            raise serializers.ValidationError({field_name: "Uploaded file is empty."})

        max_size = getattr(
            self.__class__, "MAX_FILE_SIZE", None
        ) or SystemConfiguration.objects.get("FILE_VALIDATOR_MAX_FILE_SIZE", None)
        if max_size is not None and not isinstance(max_size, int):
            try:
                max_size = int(max_size)
            except (ValueError, TypeError):
                max_size = None
        if max_size is not None and size is not None and size > max_size:
            raise serializers.ValidationError(
                {field_name: f"File size must not exceed {max_size // (1024 * 1024)}MB."}
            )

        allowed_types = getattr(
            self.__class__, "ALLOWED_CONTENT_TYPES", None
        ) or SystemConfiguration.objects.get("FILE_VALIDATOR_ALLOWED_CONTENT_TYPES", None)
        if allowed_types is not None and not isinstance(allowed_types, list):
            allowed_types = [x.strip() for x in str(allowed_types).split(",") if x.strip()] or None
        if allowed_types is not None:
            content_type = getattr(value, "content_type", None) or ""
            content_type_base = content_type.split(";")[0].strip().lower()
            allowed_normalized = [t.split(";")[0].strip().lower() for t in allowed_types]
            if content_type_base not in allowed_normalized:
                raise serializers.ValidationError(
                    {field_name: f"File type not allowed. Allowed: {', '.join(allowed_types)}."}
                )

        allowed_ext = getattr(
            self.__class__, "ALLOWED_FILE_EXTENSIONS", None
        ) or SystemConfiguration.objects.get("FILE_VALIDATOR_ALLOWED_FILE_EXTENSIONS", None)
        if allowed_ext is not None and not isinstance(allowed_ext, list):
            allowed_ext = [x.strip() for x in str(allowed_ext).split(",") if x.strip()] or None
        if allowed_ext is not None:
            name = getattr(value, "name", None) or ""
            ext = self._get_file_extension(name)
            allowed_ext_normalized = [e if e.startswith(".") else f".{e}" for e in allowed_ext]
            allowed_ext_normalized = [e.lower() for e in allowed_ext_normalized]
            if ext not in allowed_ext_normalized:
                raise serializers.ValidationError(
                    {
                        field_name: f"File format not allowed. Allowed extensions: {', '.join(allowed_ext_normalized)}."
                    }
                )

        max_name_len = getattr(
            self.__class__, "MAX_FILENAME_LENGTH", None
        ) or SystemConfiguration.objects.get("FILE_VALIDATOR_MAX_FILENAME_LENGTH", None)
        if max_name_len is not None and not isinstance(max_name_len, int):
            try:
                max_name_len = int(max_name_len)
            except (ValueError, TypeError):
                max_name_len = None
        if max_name_len is not None:
            name = getattr(value, "name", None) or ""
            if len(name) > max_name_len:
                raise serializers.ValidationError(
                    {field_name: f"File name must be at most {max_name_len} characters."}
                )

    def _validate_model_clean(self, validation_attrs: dict[str, Any]) -> None:
        pass

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        model_class = self.Meta.model
        validation_attrs = attrs.copy()
        model_field_names = {f.name for f in model_class._meta.get_fields()}
        read_only_names = set(getattr(self.Meta, "read_only_fields", None) or [])

        for field_name, field in self.fields.items():
            if getattr(field, "write_only", False) and field_name not in model_field_names:
                validation_attrs.pop(field_name, None)
                continue

            if (
                field_name in attrs
                and hasattr(field, "Meta")
                and hasattr(field.Meta, "model")
                and isinstance(attrs[field_name], dict)
            ):
                validation_attrs.pop(field_name)
                if self.instance and hasattr(self.instance, field_name):
                    related = getattr(self.instance, field_name)
                    if related:
                        validation_attrs[f"{field_name}_id"] = related.pk

            if isinstance(field, serializers.ImageField | serializers.FileField):
                if field_name in attrs:
                    self._validate_file_field(field_name, attrs[field_name])
                validation_attrs.pop(field_name, None)

        if self.instance:
            for name in read_only_names:
                validation_attrs.pop(name, None)

        if validation_attrs:
            self._validate_model_clean(validation_attrs)

        return attrs
