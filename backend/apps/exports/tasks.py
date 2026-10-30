from typing import Any

from celery import shared_task
from django.conf import settings

from services import exports


@shared_task(
    bind=True,
    max_retries=1,  # 2 attempts in total
    soft_time_limit=settings.PDF_RENDER_TIMEOUT_SECONDS,
    time_limit=settings.PDF_RENDER_TIMEOUT_SECONDS + 30,
    acks_late=True,
)  # type: ignore[misc]
def render_export(self: Any, job_id: int) -> None:
    try:
        exports.run(job_id)
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=10) from exc
        exports.mark_failed(job_id)


@shared_task  # type: ignore[misc]
def cleanup_exports() -> int:
    return exports.cleanup()
