from celery import shared_task

from services import photos


@shared_task(
    autoretry_for=(OSError,), retry_backoff=True, max_retries=3, acks_late=True
)  # type: ignore[misc]
def process_photo(photo_id: int) -> None:
    photos.process(photo_id)
