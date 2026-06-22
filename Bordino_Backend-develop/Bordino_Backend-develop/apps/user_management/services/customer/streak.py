import logging
from zoneinfo import ZoneInfo

from django.utils import timezone

from apps.users.models.customer import Customer

# Streak days are counted against the user's local (Tehran) calendar day,
# since the project stores datetimes in UTC (USE_TZ=True, TIME_ZONE="UTC").
LOCAL_TIMEZONE = ZoneInfo("Asia/Tehran")


class CustomerStreakService:
    """Maintains the consecutive-active-days streak for a customer.

    Call ``register_activity`` whenever the user is detected as active
    (e.g. when they open the app and fetch their own profile). The streak
    is incremented at most once per local calendar day.
    """

    def register_activity(self, customer: Customer) -> Customer:
        try:
            now = timezone.now()
            today = timezone.localtime(now, LOCAL_TIMEZONE).date()

            last_active = customer.last_active_date
            if last_active is None:
                customer.consecutive_active_days = 1
            else:
                last_active_day = timezone.localtime(last_active, LOCAL_TIMEZONE).date()
                day_gap = (today - last_active_day).days

                if day_gap == 0:
                    # Already counted for today; nothing to update.
                    return customer
                if day_gap == 1:
                    customer.consecutive_active_days += 1
                else:
                    # Missed one or more days (or clock skew) -> restart streak.
                    customer.consecutive_active_days = 1

            customer.max_consecutive_days = max(
                customer.max_consecutive_days, customer.consecutive_active_days
            )
            customer.last_active_date = now
            customer.save(
                update_fields=[
                    "consecutive_active_days",
                    "max_consecutive_days",
                    "last_active_date",
                    "update_time",
                ]
            )
        except Exception as e:  # pylint: disable=broad-except
            # Never let streak bookkeeping break the request it is attached to.
            logging.error("Error while updating customer streak: %s", e)

        return customer
