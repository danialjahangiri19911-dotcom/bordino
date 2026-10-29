def save_changed_fields(obj, form, protected: set[str]):
    """Saves only the model fields the admin form changed, never the `protected` ones (balances,
    which move through transactions). A change of nothing saves nothing."""
    concrete = {f.name for f in obj._meta.concrete_fields}
    fields = [name for name in form.changed_data if name in concrete and name not in protected]
    if fields:
        if "update_time" in concrete:
            fields.append("update_time")
        obj.save(update_fields=fields)
