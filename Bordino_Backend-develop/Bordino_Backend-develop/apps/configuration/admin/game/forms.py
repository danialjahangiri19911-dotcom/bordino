from django import forms
from django.contrib.contenttypes.models import ContentType

from apps.configuration.models.scoring import ScoreConfiguration


class ScoreConfigurationForm(forms.ModelForm):
    class Meta:
        model = ScoreConfiguration
        fields = ("action_type", "score_value", "is_active", "metadata")
        exclude = ("section",)

    def _post_clean(self):
        if hasattr(self, "_parent_obj") and self._parent_obj:
            parent = self._parent_obj
            self.instance.section = parent.game_name
            self.instance.content_type = ContentType.objects.get_for_model(parent)
            self.instance.object_id = parent.pk
        super()._post_clean()

    def _update_errors(self, errors):
        if hasattr(errors, "error_dict"):
            filtered_errors = {
                field: error_list
                for field, error_list in errors.error_dict.items()
                if field in self.fields
            }
            if filtered_errors:
                super()._update_errors(forms.ValidationError(filtered_errors))
        elif hasattr(errors, "message_dict"):
            filtered_errors = {
                field: error_list
                for field, error_list in errors.message_dict.items()
                if field in self.fields
            }
            if filtered_errors:
                super()._update_errors(forms.ValidationError(filtered_errors))
        else:
            super()._update_errors(errors)
