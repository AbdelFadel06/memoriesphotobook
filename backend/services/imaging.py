"""Pure image processing on bytes: metadata, derivatives, dominant colours, print quality."""

from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import pyvips

from apps.layouts.catalog import PrintFormat

THUMB_SIZE = 400
PREVIEW_SIZE = 1600
JPEG_QUALITY = 85

# Loaders accepted after sniffing the real content (magic bytes), whatever the extension.
ALLOWED_LOADERS = {"jpegload_buffer", "pngload_buffer", "webpload_buffer", "heifload_buffer"}

DPI_OK = 250
DPI_LOW = 150


class InvalidImage(Exception):
    pass


@dataclass(frozen=True)
class ProcessedImage:
    width: int
    height: int
    orientation: str
    taken_at: datetime | None
    gps: dict[str, float] | None
    dominant_colors: list[str]
    thumb: bytes
    preview: bytes


def process(data: bytes) -> ProcessedImage:
    """Read metadata and build sRGB JPEG derivatives. The original bytes are never altered."""
    try:
        image = pyvips.Image.new_from_buffer(data, "", access="sequential")
    except pyvips.Error as exc:
        raise InvalidImage("unreadable image") from exc
    if image.get("vips-loader") not in ALLOWED_LOADERS:
        raise InvalidImage("unsupported image type")

    width, height = image.width, image.height
    if _exif_orientation(image) in (5, 6, 7, 8):
        width, height = height, width

    # thumbnail_buffer applies the EXIF orientation and shrinks on load. The preview is
    # rendered once into memory since thumb, colours and JPEG all read from it.
    # ICC conversion only when a profile is embedded: without one, libvips would still
    # round-trip through its own sRGB profile and shift the colours.
    icc = {"export_profile": "srgb"} if image.get_typeof("icc-profile-data") else {}
    preview = _to_srgb(
        pyvips.Image.thumbnail_buffer(data, PREVIEW_SIZE, height=PREVIEW_SIZE, size="down", **icc)
    ).copy_memory()
    thumb = preview.thumbnail_image(THUMB_SIZE, height=THUMB_SIZE, size="down")

    return ProcessedImage(
        width=width,
        height=height,
        orientation=orientation_of(width, height),
        taken_at=_taken_at(image),
        gps=_gps(image),
        dominant_colors=dominant_colors(thumb),
        thumb=_jpeg(thumb),
        preview=_jpeg(preview),
    )


def orientation_of(width: int, height: int) -> str:
    if width > height:
        return "landscape"
    if height > width:
        return "portrait"
    return "square"


def quality_for(width: int, height: int, fmt: PrintFormat) -> str:
    """Grade a photo against its largest standard use: a full page of the album format."""
    page_long_in = max(fmt.page_size_in())
    dpi = max(width, height) / page_long_in
    if dpi >= DPI_OK:
        return "ok"
    if dpi >= DPI_LOW:
        return "low"
    return "bad"


def dominant_colors(image: pyvips.Image, count: int = 3) -> list[str]:
    """Most frequent colours, quantised to 8 levels per channel then averaged per bucket."""
    small = image.thumbnail_image(64, height=64)
    pixels = bytes(small.extract_band(0, n=3).write_to_memory())
    buckets: Counter[tuple[int, int, int]] = Counter()
    sums: dict[tuple[int, int, int], list[int]] = {}
    for i in range(0, len(pixels), 3):
        r, g, b = pixels[i], pixels[i + 1], pixels[i + 2]
        key = (r >> 5, g >> 5, b >> 5)
        buckets[key] += 1
        acc = sums.setdefault(key, [0, 0, 0])
        acc[0] += r
        acc[1] += g
        acc[2] += b
    colors = []
    for key, n in buckets.most_common(count):
        r, g, b = (round(c / n) for c in sums[key])
        colors.append(f"#{r:02x}{g:02x}{b:02x}")
    return colors


def _to_srgb(image: pyvips.Image) -> pyvips.Image:
    if image.hasalpha():
        image = image.flatten(background=[255, 255, 255])
    if image.interpretation != "srgb":
        image = image.colourspace("srgb")
    return image.cast("uchar") if image.format != "uchar" else image


def _jpeg(image: pyvips.Image) -> bytes:
    # strip drops every metadata block, GPS included.
    data: bytes = image.jpegsave_buffer(Q=JPEG_QUALITY, strip=True, optimize_coding=True)
    return data


def _field(image: pyvips.Image, name: str) -> str | None:
    if image.get_typeof(name) == 0:
        return None
    value: Any = image.get(name)
    if isinstance(value, bytes):
        value = value.decode("utf-8", "replace")
    # libvips formats EXIF strings as "<value> (<readable>, <type>, ...)"
    return str(value).split(" (", 1)[0].strip() or None


def _exif_orientation(image: pyvips.Image) -> int:
    if image.get_typeof("orientation") != 0:
        return int(image.get("orientation"))
    return 1


def _taken_at(image: pyvips.Image) -> datetime | None:
    for name in ("exif-ifd2-DateTimeOriginal", "exif-ifd0-DateTime"):
        raw = _field(image, name)
        if not raw:
            continue
        try:
            # EXIF has no time zone; stored as UTC by convention.
            return datetime.strptime(raw[:19], "%Y:%m:%d %H:%M:%S").replace(tzinfo=UTC)
        except ValueError:
            continue
    return None


def _gps(image: pyvips.Image) -> dict[str, float] | None:
    try:
        lat = _dms(
            _field(image, "exif-ifd3-GPSLatitude"), _field(image, "exif-ifd3-GPSLatitudeRef")
        )
        lon = _dms(
            _field(image, "exif-ifd3-GPSLongitude"), _field(image, "exif-ifd3-GPSLongitudeRef")
        )
    except (ValueError, ZeroDivisionError):
        return None
    if lat is None or lon is None:
        return None
    return {"lat": round(lat, 6), "lon": round(lon, 6)}


def _dms(raw: str | None, ref: str | None) -> float | None:
    if not raw:
        return None
    parts = []
    for rational in raw.split()[:3]:
        num, _, den = rational.partition("/")
        parts.append(float(num) / float(den or 1))
    while len(parts) < 3:
        parts.append(0.0)
    value = parts[0] + parts[1] / 60 + parts[2] / 3600
    return -value if (ref or "").upper().startswith(("S", "W")) else value
