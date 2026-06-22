from django.contrib.contenttypes.admin import GenericTabularInline

from apps.configuration.admin.game.forms import ScoreConfigurationForm
from apps.configuration.models.scoring import ScoreConfiguration


class ScoreConfigurationInline(GenericTabularInline):
    model = ScoreConfiguration
    form = ScoreConfigurationForm
    extra = 0
    fields = ("action_type", "score_value", "is_active", "metadata")
    verbose_name = "Activity Configuration"
    verbose_name_plural = "Activity Configurations"
    exclude = ("section",)

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        original_init = formset.form.__init__
        parent_obj = obj

        def form_init(form_self, *args, **kwargs):
            original_init(form_self, *args, **kwargs)
            form_self._parent_obj = parent_obj

        formset.form.__init__ = form_init
        return formset

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if self.parent_obj:
            return qs.filter(section=self.parent_obj.game_name)
        return qs.none()

    def has_add_permission(self, request, obj=None):
        return True

    def has_change_permission(self, request, obj=None):
        return True

    def has_delete_permission(self, request, obj=None):
        return True
