from datetime import datetime
from datetime import timezone as dt_timezone

from django.conf import settings
from django.db import IntegrityError
from django.db.models import IntegerField, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import DealTimeTick


def get_time_tracking_tick_seconds() -> int:
    return max(5, int(getattr(settings, "DEAL_TIME_TRACKING_TICK_SECONDS", 10)))


def get_time_tracking_confirm_interval_seconds() -> int:
    return max(
        get_time_tracking_tick_seconds(),
        int(getattr(settings, "DEAL_TIME_TRACKING_CONFIRM_INTERVAL_SECONDS", 600)),
    )


def is_time_tracking_enabled() -> bool:
    return bool(getattr(settings, "DEAL_TIME_TRACKING_ENABLED", True))


def get_bucket_start(now: datetime) -> datetime:
    tick_seconds = get_time_tracking_tick_seconds()
    current = int(now.timestamp())
    floored = current - (current % tick_seconds)
    return datetime.fromtimestamp(floored, tz=dt_timezone.utc)


def format_hms(total_seconds: int) -> str:
    total = max(int(total_seconds), 0)
    hours, remainder = divmod(total, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def get_user_deal_total_seconds(user, deal) -> int:
    total = (
        DealTimeTick.objects.filter(user=user, deal=deal).aggregate(
            total=Coalesce(Sum("seconds"), Value(0), output_field=IntegerField())
        )["total"]
        or 0
    )
    return int(total)


def build_time_tracking_summary(user, deal) -> dict:
    tick_seconds = get_time_tracking_tick_seconds()
    confirm_interval_seconds = get_time_tracking_confirm_interval_seconds()
    enabled = is_time_tracking_enabled()
    my_total_seconds = get_user_deal_total_seconds(user, deal)
    return {
        "enabled": enabled,
        "tick_seconds": tick_seconds,
        "confirm_interval_seconds": confirm_interval_seconds,
        "my_total_seconds": my_total_seconds,
        "my_total_human": format_hms(my_total_seconds),
    }


def record_time_tracking_tick(user, deal) -> dict:
    tick_seconds = get_time_tracking_tick_seconds()
    confirm_interval_seconds = get_time_tracking_confirm_interval_seconds()
    enabled = is_time_tracking_enabled()
    if not enabled:
        return {
            "enabled": False,
            "tick_seconds": tick_seconds,
            "confirm_interval_seconds": confirm_interval_seconds,
            "counted": False,
            "bucket_start": None,
            "my_total_seconds": get_user_deal_total_seconds(user, deal),
            "reason": "disabled",
        }

    bucket_start = get_bucket_start(timezone.now())

    try:
        tick, created = DealTimeTick.objects.get_or_create(
            user=user,
            bucket_start=bucket_start,
            defaults={
                "deal": deal,
                "seconds": tick_seconds,
                "source": "deal_details_panel",
            },
        )
    except IntegrityError:
        tick = DealTimeTick.objects.filter(user=user, bucket_start=bucket_start).first()
        created = False

    if created:
        counted = True
        reason = None
    elif tick and tick.deal_id == deal.id:
        counted = False
        reason = "duplicate"
    else:
        counted = False
        reason = "bucket_taken_by_other_deal"

    payload = {
        "enabled": True,
        "tick_seconds": tick_seconds,
        "confirm_interval_seconds": confirm_interval_seconds,
        "counted": counted,
        "bucket_start": bucket_start,
        "my_total_seconds": get_user_deal_total_seconds(user, deal),
    }
    if reason:
        payload["reason"] = reason
    return payload
