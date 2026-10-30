from celery import shared_task

from services import albums


@shared_task  # type: ignore[misc]
def purge_deleted_albums() -> int:
    return albums.purge_deleted()
