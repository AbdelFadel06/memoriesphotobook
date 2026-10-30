"""Read-only access to shared/layouts, the single source for formats, themes and templates."""

import json
from dataclasses import dataclass
from functools import cache
from typing import Any

from django.conf import settings

MM_PER_INCH = 25.4


@dataclass(frozen=True)
class PrintFormat:
    id: str
    width_mm: float
    height_mm: float
    bleed_mm: float

    def page_size_in(self, *, spread: bool = False) -> tuple[float, float]:
        """Printed size in inches, bleed included, of a single page or a spread."""
        width = self.width_mm * (2 if spread else 1) + 2 * self.bleed_mm
        height = self.height_mm + 2 * self.bleed_mm
        return width / MM_PER_INCH, height / MM_PER_INCH


@cache
def _load(name: str) -> dict[str, Any]:
    with open(settings.SHARED_LAYOUTS_DIR / name, encoding="utf-8") as fh:
        data: dict[str, Any] = json.load(fh)
    return data


def formats_file() -> dict[str, Any]:
    return _load("formats.json")


def formats() -> dict[str, PrintFormat]:
    data = _load("formats.json")
    return {
        key: PrintFormat(key, spec["widthMm"], spec["heightMm"], data["bleedMm"])
        for key, spec in data["formats"].items()
    }


def get_format(format_id: str) -> PrintFormat:
    return formats()[format_id]


def templates() -> dict[str, dict[str, Any]]:
    return {tid: _load(f"templates/{tid}.json") for tid in _load("index.json")["templates"]}


def themes() -> dict[str, dict[str, Any]]:
    return {tid: _load(f"themes/{tid}.json") for tid in _load("index.json")["themes"]}


def get_template(template_id: str) -> dict[str, Any]:
    return templates()[template_id]


def format_choices() -> list[tuple[str, str]]:
    return [(key, key) for key in formats()]
