from celery import shared_task

from apps.notifications import services
from apps.users.models.customer import Customer


@shared_task(
    ignore_result=True,
    autoretry_for=(services.TransientPushError,),
    retry_backoff=60,
    retry_backoff_max=1800,
    max_retries=5,
)
def send_notification(customer_id, category, title, body="", url="/pwa/main", key=None):
    customer = Customer.objects.filter(pk=customer_id).first()
    if customer:
        services.send(customer, category, title, body, url, key)


@shared_task(ignore_result=True)
def broadcast(category, title, body="", url="/pwa/main", key=None):
    services.broadcast_now(category, title, body, url, key)
