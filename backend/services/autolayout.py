"""Deterministic automatic layout: photos in, a complete, valid album JSON out. No AI.

Rules (CLAUDE.md): best photo on the cover; template by count and orientation; strong
pages (full bleed, spread) alternate with calm ones and never follow each other; a "bad"
photo is never full bleed nor on a spread; spreads start on a left (even) page; the page
count is even. Variety comes from a stored seed so results are reproducible.
"""

import random
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from .album_content import DEFAULT_OPTIONS, SCHEMA_VERSION

STRONG_CHANCE = 0.45
PAIR_CHANCE = 0.65


@dataclass(frozen=True)
class PhotoInfo:
    id: int
    orientation: str  # portrait | landscape | square
    quality: str  # ok | low | bad
    pixels: int
    taken_at: datetime | None = None
    name: str = ""


def sort_photos(photos: list[PhotoInfo]) -> list[PhotoInfo]:
    """Chronological, photos without a date last, then by file name."""
    return sorted(
        photos, key=lambda p: (p.taken_at is None, p.taken_at or datetime.min, p.name, p.id)
    )


def build(
    photos: list[PhotoInfo],
    *,
    format_id: str,
    theme: str,
    accent: str,
    seed: int,
    title: str = "",
    options: dict[str, bool] | None = None,
) -> dict[str, Any]:
    rng = random.Random(seed)
    ordered = sort_photos(photos)
    pages: list[dict[str, Any]] = []

    cover_photo = _cover_photo(ordered)
    pages.append(
        _page(
            "cover_block",
            photo1=cover_photo.id if cover_photo else None,
            title=title,
            subtitle="",
        )
    )
    remaining = [p for p in ordered if p is not cover_photo]

    next_page = 2  # the cover is page 1 (a right-hand page)
    previous_strong = False
    while remaining:
        first = remaining[0]
        second = remaining[1] if len(remaining) > 1 else None
        choices: list[tuple[str, int]] = []  # (template, photos consumed)

        if second and _fits_pair(first) and _fits_pair(second) and rng.random() < PAIR_CHANCE:
            choices.append(("two_side_by_side", 2))
        if not previous_strong and first.quality != "bad" and rng.random() < STRONG_CHANCE:
            if first.orientation == "landscape" and next_page % 2 == 0:
                choices.append(("spread_full", 1))
            elif first.orientation in ("portrait", "square"):
                choices.append(("full_bleed", 1))
        choices.append(("photo_caption", 1))

        template, used = choices[0]
        batch, remaining = remaining[:used], remaining[used:]
        fills: dict[str, Any] = {f"photo{i + 1}": photo.id for i, photo in enumerate(batch)}
        if template == "photo_caption" or template == "two_side_by_side":
            fills.update(title="", caption="")
        pages.append(_page(template, **fills))

        previous_strong = template in ("full_bleed", "spread_full")
        next_page += 2 if template == "spread_full" else 1

    if (next_page - 1) % 2:
        pages.append(_page("text_page", title="", paragraph=""))  # closing page

    for index, page in enumerate(pages, start=1):
        page["id"] = f"p{index}"
    return {
        "schemaVersion": SCHEMA_VERSION,
        "format": format_id,
        "theme": theme,
        "accent": accent,
        "options": dict(options or DEFAULT_OPTIONS),
        "pages": pages,
    }


def _cover_photo(photos: list[PhotoInfo]) -> PhotoInfo | None:
    """Biggest good photo, portrait preferred; falls back to the best available."""
    if not photos:
        return None
    rank = {"ok": 0, "low": 1, "bad": 2}
    return min(
        photos,
        key=lambda p: (rank.get(p.quality, 3), p.orientation != "portrait", -p.pixels, p.id),
    )


def _fits_pair(photo: PhotoInfo) -> bool:
    return photo.orientation in ("portrait", "square")


def _page(layout: str, **fills: Any) -> dict[str, Any]:
    slots: list[dict[str, Any]] = []
    for name, value in fills.items():
        if name.startswith("photo"):
            slots.append({"slot": name, "photoId": value})
        else:
            slots.append({"slot": name, "text": value})
    page: dict[str, Any] = {"id": "", "layout": layout, "slots": slots}
    if layout == "spread_full":
        page["spread"] = True
    return page
