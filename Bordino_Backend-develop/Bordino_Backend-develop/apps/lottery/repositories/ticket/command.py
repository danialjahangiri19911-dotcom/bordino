from django.db import transaction

from apps.lottery.models import Ticket


class TicketCommandRepository:
    @transaction.atomic
    def create_ticket(self, customer, lottery, numbers=None, name=None):
        """
        Create a new ticket

        Args:
            customer: Customer model instance
            lottery: Lottery model instance
            numbers: Optional list of integers representing ticket numbers
            name: String name for the ticket (display title only)

        Returns:
            Ticket: Created ticket instance
        """
        return Ticket.objects.create(
            customer=customer,
            lottery=lottery,
            numbers=numbers,
            name=name,
        )

    @transaction.atomic
    def delete_ticket(self, ticket_id):
        """
        Delete a ticket

        Args:
            ticket_id: ID of ticket to delete
        """
        Ticket.objects.filter(id=ticket_id).delete()

    @transaction.atomic
    def update_ticket(self, ticket_id, **kwargs):
        """
        Update ticket fields

        Args:
            ticket_id: ID of ticket to update
            **kwargs: Fields to update

        Returns:
            Ticket: Updated ticket instance
        """
        ticket = Ticket.objects.filter(id=ticket_id)
        ticket.update(**kwargs)
        return ticket.first()

    @transaction.atomic
    def set_numbers(self, ticket, numbers):
        if ticket.numbers:
            raise ValueError("Ticket numbers have already been set.")
        ticket.numbers = numbers
        ticket.save()
        return ticket
