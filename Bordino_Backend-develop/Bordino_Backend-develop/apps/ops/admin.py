from django.contrib import admin

from apps.ops.models import OpsAuditLog, OpsMember


@admin.register(OpsMember)
class OpsMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "is_active", "added_by", "note", "create_time")
    list_filter = ("is_active",)
    search_fields = ("user__phone_number", "user__username")
    readonly_fields = ("user", "added_by", "create_time")


@admin.register(OpsAuditLog)
class OpsAuditLogAdmin(admin.ModelAdmin):
    list_display = ("create_time", "actor", "action", "target_type", "target_id", "ip")
    list_filter = ("action",)
    search_fields = ("actor__phone_number", "target_id")
    date_hierarchy = "create_time"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
