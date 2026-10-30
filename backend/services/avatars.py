"""Profile picture: presign -> direct upload to storage -> confirm (cropped server-side)."""

import re
import uuid
from dataclasses import dataclass

from django.conf import settings

from apps.accounts.models import User
from config.exceptions import ApiError

from . import imaging, storage

EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}


@dataclass(frozen=True)
class PresignedAvatar:
    key: str
    upload_url: str


def presign(user: User, *, content_type: str, size: int) -> PresignedAvatar:
    if content_type not in EXTENSIONS:
        raise ApiError("unsupported_type", "Ce type de fichier n'est pas accepté.")
    if size <= 0 or size > settings.AVATAR_MAX_BYTES:
        max_mb = settings.AVATAR_MAX_BYTES // (1024 * 1024)
        raise ApiError("file_too_large", f"La photo dépasse {max_mb} Mo.")
    key = f"{_upload_prefix(user)}{uuid.uuid4().hex}.{EXTENSIONS[content_type]}"
    return PresignedAvatar(key, storage.presign_upload(key, content_type, size))


def confirm(user: User, key: str) -> User:
    # Only keys handed out by presign() for this very user are accepted.
    if not re.fullmatch(re.escape(_upload_prefix(user)) + r"[0-9a-f]{32}\.[a-z]{3,4}", key):
        raise ApiError("invalid_key", "Envoi de photo invalide.")
    size = storage.object_size(key)
    if size is None:
        raise ApiError("upload_missing", "L'envoi de la photo n'est pas terminé.", status_code=409)
    try:
        if size > settings.AVATAR_MAX_BYTES:
            raise ApiError("file_too_large", "La photo est trop lourde.")
        try:
            data = imaging.avatar(storage.read(key))
        except imaging.InvalidImage as exc:
            raise ApiError("invalid_image", "Ce fichier n'est pas une photo lisible.") from exc
    finally:
        storage.delete([key])

    new_key = f"users/{user.pk}/avatars/{uuid.uuid4().hex}.jpg"
    storage.write(new_key, data, "image/jpeg")
    old_key = user.avatar_key
    user.avatar_key = new_key
    user.save(update_fields=["avatar_key"])
    storage.delete([old_key])
    return user


def remove(user: User) -> User:
    storage.delete([user.avatar_key])
    user.avatar_key = ""
    user.save(update_fields=["avatar_key"])
    return user


def url(user: User) -> str | None:
    return storage.presign_download(user.avatar_key) if user.avatar_key else None


def _upload_prefix(user: User) -> str:
    return f"users/{user.pk}/avatars/uploads/"
