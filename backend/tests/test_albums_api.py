from typing import Any

import pytest
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.albums.models import Album, AlbumVersion
from apps.photos.models import Photo
from services import albums

from .factories import PhotoFactory

pytestmark = pytest.mark.django_db


def ready_photos(owner: User, *orientations: str) -> list[Photo]:
    return [
        PhotoFactory(
            owner=owner,
            status=Photo.Status.READY,
            orientation=o,
            quality="ok",
            width=4000,
            height=3000,
            thumb_key=f"t{i}.jpg",
            preview_key=f"p{i}.jpg",
        )
        for i, o in enumerate(orientations)
    ]


def create(client: APIClient, photo_ids: list[int], **overrides: Any) -> Any:
    payload = {
        "title": "Bénin 2026",
        "format": "square_21",
        "theme": "galerie_claire",
        "photo_ids": photo_ids,
    } | overrides
    return client.post("/api/albums", payload, format="json")


def test_create_album_runs_autolayout(auth_api: APIClient, user: User) -> None:
    photos = ready_photos(user, "portrait", "landscape", "portrait")
    res = create(auth_api, [p.pk for p in photos])
    assert res.status_code == 201
    assert res.data["version"] == 1
    assert res.data["content"]["format"] == "square_21"
    assert res.data["content"]["accent"] == "#3b3b3b"  # theme default
    assert res.data["page_count"] % 2 == 0
    assert Photo.objects.filter(album_id=res.data["id"]).count() == 3


def test_create_rejects_photos_of_another_user(auth_api: APIClient, other_user: User) -> None:
    foreign = ready_photos(other_user, "portrait")
    res = create(auth_api, [foreign[0].pk])
    assert res.status_code == 400
    assert res.data["code"] == "photo_not_found"


def test_create_waits_for_processing_photos(auth_api: APIClient, user: User) -> None:
    pending = PhotoFactory(owner=user, status=Photo.Status.PENDING)
    res = create(auth_api, [pending.pk])
    assert res.status_code == 409
    assert res.data["code"] == "photos_processing"


def test_create_validates_format_and_theme(auth_api: APIClient) -> None:
    res = create(auth_api, [], format="A3", theme="neon")
    assert res.status_code == 400
    assert {"format", "theme"} <= set(res.data["fields"])


def test_list_is_paginated_and_own_only(
    auth_api: APIClient, user: User, other_user: User, django_assert_max_num_queries: Any
) -> None:
    for _ in range(3):
        create(auth_api, [p.pk for p in ready_photos(user, "portrait", "portrait")])
    albums.create(
        other_user, title="x", format_id="square_21", theme="galerie_claire", photo_ids=[]
    )
    deleted = create(auth_api, []).data["id"]
    auth_api.delete(f"/api/albums/{deleted}")

    with django_assert_max_num_queries(4):  # count-free cursor page: no N+1
        res = auth_api.get("/api/albums")
    assert res.status_code == 200
    assert len(res.data["results"]) == 3
    cover = res.data["results"][0]["cover"]
    assert cover["page"]["layout"] == "cover_block"
    photo_id = next(s["photoId"] for s in cover["page"]["slots"] if "photoId" in s)
    assert cover["photos"][str(photo_id)]["src"].startswith("http://storage.test/")


def test_detail_of_other_user_is_404(auth_api: APIClient, other_user: User) -> None:
    album = albums.create(
        other_user, title="x", format_id="square_21", theme="galerie_claire", photo_ids=[]
    )
    assert auth_api.get(f"/api/albums/{album.pk}").status_code == 404
    assert auth_api.put(f"/api/albums/{album.pk}", {}, format="json").status_code in (400, 404)
    assert auth_api.delete(f"/api/albums/{album.pk}").status_code == 404


def test_save_creates_new_version(auth_api: APIClient, user: User) -> None:
    created = create(auth_api, [p.pk for p in ready_photos(user, "portrait")]).data
    content = created["content"]
    content["pages"][0]["slots"] = [
        s if s["slot"] != "title" else {"slot": "title", "text": "Été 2026"}
        for s in content["pages"][0]["slots"]
    ]
    content["accent"] = "#FF0000"
    res = auth_api.put(
        f"/api/albums/{created['id']}",
        {"base_version": 1, "content": content, "title": "Été 2026"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["version"] == 2
    assert res.data["title"] == "Été 2026"
    assert res.data["accent_color"] == "#ff0000"
    assert AlbumVersion.objects.filter(album_id=created["id"]).count() == 2
    # The previous version is untouched.
    first = AlbumVersion.objects.get(album_id=created["id"], number=1)
    assert first.content["accent"] == "#3b3b3b"


def test_save_conflict_when_base_is_outdated(auth_api: APIClient, user: User) -> None:
    created = create(auth_api, []).data
    url = f"/api/albums/{created['id']}"
    assert (
        auth_api.put(
            url, {"base_version": 1, "content": created["content"]}, format="json"
        ).status_code
        == 200
    )
    res = auth_api.put(url, {"base_version": 1, "content": created["content"]}, format="json")
    assert res.status_code == 409
    assert res.data["code"] == "version_conflict"


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda c: c["pages"][0].update(layout="nope"), "disposition inconnue"),
        (lambda c: c["pages"][0]["slots"].append({"slot": "ghost", "text": "x"}), "ghost"),
        (lambda c: c.update(theme="neon"), "Thème inconnu"),
        (lambda c: c.update(accent="red"), "accent"),
        (
            lambda c: c["pages"][0]["slots"].__setitem__(0, {"slot": "photo1", "photoId": 999999}),
            "photo introuvable",
        ),
        (
            lambda c: c["pages"][0]["slots"].__setitem__(
                0, {"slot": "photo1", "photoId": None, "focus": [2, 0]}
            ),
            "cadrage",
        ),
    ],
)
def test_save_rejects_invalid_content(
    auth_api: APIClient, user: User, mutate: Any, message: str
) -> None:
    created = create(auth_api, [p.pk for p in ready_photos(user, "portrait")]).data
    content = created["content"]
    mutate(content)
    res = auth_api.put(
        f"/api/albums/{created['id']}", {"base_version": 1, "content": content}, format="json"
    )
    assert res.status_code == 400
    assert message in " ".join(res.data["fields"]["content"])


def test_save_rejects_photo_of_another_user(
    auth_api: APIClient, user: User, other_user: User
) -> None:
    created = create(auth_api, [p.pk for p in ready_photos(user, "portrait")]).data
    foreign = ready_photos(other_user, "portrait")[0]
    content = created["content"]
    content["pages"][0]["slots"][0] = {"slot": "photo1", "photoId": foreign.pk}
    res = auth_api.put(
        f"/api/albums/{created['id']}", {"base_version": 1, "content": content}, format="json"
    )
    assert res.status_code == 400


def test_versions_and_restore(auth_api: APIClient, user: User) -> None:
    created = create(auth_api, []).data
    url = f"/api/albums/{created['id']}"
    content = created["content"]
    content["accent"] = "#000000"
    auth_api.put(url, {"base_version": 1, "content": content}, format="json")

    versions = auth_api.get(f"{url}/versions").data
    assert [v["number"] for v in versions] == [2, 1]

    restored = auth_api.post(f"{url}/versions/1/restore").data
    assert restored["version"] == 3
    assert restored["content"]["accent"] == "#3b3b3b"
    assert auth_api.post(f"{url}/versions/99/restore").status_code == 404


@override_settings(ALBUM_VERSIONS_KEPT=3)
def test_old_versions_are_pruned(auth_api: APIClient, user: User) -> None:
    created = create(auth_api, []).data
    url = f"/api/albums/{created['id']}"
    for base in range(1, 6):
        auth_api.put(url, {"base_version": base, "content": created["content"]}, format="json")
    numbers = list(
        AlbumVersion.objects.filter(album_id=created["id"]).values_list("number", flat=True)
    )
    assert sorted(numbers) == [4, 5, 6]


def test_autolayout_regenerates_a_new_version(auth_api: APIClient, user: User) -> None:
    created = create(auth_api, [p.pk for p in ready_photos(user, "portrait", "landscape")]).data
    res = auth_api.post(f"/api/albums/{created['id']}/autolayout")
    assert res.status_code == 200
    assert res.data["version"] == 2


def test_delete_is_soft_then_purged(auth_api: APIClient, user: User) -> None:
    created = create(auth_api, [p.pk for p in ready_photos(user, "portrait")]).data
    assert auth_api.delete(f"/api/albums/{created['id']}").status_code == 204
    assert auth_api.get(f"/api/albums/{created['id']}").status_code == 404
    album = Album.objects.get(pk=created["id"])
    assert album.deleted_at is not None

    Album.objects.filter(pk=album.pk).update(
        deleted_at=timezone.now() - timezone.timedelta(days=31)
    )
    assert albums.purge_deleted() == 1
    assert not Album.objects.filter(pk=album.pk).exists()
    assert not Photo.objects.filter(owner=user).exists()


def test_catalog_is_public(api: APIClient) -> None:
    res = api.get("/api/catalog")
    assert res.status_code == 200
    assert {t["id"] for t in res.data["themes"]} == {"galerie_claire", "bloc_couleur"}
    assert "text_page" in {t["id"] for t in res.data["templates"]}
    assert res.data["formats"]["bleedMm"] == 3


def test_create_keeps_manual_order(auth_api: APIClient, user: User) -> None:
    photos = ready_photos(user, "square", "square", "square", "square")
    ids = [photos[2].pk, photos[0].pk, photos[3].pk, photos[1].pk]
    res = create(auth_api, ids, order="manual")
    placed = [
        s["photoId"] for p in res.data["content"]["pages"] for s in p["slots"] if s.get("photoId")
    ]
    cover = placed[0]
    assert placed[1:] == [i for i in ids if i != cover]
