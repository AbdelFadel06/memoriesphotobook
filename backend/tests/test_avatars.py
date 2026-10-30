import pytest
import pyvips
from rest_framework.test import APIClient

from apps.accounts.models import User

from .conftest import FakeStorage
from .fixtures.images import make_image

pytestmark = pytest.mark.django_db


def upload(auth_api: APIClient, fake_storage: FakeStorage, data: bytes) -> str:
    res = auth_api.post(
        "/api/auth/me/avatar/presign",
        {"content_type": "image/jpeg", "size": len(data)},
        format="json",
    )
    assert res.status_code == 201
    fake_storage.objects[res.data["key"]] = data
    return str(res.data["key"])


def test_avatar_upload_crops_to_square(
    auth_api: APIClient, user: User, fake_storage: FakeStorage
) -> None:
    key = upload(auth_api, fake_storage, make_image(900, 600))
    res = auth_api.post("/api/auth/me/avatar", {"key": key}, format="json")
    assert res.status_code == 200
    assert res.data["avatar_url"].startswith(f"http://storage.test/users/{user.pk}/avatars/")
    user.refresh_from_db()
    avatar = pyvips.Image.new_from_buffer(fake_storage.objects[user.avatar_key], "")
    assert (avatar.width, avatar.height) == (400, 400)
    assert key not in fake_storage.objects  # the raw upload is removed


def test_replacing_avatar_deletes_the_previous_one(
    auth_api: APIClient, user: User, fake_storage: FakeStorage
) -> None:
    auth_api.post(
        "/api/auth/me/avatar", {"key": upload(auth_api, fake_storage, make_image())}, format="json"
    )
    user.refresh_from_db()
    first = user.avatar_key
    auth_api.post(
        "/api/auth/me/avatar", {"key": upload(auth_api, fake_storage, make_image())}, format="json"
    )
    user.refresh_from_db()
    assert user.avatar_key != first
    assert first not in fake_storage.objects


def test_avatar_rejects_key_of_another_user(
    auth_api: APIClient, other_user: User, fake_storage: FakeStorage
) -> None:
    key = f"users/{other_user.pk}/avatars/uploads/{'a' * 32}.jpg"
    fake_storage.objects[key] = make_image()
    res = auth_api.post("/api/auth/me/avatar", {"key": key}, format="json")
    assert res.status_code == 400
    assert res.data["code"] == "invalid_key"


def test_avatar_rejects_non_image(auth_api: APIClient, fake_storage: FakeStorage) -> None:
    key = upload(auth_api, fake_storage, b"<html>not an image</html>")
    res = auth_api.post("/api/auth/me/avatar", {"key": key}, format="json")
    assert res.status_code == 400
    assert res.data["code"] == "invalid_image"


def test_avatar_presign_limits_size(auth_api: APIClient) -> None:
    res = auth_api.post(
        "/api/auth/me/avatar/presign",
        {"content_type": "image/jpeg", "size": 6 * 1024 * 1024},
        format="json",
    )
    assert res.data["code"] == "file_too_large"


def test_remove_avatar(auth_api: APIClient, user: User, fake_storage: FakeStorage) -> None:
    auth_api.post(
        "/api/auth/me/avatar", {"key": upload(auth_api, fake_storage, make_image())}, format="json"
    )
    user.refresh_from_db()
    old = user.avatar_key
    res = auth_api.delete("/api/auth/me/avatar")
    assert res.status_code == 200
    assert res.data["avatar_url"] is None
    assert old not in fake_storage.objects
