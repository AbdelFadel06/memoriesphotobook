import io
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import patch

import pikepdf
import pytest
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.albums.models import Album, AlbumVersion
from apps.exports.models import ExportJob
from services import exports, pdf_renderer

from .conftest import FakeStorage
from .factories import AlbumFactory

pytestmark = pytest.mark.django_db

CONTENT: dict[str, Any] = {
    "schemaVersion": 1,
    "format": "A4_portrait",
    "theme": "galerie_claire",
    "accent": "#3b3b3b",
    "options": {"verticalTitle": True, "line": True, "captions": True},
    "pages": [
        {
            "id": "p1",
            "layout": "cover_block",
            "slots": [{"slot": "photo1", "photoId": 1}, {"slot": "title", "text": "Bénin"}],
        },
        {"id": "p2", "layout": "spread_full", "slots": [{"slot": "photo1", "photoId": 2}]},
        {"id": "p3", "layout": "photo_caption", "slots": [{"slot": "photo1", "photoId": 1}]},
    ],
}


def album_with_version(owner: User) -> Album:
    album = AlbumFactory(owner=owner)
    album.current_version = AlbumVersion.objects.create(
        album=album, number=1, content=CONTENT, schema_version=1
    )
    album.save()
    return album


def test_export_queues_job(
    auth_api: APIClient, user: User, django_capture_on_commit_callbacks: Any
) -> None:
    album = album_with_version(user)
    with patch("apps.exports.tasks.render_export.delay") as delay:
        with django_capture_on_commit_callbacks(execute=True):
            res = auth_api.post(f"/api/albums/{album.pk}/export")
    assert res.status_code == 202
    assert res.data["status"] == "queued"
    assert res.data["download_url"] is None
    delay.assert_called_once_with(res.data["id"])


def test_export_other_users_album_is_404(auth_api: APIClient, other_user: User) -> None:
    album = album_with_version(other_user)
    assert auth_api.post(f"/api/albums/{album.pk}/export").status_code == 404


def test_export_empty_album_is_conflict(auth_api: APIClient, user: User) -> None:
    album = AlbumFactory(owner=user)
    res = auth_api.post(f"/api/albums/{album.pk}/export")
    assert res.status_code == 409


@override_settings(EXPORTS_CONCURRENT_PER_USER=1)
def test_export_limits_concurrent_jobs(auth_api: APIClient, user: User) -> None:
    album = album_with_version(user)
    ExportJob.objects.create(album_version=album.current_version)
    res = auth_api.post(f"/api/albums/{album.pk}/export")
    assert res.status_code == 429
    assert res.data["code"] == "too_many_exports"


@override_settings(EXPORTS_PER_DAY=1)
def test_export_limits_daily_jobs(auth_api: APIClient, user: User) -> None:
    album = album_with_version(user)
    ExportJob.objects.create(album_version=album.current_version, status="done")
    assert auth_api.post(f"/api/albums/{album.pk}/export").data["code"] == "daily_export_limit"


def test_export_status_and_download(auth_api: APIClient, user: User) -> None:
    album = album_with_version(user)
    job = ExportJob.objects.create(
        album_version=album.current_version, status="done", pdf_key="users/1/exports/1.pdf"
    )
    res = auth_api.get(f"/api/exports/{job.pk}")
    assert res.status_code == 200
    assert res.data["status"] == "done"
    assert res.data["download_url"].startswith("http://storage.test/users/1/exports/1.pdf")


def test_export_status_of_other_user_is_404(auth_api: APIClient, other_user: User) -> None:
    job = ExportJob.objects.create(album_version=album_with_version(other_user).current_version)
    assert auth_api.get(f"/api/exports/{job.pk}").status_code == 404


def test_failed_job_has_readable_error(user: User) -> None:
    job = ExportJob.objects.create(album_version=album_with_version(user).current_version)
    exports.mark_failed(job.pk)
    job.refresh_from_db()
    assert job.status == "failed"
    assert "Réessayez" in job.error
    assert job.finished_at is not None


def test_cleanup_removes_old_pdfs(user: User, fake_storage: FakeStorage) -> None:
    version = album_with_version(user).current_version
    old = ExportJob.objects.create(album_version=version, status="done", pdf_key="old.pdf")
    ExportJob.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=31))
    recent = ExportJob.objects.create(album_version=version, status="done", pdf_key="new.pdf")
    fake_storage.objects.update({"old.pdf": b"%PDF", "new.pdf": b"%PDF"})

    assert exports.cleanup() == 1
    assert "old.pdf" not in fake_storage.objects
    assert "new.pdf" in fake_storage.objects
    old.refresh_from_db()
    recent.refresh_from_db()
    assert (old.pdf_key, recent.pdf_key) == ("", "new.pdf")


def test_build_sheets_numbers_pages_and_maps_photos() -> None:
    sheets = pdf_renderer.build_sheets(CONTENT, {1: "http://s/1.jpg", 2: "http://s/2.jpg"})
    assert [s.spread for s in sheets] == [False, True, False]
    assert [s.payload["folio"] for s in sheets] == ["1", "2", "4"]
    assert sheets[0].payload["runningTitle"] == "Bénin"
    assert sheets[1].payload["photos"] == {"2": {"src": "http://s/2.jpg"}}


def test_print_resolution_follows_largest_use() -> None:
    needed = pdf_renderer.print_long_side_px(CONTENT)
    # A4 page with bleed: 303 mm ≈ 11.93 in; spread: 426 mm ≈ 16.77 in, at 300 dpi.
    assert needed == {1: 3579, 2: 5031}


def _blank_pdf(width_pt: float, height_pt: float) -> bytes:
    pdf = pikepdf.Pdf.new()
    pdf.add_blank_page(page_size=(width_pt, height_pt))
    buffer = io.BytesIO()
    pdf.save(buffer)
    return buffer.getvalue()


def test_merge_is_deterministic_and_keeps_sizes() -> None:
    parts = [_blank_pdf(612, 859), _blank_pdf(1208, 859)]
    stamp = datetime(2026, 7, 1, tzinfo=UTC)
    first = pdf_renderer.merge(parts, created_at=stamp)
    assert first == pdf_renderer.merge(parts, created_at=stamp)
    with pikepdf.Pdf.open(io.BytesIO(first)) as pdf:
        assert [float(p.mediabox[2]) for p in pdf.pages] == [612, 1208]
