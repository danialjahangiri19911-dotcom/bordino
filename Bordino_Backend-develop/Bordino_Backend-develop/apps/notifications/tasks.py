from celery import shared_task

from apps.notifications import services
from apps.users.models.customer import Customer


@shared_task(
    bind=True,
    ignore_result=True,
    autoretry_for=(services.TransientPushError,),
    retry_backoff=60,
    retry_backoff_max=1800,
    max_retries=5,
)
def send_notification(self, customer_id, category, title, body="", url="/pwa/main", key=None, retry=None):
    customer = Customer.objects.filter(pk=customer_id).first()
    if customer:
        try:
            services.send(customer, category, title, body, url, key, retry=retry)
        except services.PartlyDelivered as e:
            # Again later, to the devices that failed only.
            raise self.retry(
                args=(customer_id, category, title, body, url, key),
                kwargs={"retry": e.retry},
                countdown=min(1800, 60 * 2**self.request.retries),
            )


@shared_task(ignore_result=True)
def broadcast(category, title, body="", url="/pwa/main", key=None):
    services.broadcast_now(category, title, body, url, key)
