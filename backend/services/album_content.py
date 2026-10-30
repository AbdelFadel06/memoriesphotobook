"""The album JSON (single source of truth): validation, migration and helpers."""

import re
from collections.abc import Iterable
from typing import Any

from rest_framework.exceptions import ValidationError

from apps.layouts import catalog

SCHEMA_VERSION = 1
MAX_PAGES = 400
MAX_TEXT = 2000
OPTION_KEYS = ("verticalTitle", "line", "captions")
DEFAULT_OPTIONS = {key: True for key in OPTION_KEYS}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def migrate(content: dict[str, Any]) -> dict[str, Any]:
    """Bring an older album JSON up to SCHEMA_VERSION (no older version exists yet)."""
    return content


def page_count(content: dict[str, Any]) -> int:
    templates = catalog.templates()
    return sum(
        2 if templates.get(page["layout"], {}).get("spread") else 1 for page in content["pages"]
    )


def photo_ids(content: dict[str, Any]) -> set[int]:
    return {
        slot["photoId"]
        for page in content["pages"]
        for slot in page["slots"]
        if isinstance(slot.get("photoId"), int)
    }


def validate(content: Any, allowed_photo_ids: Iterable[int]) -> dict[str, Any]:
    """Strict check of an album JSON. Rejects rather than guesses; returns a clean copy."""
    errors: list[str] = []
    allowed = set(allowed_photo_ids)

    def fail(message: str) -> None:
        errors.append(message)

    if not isinstance(content, dict):
        raise ValidationError({"content": ["Le contenu de l'album est invalide."]})
    if content.get("schemaVersion") != SCHEMA_VERSION:
        fail("Version de schéma non prise en charge.")
    if content.get("format") not in catalog.formats():
        fail("Format inconnu.")
    if content.get("theme") not in catalog.themes():
        fail("Thème inconnu.")
    if not isinstance(content.get("accent"), str) or not HEX.match(content["accent"]):
        fail("Couleur d'accent invalide.")
    options = content.get("options")
    if not isinstance(options, dict) or set(options) != set(OPTION_KEYS):
        fail("Options invalides.")
    elif not all(isinstance(v, bool) for v in options.values()):
        fail("Options invalides.")

    pages = content.get("pages")
    clean_pages: list[dict[str, Any]] = []
    if not isinstance(pages, list) or len(pages) > MAX_PAGES:
        fail("Liste de pages invalide.")
        pages = []
    templates = catalog.templates()
    seen_ids: set[str] = set()
    for index, page in enumerate(pages, start=1):
        where = f"Page {index} :"
        if not isinstance(page, dict) or not isinstance(page.get("id"), str) or not page["id"]:
            fail(f"{where} identifiant manquant.")
            continue
        if page["id"] in seen_ids:
            fail(f"{where} identifiant en double.")
        seen_ids.add(page["id"])
        template = templates.get(page.get("layout"))  # type: ignore[arg-type]
        if template is None:
            fail(f"{where} disposition inconnue.")
            continue
        clean_page: dict[str, Any] = {"id": page["id"], "layout": page["layout"]}
        if template["spread"]:
            clean_page["spread"] = True
        clean_slots = []
        slots = page.get("slots")
        if not isinstance(slots, list):
            fail(f"{where} emplacements invalides.")
            slots = []
        used: set[str] = set()
        for fill in slots:
            name = fill.get("slot") if isinstance(fill, dict) else None
            definition = template["slots"].get(name)
            if definition is None or name in used:
                fail(f"{where} emplacement « {name} » invalide.")
                continue
            used.add(str(name))
            if definition["type"] == "photo":
                clean_slots.append(_photo_fill(fill, allowed, where, fail))
            else:
                text = fill.get("text")
                if not isinstance(text, str) or len(text) > MAX_TEXT:
                    fail(f"{where} texte invalide.")
                    continue
                clean_slots.append({"slot": name, "text": text})
        clean_page["slots"] = clean_slots
        clean_pages.append(clean_page)

    if errors:
        raise ValidationError({"content": errors[:20]})
    return {
        "schemaVersion": SCHEMA_VERSION,
        "format": content["format"],
        "theme": content["theme"],
        "accent": content["accent"].lower(),
        "options": dict(options),  # type: ignore[arg-type]
        "pages": clean_pages,
    }


def _photo_fill(fill: dict[str, Any], allowed: set[int], where: str, fail: Any) -> dict[str, Any]:
    photo_id = fill.get("photoId")
    clean: dict[str, Any] = {"slot": fill["slot"], "photoId": None}
    if photo_id is not None:
        if isinstance(photo_id, bool) or not isinstance(photo_id, int) or photo_id not in allowed:
            fail(f"{where} photo introuvable.")
        else:
            clean["photoId"] = photo_id
    focus = fill.get("focus")
    if focus is not None:
        if (
            isinstance(focus, list)
            and len(focus) == 2
            and all(isinstance(v, int | float) and not isinstance(v, bool) for v in focus)
            and all(0 <= v <= 1 for v in focus)
        ):
            clean["focus"] = [float(focus[0]), float(focus[1])]
        else:
            fail(f"{where} point de cadrage invalide.")
    return clean
