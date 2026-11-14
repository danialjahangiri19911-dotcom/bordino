from django.contrib import admin

from apps.clientlog.models import ClientLog


@admin.register(ClientLog)
class ClientLogAdmin(admin.ModelAdmin):
    list_display = ("create_time", "phone", "flow", "step", "level", "source", "attempt")
    list_filter = ("flow", "level", "source")
    search_fields = ("phone", "attempt", "step")
    readonly_fields = [f.name for f in ClientLog._meta.fields]

    def has_add_permission(self, request):
        return False
