from celery import shared_task

from apps.notifications import services
from apps.users.models.customer import Customer


@shared_task(ignore_result=True)
def send_notification(customer_id, category, title, body="", url="/pwa/main", key=None):
    customer = Customer.objects.filter(pk=customer_id).first()
    if customer:
        services.send(customer, category, title, body, url, key)


@shared_task(ignore_result=True)
def broadcast(category, title, body="", url="/pwa/main", key=None):
    services.broadcast_now(category, title, body, url, key)
