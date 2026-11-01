def save_changed_fields(obj, form, protected: set[str]):
    """Saves only the model fields the admin form changed, never the `protected` ones (balances,
    which move through transactions). A change of nothing saves nothing."""
    concrete = {f.name for f in obj._meta.concrete_fields}
    fields = [name for name in form.changed_data if name in concrete and name not in protected]
    if fields:
        if "update_time" in concrete:
            fields.append("update_time")
        obj.save(update_fields=fields)


class ReadOnlyLedgerAdmin:
    """Admin mixin for money records written by the services (prizes, rewards, transfers). Their
    status and amount move balances through post_save signals, so an edit, an add or a delete
    here would pay or take back money with no other record: read-only. Corrections are a points
    adjustment (token wallet admin) or the withdrawal workflow, which keep their own records."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
