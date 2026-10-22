from django.db import migrations


def mark_paid(apps, schema_editor):
    """Before the Completed step existed, the profile reward was paid when interests were saved
    and the step stayed InterestSelection. Those customers (interests saved) already got it:
    record that, so the unique ProfileReward row does not read as "never paid"."""
    Customer = apps.get_model("users", "Customer")
    ProfileReward = apps.get_model("users", "ProfileReward")
    paid = Customer.objects.filter(
        registration_step="InterestSelection", favorite_categories__isnull=False
    ).distinct()
    for customer in paid:
        ProfileReward.objects.get_or_create(customer=customer, defaults={"points": 0})


class Migration(migrations.Migration):
    dependencies = [("users", "0025_profile_reward")]

    operations = [migrations.RunPython(mark_paid, migrations.RunPython.noop)]
