from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from apps.layouts import catalog
from services import album_content
from services.autolayout import PhotoInfo, build

STRONG = {"full_bleed", "spread_full"}


def photos(spec: str, quality: str = "ok") -> list[PhotoInfo]:
    """'PLS' → portrait, landscape, square, one day apart."""
    kinds = {"P": "portrait", "L": "landscape", "S": "square"}
    start = datetime(2026, 7, 1, tzinfo=UTC)
    return [
        PhotoInfo(
            id=i + 1,
            orientation=kinds[c],
            quality=quality,
            pixels=12_000_000,
            taken_at=start + timedelta(days=i),
        )
        for i, c in enumerate(spec)
    ]


def layout(items: list[PhotoInfo], seed: int = 1, **kw: Any) -> dict[str, Any]:
    return build(
        items, format_id="A4_portrait", theme="galerie_claire", accent="#3b3b3b", seed=seed, **kw
    )


def placed(content: dict[str, Any]) -> list[int]:
    return [
        s["photoId"] for p in content["pages"] for s in p["slots"] if s.get("photoId") is not None
    ]


@pytest.mark.parametrize("spec", ["", "P", "LP", "PLSPLLP", "L" * 7, "P" * 30, "LPLPLPLPLPS" * 5])
@pytest.mark.parametrize("seed", range(8))
def test_always_valid_even_and_complete(spec: str, seed: int) -> None:
    items = photos(spec)
    content = layout(items, seed=seed)
    # A layout the API itself accepts.
    album_content.validate(content, [p.id for p in items])
    assert album_content.page_count(content) % 2 == 0
    # Every photo is placed exactly once.
    assert sorted(placed(content)) == [p.id for p in items]


@pytest.mark.parametrize("seed", range(30))
def test_rules_hold(seed: int) -> None:
    content = layout(photos("PLSPLLPLPSSPLLLPPS"), seed=seed)
    templates = catalog.templates()
    page_number = 1
    previous = None
    for page in content["pages"]:
        if page["layout"] == "spread_full":
            assert page_number % 2 == 0, "a spread must start on a left page"
        assert not (previous in STRONG and page["layout"] in STRONG), "two strong pages in a row"
        previous = page["layout"]
        page_number += 2 if templates[page["layout"]]["spread"] else 1
    assert content["pages"][0]["layout"] == "cover_block"


def test_zero_photos_gives_cover_and_closing_page() -> None:
    content = layout([], title="Bénin 2026")
    assert [p["layout"] for p in content["pages"]] == ["cover_block", "text_page"]
    assert {"slot": "title", "text": "Bénin 2026"} in content["pages"][0]["slots"]


def test_cover_prefers_big_good_portrait() -> None:
    items = [
        PhotoInfo(1, "landscape", "ok", 24_000_000),
        PhotoInfo(2, "portrait", "low", 30_000_000),
        PhotoInfo(3, "portrait", "ok", 12_000_000),
    ]
    cover = layout(items)["pages"][0]
    assert {"slot": "photo1", "photoId": 3} in cover["slots"]


@pytest.mark.parametrize("seed", range(30))
def test_bad_photos_never_strong(seed: int) -> None:
    content = layout(photos("PLPLPLPL", quality="bad"), seed=seed)
    assert not {p["layout"] for p in content["pages"]} & STRONG


def test_same_seed_same_layout() -> None:
    items = photos("PLSPLLPLPS")
    assert layout(items, seed=42) == layout(items, seed=42)
    variants = {str(layout(items, seed=s)["pages"]) for s in range(20)}
    assert len(variants) > 1, "seeds should give some variety"


def test_photos_follow_chronology() -> None:
    items = photos("SSSSSS")
    shuffled = [items[3], items[0], items[5], items[1], items[4], items[2]]
    order = placed(layout(shuffled, seed=3))
    assert order[1:] == sorted(order[1:])  # after the cover, by date
