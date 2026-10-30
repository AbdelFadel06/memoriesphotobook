"""Tiny generated images, so no binary fixtures live in the repo."""

import pyvips


def make_image(
    width: int = 60,
    height: int = 40,
    *,
    fmt: str = ".jpg",
    color: tuple[int, int, int] = (200, 40, 40),
    orientation: int | None = None,
    exif: dict[str, str] | None = None,
) -> bytes:
    image = (pyvips.Image.black(width, height, bands=3) + list(color)).cast("uchar")
    image = image.copy(interpretation="srgb")
    if orientation is not None:
        image.set_type(pyvips.GValue.gint_type, "orientation", orientation)
    for name, value in (exif or {}).items():
        image.set_type(pyvips.GValue.gstr_type, name, value)
    data: bytes = image.write_to_buffer(fmt)
    return data
