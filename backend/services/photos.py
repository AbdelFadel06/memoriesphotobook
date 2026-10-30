"""Photo upload lifecycle: presign → direct upload to storage → confirm → background processing."""

import logging
import uuid
from dataclasses import dataclass

from django.conf import settings
from django.db import transaction
from django.db.models import Sum

from apps.accounts.models import User
from apps.albums.models import Album
from apps.layouts import catalog
from apps.photos.models import Photo
from config.exceptions import ApiError

from . import imaging, storage

logger = logging.getLogger(__name__)

EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}


@dataclass(frozen=True)
class PresignedUpload:
    photo: Photo
    upload_url: str


def presign(
    user: User,
    *,
    content_type: str,
    size: int,
    target_format: str,
    filename: str = "",
    album_id: int | None = None,
) -> PresignedUpload:
    if content_type not in settings.PHOTO_ALLOWED_MIME_TYPES:
        raise ApiError("unsupported_type", "Ce type de fichier n'est pas accepté.")
    if size <= 0 or size > settings.PHOTO_MAX_BYTES:
        max_mb = settings.PHOTO_MAX_BYTES // (1024 * 1024)
        raise ApiError("file_too_large", f"La photo dépasse {max_mb} Mo.")
    if target_format not in catalog.formats():
        raise ApiError("unknown_format", "Format d'album inconnu.")

    with transaction.atomic():
        # Lock the user row so concurrent presigns cannot overshoot the quotas.
        locked = User.objects.select_for_update().get(pk=user.pk)
        album = None
        if album_id is not None:
            album = Album.objects.filter(pk=album_id, owner=locked, deleted_at__isnull=True).first()
            if album is None:
                raise ApiError("not_found", "Album introuvable.", status_code=404)
            if album.photos.count() >= settings.PHOTOS_PER_ALBUM:
                raise ApiError(
                    "album_full", f"Un album peut contenir {settings.PHOTOS_PER_ALBUM} photos."
                )

        usage = Photo.objects.filter(owner=locked).exclude(status=Photo.Status.FAILED)
        if usage.count() >= locked.quota_photos:
            raise ApiError("photo_quota", "Vous avez atteint le nombre maximum de photos.")
        used_bytes = usage.aggregate(total=Sum("size_bytes"))["total"] or 0
        if used_bytes + size > settings.STORAGE_PER_USER_BYTES:
            raise ApiError("storage_quota", "Votre espace de stockage est plein.")

        key = f"users/{locked.pk}/originals/{uuid.uuid4().hex}.{EXTENSIONS[content_type]}"
        photo = Photo.objects.create(
            owner=locked,
            album=album,
            target_format=target_format,
            original_name=filename[:255],
            mime_type=content_type,
            size_bytes=size,
            original_key=key,
        )

    return PresignedUpload(photo, storage.presign_upload(key, content_type, size))


def confirm(user: User, photo_id: int) -> Photo:
    photo = Photo.objects.filter(pk=photo_id, owner=user).first()
    if photo is None:
        raise ApiError("not_found", "Photo introuvable.", status_code=404)
    if photo.status != Photo.Status.PENDING:
        return photo

    actual_size = storage.object_size(photo.original_key)
    if actual_size is None:
        raise ApiError("upload_missing", "L'envoi de la photo n'est pas terminé.", status_code=409)
    if actual_size != photo.size_bytes:
        mark_failed(photo)
        raise ApiError("upload_mismatch", "La photo envoyée est incomplète.", status_code=409)

    from apps.photos.tasks import process_photo

    transaction.on_commit(lambda: process_photo.delay(photo.pk))
    return photo


def process(photo_id: int) -> None:
    """Build derivatives and metadata. Idempotent: a ready photo is left untouched."""
    photo = Photo.objects.filter(pk=photo_id).first()
    if photo is None or photo.status == Photo.Status.READY:
        return

    try:
        result = imaging.process(storage.read(photo.original_key))
    except imaging.InvalidImage:
        logger.info("Photo %s rejected: not a supported image", photo_id)
        mark_failed(photo)
        storage.delete([photo.original_key])
        return

    base = photo.original_key.replace("/originals/", "/derived/").rsplit(".", 1)[0]
    thumb_key, preview_key = f"{base}_thumb.jpg", f"{base}_preview.jpg"
    storage.write(thumb_key, result.thumb, "image/jpeg")
    storage.write(preview_key, result.preview, "image/jpeg")

    photo.thumb_key = thumb_key
    photo.preview_key = preview_key
    photo.width = result.width
    photo.height = result.height
    photo.orientation = result.orientation
    photo.taken_at = result.taken_at
    photo.gps = result.gps
    photo.dominant_colors = result.dominant_colors
    photo.quality = imaging.quality_for(
        result.width, result.height, catalog.get_format(photo.target_format)
    )
    photo.status = Photo.Status.READY
    photo.save()


def mark_failed(photo: Photo) -> None:
    photo.status = Photo.Status.FAILED
    photo.save(update_fields=["status"])
