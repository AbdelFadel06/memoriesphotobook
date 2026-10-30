from typing import Any
from unittest.mock import patch

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.photos.models import Photo
from services import photos

from .conftest import FakeStorage
from .factories import AlbumFactory, PhotoFactory
from .fixtures.images import make_image

pytestmark = pytest.mark.django_db


def presign(client: APIClient, **overrides: Any) -> Any:
    payload = {"content_type": "image/jpeg", "size": 1234, "format": "square_21"} | overrides
    return client.post("/api/photos/presign", payload, format="json")


def test_presign_creates_pending_photo(auth_api: APIClient, user: User) -> None:
    res = presign(auth_api, filename="plage.jpg")
    assert res.status_code == 201
    assert res.data["upload_url"].startswith("http://storage.test/users/")
    assert res.data["headers"] == {"Content-Type": "image/jpeg"}
    photo = Photo.objects.get(pk=res.data["photo_id"])
    assert photo.owner == user
    assert photo.status == Photo.Status.PENDING
    assert photo.original_key.startswith(f"users/{user.pk}/originals/")


def test_presign_requires_auth(api: APIClient) -> None:
    assert presign(api).status_code == 401


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"content_type": "image/gif"}, "content_type"),
        ({"format": "A3"}, "format"),
        ({"size": 0}, "size"),
    ],
)
def test_presign_validates_input(
    auth_api: APIClient, overrides: dict[str, Any], field: str
) -> None:
    res = presign(auth_api, **overrides)
    assert res.status_code == 400
    assert field in res.data["fields"]


def test_presign_rejects_large_file(auth_api: APIClient) -> None:
    res = presign(auth_api, size=31 * 1024 * 1024)
    assert res.status_code == 400
    assert res.data["code"] == "file_too_large"


def test_presign_enforces_photo_quota(auth_api: APIClient, user: User) -> None:
    user.quota_photos = 1
    user.save()
    PhotoFactory(owner=user)
    res = presign(auth_api)
    assert res.status_code == 400
    assert res.data["code"] == "photo_quota"


@override_settings(STORAGE_PER_USER_BYTES=2000)
def test_presign_enforces_storage_quota(auth_api: APIClient, user: User) -> None:
    PhotoFactory(owner=user, size_bytes=1500)
    res = presign(auth_api, size=600)
    assert res.data["code"] == "storage_quota"


@override_settings(PHOTOS_PER_ALBUM=1)
def test_presign_enforces_album_limit(auth_api: APIClient, user: User) -> None:
    album = AlbumFactory(owner=user)
    PhotoFactory(owner=user, album=album)
    res = presign(auth_api, album=album.pk)
    assert res.data["code"] == "album_full"


def test_presign_into_someone_elses_album_is_404(auth_api: APIClient, other_user: User) -> None:
    album = AlbumFactory(owner=other_user)
    assert presign(auth_api, album=album.pk).status_code == 404


def test_confirm_queues_processing(
    auth_api: APIClient, fake_storage: FakeStorage, django_capture_on_commit_callbacks: Any
) -> None:
    photo_id = presign(auth_api, size=4).data["photo_id"]
    fake_storage.objects[Photo.objects.get(pk=photo_id).original_key] = b"data"
    with patch("apps.photos.tasks.process_photo.delay") as delay:
        with django_capture_on_commit_callbacks(execute=True):
            res = auth_api.post("/api/photos/confirm", {"photo_id": photo_id}, format="json")
    assert res.status_code == 202
    delay.assert_called_once_with(photo_id)


def test_confirm_before_upload_is_conflict(auth_api: APIClient) -> None:
    photo_id = presign(auth_api).data["photo_id"]
    res = auth_api.post("/api/photos/confirm", {"photo_id": photo_id}, format="json")
    assert res.status_code == 409
    assert res.data["code"] == "upload_missing"


def test_confirm_with_wrong_size_fails_photo(
    auth_api: APIClient, fake_storage: FakeStorage
) -> None:
    photo_id = presign(auth_api, size=10).data["photo_id"]
    fake_storage.objects[Photo.objects.get(pk=photo_id).original_key] = b"short"
    res = auth_api.post("/api/photos/confirm", {"photo_id": photo_id}, format="json")
    assert res.status_code == 409
    assert Photo.objects.get(pk=photo_id).status == Photo.Status.FAILED


def test_confirm_other_users_photo_is_404(auth_api: APIClient, other_user: User) -> None:
    photo = PhotoFactory(owner=other_user)
    res = auth_api.post("/api/photos/confirm", {"photo_id": photo.pk}, format="json")
    assert res.status_code == 404


def test_process_stores_derivatives_and_metadata(fake_storage: FakeStorage, user: User) -> None:
    original = make_image(3000, 2000)
    photo = PhotoFactory(owner=user, size_bytes=len(original))
    fake_storage.objects[photo.original_key] = original

    photos.process(photo.pk)

    photo.refresh_from_db()
    assert photo.status == Photo.Status.READY
    assert (photo.width, photo.height, photo.orientation) == (3000, 2000, "landscape")
    assert photo.quality == "ok"
    assert photo.thumb_key in fake_storage.objects
    assert photo.preview_key in fake_storage.objects
    # The original is never modified.
    assert fake_storage.objects[photo.original_key] == original


def test_process_rejects_fake_image(fake_storage: FakeStorage, user: User) -> None:
    photo = PhotoFactory(owner=user)
    fake_storage.objects[photo.original_key] = b"<html>not a photo</html>"
    photos.process(photo.pk)
    photo.refresh_from_db()
    assert photo.status == Photo.Status.FAILED
    assert photo.original_key not in fake_storage.objects


def test_list_only_returns_own_photos_without_gps(
    auth_api: APIClient, user: User, other_user: User
) -> None:
    mine = PhotoFactory(owner=user, status=Photo.Status.READY, gps={"lat": 1, "lon": 2})
    PhotoFactory(owner=other_user, status=Photo.Status.READY)
    PhotoFactory(owner=user, status=Photo.Status.FAILED)

    res = auth_api.get("/api/photos")
    assert res.status_code == 200
    assert [p["id"] for p in res.data["results"]] == [mine.pk]
    assert "gps" not in res.data["results"][0]


def test_list_filters_by_album(auth_api: APIClient, user: User) -> None:
    album = AlbumFactory(owner=user)
    in_album = PhotoFactory(owner=user, album=album)
    PhotoFactory(owner=user)
    res = auth_api.get(f"/api/photos?album={album.pk}")
    assert [p["id"] for p in res.data["results"]] == [in_album.pk]


def test_list_filters_by_ids_of_own_photos(
    auth_api: APIClient, user: User, other_user: User
) -> None:
    a, b = PhotoFactory(owner=user), PhotoFactory(owner=user)
    PhotoFactory(owner=user)
    foreign = PhotoFactory(owner=other_user)
    res = auth_api.get(f"/api/photos?ids={a.pk},{b.pk},{foreign.pk},x")
    assert sorted(p["id"] for p in res.data["results"]) == sorted([a.pk, b.pk])
