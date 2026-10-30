"""End-to-end PDF check. Run inside the pdf-worker container:

docker compose exec -e PDF_INTEGRATION=1 pdf-worker pytest -m pdf_integration
"""

import io
import os

import pikepdf
import pytest
from django.core.management import call_command

from apps.albums.models import Album
from apps.exports.models import ExportJob
from services import exports, storage

pytestmark = [
    pytest.mark.pdf_integration,
    pytest.mark.django_db,
    pytest.mark.skipif(not os.environ.get("PDF_INTEGRATION"), reason="needs the pdf-worker"),
]

MM_TO_PT = 72 / 25.4


@pytest.mark.parametrize(
    ("fmt", "page_mm", "spread_mm"),
    [
        ("A4_portrait", (216, 303), (426, 303)),
        ("square_21", (216, 216), (426, 216)),
    ],
)
def test_sample_album_pdf_has_bleed_sizes(
    fmt: str, page_mm: tuple[int, int], spread_mm: tuple[int, int]
) -> None:
    call_command("create_sample_album", email=f"pdf-{fmt}@example.com", format=fmt)
    album = Album.objects.latest("pk")
    job = ExportJob.objects.create(album_version=album.current_version)

    exports.run(job.pk)

    job.refresh_from_db()
    assert job.status == ExportJob.Status.DONE
    with pikepdf.Pdf.open(io.BytesIO(storage.read(job.pdf_key))) as pdf:
        sizes = [
            (round(float(p.mediabox[2]) / MM_TO_PT), round(float(p.mediabox[3]) / MM_TO_PT))
            for p in pdf.pages
        ]
    assert sizes == [page_mm, page_mm, page_mm, page_mm, spread_mm]
