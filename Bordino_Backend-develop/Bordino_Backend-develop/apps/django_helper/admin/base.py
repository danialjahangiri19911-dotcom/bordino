from django.utils.translation import gettext as _

from import_export.admin import ImportExportModelAdmin

from apps.django_helper.models.base import AbstractBaseModel


class BaseAdmin(ImportExportModelAdmin):
    list_display = ("__str__",)
    list_filter = ()
    # Import (a CSV/Excel upload) writes rows straight into the database, past every rule these
    # admins keep (balances are never saved by hand, money records are read-only, statuses that
    # pay or refund): off, unless an admin of harmless data opts in. Export stays.
    allow_import = False

    def has_import_permission(self, request):
        return self.allow_import and super().has_import_permission(request)

    def get_fields(self, request, obj=None):
        fields = super().get_fields(request, obj)
        for col in AbstractBaseModel.auto_cols:
            try:
                fields.remove(col)
            except Exception:  # pylint: disable=broad-except
                pass

        return fields

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        fieldsets += ((_("Other Data"), {"fields": ("create_time", "update_time")}),)
        return fieldsets

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = super().get_readonly_fields(request, obj)
        return (*readonly_fields, "create_time", "update_time")

    def get_list_filter(self, request):
        list_filter = super().get_list_filter(request)
        return list_filter

    def get_list_display(self, request):
        list_display = super().get_list_display(request)
        return (*list_display, "update_time")
