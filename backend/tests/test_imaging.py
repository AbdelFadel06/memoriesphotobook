from datetime import UTC, datetime

import pytest
import pyvips

from apps.layouts.catalog import get_format
from services import imaging

from .fixtures.images import make_image


def test_process_jpeg_builds_srgb_derivatives() -> None:
    result = imaging.process(make_image(3000, 2000))
    assert (result.width, result.height, result.orientation) == (3000, 2000, "landscape")

    thumb = pyvips.Image.new_from_buffer(result.thumb, "")
    preview = pyvips.Image.new_from_buffer(result.preview, "")
    assert max(thumb.width, thumb.height) == imaging.THUMB_SIZE
    assert max(preview.width, preview.height) == imaging.PREVIEW_SIZE
    assert thumb.get("vips-loader") == "jpegload_buffer"


def test_small_image_is_not_upscaled() -> None:
    result = imaging.process(make_image(300, 200))
    preview = pyvips.Image.new_from_buffer(result.preview, "")
    assert (preview.width, preview.height) == (300, 200)


def test_exif_orientation_swaps_dimensions() -> None:
    result = imaging.process(make_image(600, 400, orientation=6))
    assert (result.width, result.height, result.orientation) == (400, 600, "portrait")
    preview = pyvips.Image.new_from_buffer(result.preview, "")
    assert preview.height > preview.width


def test_png_with_alpha_is_flattened() -> None:
    rgba = (pyvips.Image.black(50, 50, bands=4) + [10, 20, 30, 0]).cast("uchar")
    result = imaging.process(rgba.copy(interpretation="srgb").write_to_buffer(".png"))
    assert pyvips.Image.new_from_buffer(result.thumb, "").bands == 3


def test_reads_date_and_gps() -> None:
    data = make_image(
        exif={
            "exif-ifd2-DateTimeOriginal": "2026:07:01 10:30:00",
            "exif-ifd3-GPSLatitude": "6/1 22/1 0/1",
            "exif-ifd3-GPSLatitudeRef": "N",
            "exif-ifd3-GPSLongitude": "2/1 25/1 30/1",
            "exif-ifd3-GPSLongitudeRef": "E",
        }
    )
    result = imaging.process(data)
    assert result.taken_at == datetime(2026, 7, 1, 10, 30, tzinfo=UTC)
    assert result.gps == {"lat": pytest.approx(6.366667), "lon": pytest.approx(2.425)}


def test_derivatives_carry_no_metadata() -> None:
    data = make_image(exif={"exif-ifd3-GPSLatitude": "6/1 22/1 0/1"})
    result = imaging.process(data)
    preview = pyvips.Image.new_from_buffer(result.preview, "")
    assert preview.get_typeof("exif-data") == 0


def test_dominant_colors() -> None:
    result = imaging.process(make_image(fmt=".png", color=(200, 40, 40)))
    assert result.dominant_colors[0] == "#c82828"


@pytest.mark.parametrize("data", [b"not an image", b"GIF89a" + b"\x00" * 64])
def test_rejects_unsupported_content(data: bytes) -> None:
    with pytest.raises(imaging.InvalidImage):
        imaging.process(data)


def test_rejects_gif_even_when_decodable() -> None:
    gif = make_image(fmt=".gif")
    with pytest.raises(imaging.InvalidImage):
        imaging.process(gif)


@pytest.mark.parametrize(
    ("long_side", "expected"),
    [(3000, "ok"), (2100, "low"), (1000, "bad")],
)
def test_quality_against_full_square_page(long_side: int, expected: str) -> None:
    # square_21 with bleed = 216 mm ≈ 8.5 in → 250 dpi ≈ 2126 px, 150 dpi ≈ 1276 px
    assert imaging.quality_for(long_side, long_side, get_format("square_21")) == expected
