from django.db import migrations


def sort_numbers(apps, schema_editor):
    """Store every ticket's numbers in ascending order (new tickets already are). If a customer
    already holds the sorted twin of a ticket in the same lottery (both paid for), that ticket is
    left as it was and reported, rather than breaking the unique constraint."""
    Ticket = apps.get_model("lottery", "Ticket")
    tickets = list(
        Ticket.objects.exclude(numbers__isnull=True).only("id", "lottery_id", "customer_id", "numbers")
    )
    # First every ticket already in order, then the others against them.
    taken = {
        (t.lottery_id, t.customer_id, tuple(t.numbers))
        for t in tickets
        if list(t.numbers) == sorted(t.numbers)
    }
    for ticket in tickets:
        ordered = sorted(ticket.numbers)
        if ordered == list(ticket.numbers):
            continue
        key = (ticket.lottery_id, ticket.customer_id, tuple(ordered))
        if key in taken:
            print(f"  ticket {ticket.id}: same numbers as another ticket of this customer; left unsorted")
            continue
        taken.add(key)
        Ticket.objects.filter(pk=ticket.pk).update(numbers=ordered)


class Migration(migrations.Migration):
    dependencies = [("lottery", "0020_draw_integrity")]

    operations = [migrations.RunPython(sort_numbers, migrations.RunPython.noop)]
