"""Albums: creation with autolayout, versioned saves (immutable versions), restore, delete."""

import random
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.accounts.models import User
from apps.albums.models import Album, AlbumVersion
from apps.exports.models import ExportJob
from apps.layouts import catalog
from apps.photos.models import Photo
from config.exceptions import ApiError

from . import album_content, autolayout, storage


def owned(user: User) -> QuerySet[Album]:
    return Album.objects.filter(owner=user, deleted_at__isnull=True)


def get(user: User, album_id: int) -> Album:
    album = owned(user).select_related("current_version").filter(pk=album_id).first()
    if album is None:
        raise ApiError("not_found", "Album introuvable.", status_code=404)
    return album


def create(
    user: User,
    *,
    title: str,
    format_id: str,
    theme: str,
    photo_ids: list[int],
    accent: str | None = None,
    options: dict[str, bool] | None = None,
    keep_order: bool = False,
) -> Album:
    if format_id not in catalog.formats():
        raise ApiError("unknown_format", "Format d'album inconnu.")
    themes = catalog.themes()
    if theme not in themes:
        raise ApiError("unknown_theme", "Thème inconnu.")
    if len(photo_ids) > settings.PHOTOS_PER_ALBUM:
        raise ApiError("album_full", f"Un album peut contenir {settings.PHOTOS_PER_ALBUM} photos.")

    photos = list(Photo.objects.filter(owner=user, pk__in=photo_ids))
    if len(photos) != len(set(photo_ids)):
        raise ApiError("photo_not_found", "Certaines photos sont introuvables.")
    if any(p.status == Photo.Status.PENDING for p in photos):
        raise ApiError(
            "photos_processing", "Vos photos sont encore en préparation.", status_code=409
        )
    position = {pk: index for index, pk in enumerate(photo_ids)}
    photos = sorted(
        (p for p in photos if p.status == Photo.Status.READY), key=lambda p: position[p.pk]
    )

    seed = random.randrange(2**31)
    content = autolayout.build(
        [_info(p) for p in photos],
        format_id=format_id,
        theme=theme,
        accent=accent or themes[theme]["defaultAccent"],
        seed=seed,
        title=title,
        options=options,
        keep_order=keep_order,
    )
    with transaction.atomic():
        album = Album.objects.create(
            owner=user,
            title=title,
            format=format_id,
            theme=theme,
            accent_color=content["accent"],
            layout_seed=seed,
        )
        Photo.objects.filter(pk__in=[p.pk for p in photos]).update(album=album)
        _add_version(album, content)
    return album


def save(
    user: User, album_id: int, *, base_version: int, content: Any, title: str | None = None
) -> Album:
    """New immutable version; 409 if someone saved in between (reload rather than overwrite)."""
    with transaction.atomic():
        album = get(user, album_id)
        album = (
            Album.objects.select_for_update(of=("self",))
            .select_related("current_version")
            .get(pk=album.pk)
        )
        current = album.current_version.number if album.current_version else 0
        if base_version != current:
            raise ApiError(
                "version_conflict",
                "Cet album a été modifié ailleurs. Rechargez-le pour voir la dernière version.",
                status_code=409,
            )
        clean = album_content.validate(album_content.migrate(content), _allowed_photos(album))
        if title is not None:
            album.title = title.strip()[:200]
        _add_version(album, clean)
    return album


def restore(user: User, album_id: int, number: int) -> Album:
    """Restoring copies an old version into a new one: history is never rewritten."""
    with transaction.atomic():
        album = Album.objects.select_for_update().get(pk=get(user, album_id).pk)
        version = album.versions.filter(number=number).first()
        if version is None:
            raise ApiError("not_found", "Version introuvable.", status_code=404)
        _add_version(album, album_content.migrate(version.content))
    return album


def regenerate(user: User, album_id: int) -> Album:
    with transaction.atomic():
        album = (
            Album.objects.select_for_update(of=("self",))
            .select_related("current_version")
            .get(pk=get(user, album_id).pk)
        )
        current = album.current_version.content if album.current_version else {}
        album.layout_seed = random.randrange(2**31)
        photos = album.photos.filter(status=Photo.Status.READY)
        content = autolayout.build(
            [_info(p) for p in photos],
            format_id=album.format,
            theme=album.theme,
            accent=album.accent_color,
            seed=album.layout_seed,
            title=album.title,
            options=current.get("options"),
        )
        _add_version(album, content)
    return album


def delete(user: User, album_id: int) -> None:
    """Soft delete; files are purged later by purge_deleted()."""
    album = get(user, album_id)
    album.deleted_at = timezone.now()
    album.save(update_fields=["deleted_at"])


def purge_deleted() -> int:
    limit = timezone.now() - timedelta(days=settings.DELETED_ALBUMS_RETENTION_DAYS)
    albums = list(Album.objects.filter(deleted_at__lt=limit).prefetch_related("photos"))
    for album in albums:
        keys = [
            key
            for photo in album.photos.all()
            for key in (photo.original_key, photo.thumb_key, photo.preview_key)
        ]
        keys += list(
            ExportJob.objects.filter(album_version__album=album)
            .exclude(pdf_key="")
            .values_list("pdf_key", flat=True)
        )
        storage.delete(keys)
        album.photos.all().delete()
        album.delete()
    return len(albums)


def cover_photo_urls(user: User, page_albums: list[Album]) -> dict[int, str]:
    """Signed preview URLs for the cover photos of a page of albums, in one query."""
    ids = {
        slot["photoId"]
        for album in page_albums
        if album.current_version and album.current_version.content["pages"]
        for slot in album.current_version.content["pages"][0]["slots"]
        if slot.get("photoId")
    }
    rows = Photo.objects.filter(owner=user, pk__in=ids, status=Photo.Status.READY).values_list(
        "pk", "preview_key"
    )
    return {pk: storage.presign_download(key) for pk, key in rows if key}


def _add_version(album: Album, content: dict[str, Any]) -> AlbumVersion:
    last = album.versions.order_by("-number").values_list("number", flat=True).first() or 0
    version = AlbumVersion.objects.create(
        album=album,
        number=last + 1,
        content=content,
        schema_version=album_content.SCHEMA_VERSION,
    )
    album.current_version = version
    album.format = content["format"]
    album.theme = content["theme"]
    album.accent_color = content["accent"]
    album.save()
    _prune(album, keep_from=version.number - settings.ALBUM_VERSIONS_KEPT + 1)
    return version


def _prune(album: Album, keep_from: int) -> None:
    """Keep the last N versions; versions with a PDF export stay until the PDF expires."""
    album.versions.filter(number__lt=keep_from, exports__isnull=True).delete()


def _allowed_photos(album: Album) -> QuerySet[Photo, int]:
    return Photo.objects.filter(owner_id=album.owner_id, status=Photo.Status.READY).values_list(
        "pk", flat=True
    )


def _info(photo: Photo) -> autolayout.PhotoInfo:
    return autolayout.PhotoInfo(
        id=photo.pk,
        orientation=photo.orientation or "square",
        quality=photo.quality or "ok",
        pixels=(photo.width or 0) * (photo.height or 0),
        taken_at=photo.taken_at,
        name=photo.original_name,
    )
