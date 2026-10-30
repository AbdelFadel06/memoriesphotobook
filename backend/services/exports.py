"""PDF export jobs: request (API), run (pdf worker), cleanup (maintenance)."""

import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.albums.models import Album, AlbumVersion
from apps.exports.models import ExportJob
from apps.photos.models import Photo
from config.exceptions import ApiError

from . import imaging, pdf_renderer, storage

logger = logging.getLogger(__name__)

FAILED_MESSAGE = "La génération du PDF a échoué. Réessayez dans quelques minutes."
ACTIVE = (ExportJob.Status.QUEUED, ExportJob.Status.RUNNING)


def request_export(user: User, album_id: int) -> ExportJob:
    album = (
        Album.objects.select_related("current_version")
        .filter(pk=album_id, owner=user, deleted_at__isnull=True)
        .first()
    )
    if album is None:
        raise ApiError("not_found", "Album introuvable.", status_code=404)
    if album.current_version is None:
        raise ApiError("empty_album", "Cet album est encore vide.", status_code=409)

    jobs = ExportJob.objects.filter(album_version__album__owner=user)
    if jobs.filter(status__in=ACTIVE).count() >= settings.EXPORTS_CONCURRENT_PER_USER:
        raise ApiError(
            "too_many_exports", "Des PDF sont déjà en préparation, patientez.", status_code=429
        )
    since = timezone.now() - timedelta(days=1)
    if jobs.filter(created_at__gte=since).count() >= settings.EXPORTS_PER_DAY:
        raise ApiError(
            "daily_export_limit", "Limite de PDF atteinte pour aujourd'hui.", status_code=429
        )

    job = ExportJob.objects.create(album_version=album.current_version)

    from apps.exports.tasks import render_export

    transaction.on_commit(lambda: render_export.delay(job.pk))
    return job


def run(job_id: int) -> None:
    job = ExportJob.objects.select_related("album_version__album").get(pk=job_id)
    if job.status == ExportJob.Status.DONE:
        return
    job.status = ExportJob.Status.RUNNING
    job.save(update_fields=["status"])

    version = job.album_version
    photo_urls = _print_photo_urls(version)
    sheets = pdf_renderer.build_sheets(version.content, photo_urls)
    pdf = pdf_renderer.render(sheets, created_at=version.created_at)

    key = f"users/{version.album.owner_id}/exports/{job.pk}.pdf"
    storage.write(key, pdf, "application/pdf")
    job.pdf_key = key
    job.status = ExportJob.Status.DONE
    job.error = ""
    job.finished_at = timezone.now()
    job.save(update_fields=["pdf_key", "status", "error", "finished_at"])


def mark_failed(job_id: int) -> None:
    logger.exception("Export %s failed", job_id)
    ExportJob.objects.filter(pk=job_id).update(
        status=ExportJob.Status.FAILED, error=FAILED_MESSAGE, finished_at=timezone.now()
    )


def download_url(job: ExportJob) -> str | None:
    if job.status != ExportJob.Status.DONE or not job.pdf_key:
        return None
    return storage.presign_download(job.pdf_key, filename=f"album-{job.album_version.album_id}.pdf")


def cleanup(now: datetime | None = None) -> int:
    """Delete PDFs older than the retention period. Returns how many were removed."""
    limit = (now or timezone.now()) - timedelta(days=settings.EXPORT_RETENTION_DAYS)
    old = list(ExportJob.objects.filter(created_at__lt=limit).exclude(pdf_key=""))
    storage.delete([job.pdf_key for job in old])
    ExportJob.objects.filter(pk__in=[job.pk for job in old]).update(pdf_key="")
    return len(old)


def _print_photo_urls(version: AlbumVersion) -> dict[int, str]:
    """Signed internal URLs of 300 dpi print derivatives, built once and cached in storage."""
    needed = pdf_renderer.print_long_side_px(version.content)
    photos = Photo.objects.filter(
        owner_id=version.album.owner_id, pk__in=needed, status=Photo.Status.READY
    )
    urls = {}
    for photo in photos:
        px = needed[photo.pk]
        base = photo.original_key.replace("/originals/", "/derived/").rsplit(".", 1)[0]
        key = f"{base}_print_{px}.jpg"
        if storage.object_size(key) is None:
            data = imaging.print_derivative(storage.read(photo.original_key), px)
            storage.write(key, data, "image/jpeg")
        urls[photo.pk] = storage.presign_download(key, internal=True)
    return urls
