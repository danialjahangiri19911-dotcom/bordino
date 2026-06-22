from django.contrib import admin
from django.contrib.admin import register

from apps.users.models.file import File


@register(File)
class FileAdmin(admin.ModelAdmin):
    search_fields = ("file",)
    list_display = (
        "id",
        "file",
        "uploaded_at",
    )
    fields = ("file", "uploaded_at")
    readonly_fields = ("uploaded_at",)
