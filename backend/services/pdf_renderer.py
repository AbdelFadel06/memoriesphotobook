"""HTML → PDF with Chromium, using the frontend's /print route: the one and only page renderer."""

import io
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

import pikepdf
from django.conf import settings
from playwright.sync_api import Route, sync_playwright

from apps.layouts import catalog


@dataclass(frozen=True)
class Sheet:
    """One page or spread to print, as the payload expected by window.__pbRender."""

    payload: dict[str, Any]
    spread: bool


def build_sheets(content: dict[str, Any], photo_urls: dict[int, str]) -> list[Sheet]:
    running_title = _cover_title(content)
    sheets = []
    page_number = 1
    for page in content["pages"]:
        spread = bool(catalog.get_template(page["layout"])["spread"])
        used = [s["photoId"] for s in page["slots"] if s.get("photoId") in photo_urls]
        sheets.append(
            Sheet(
                spread=spread,
                payload={
                    "format": content["format"],
                    "theme": content["theme"],
                    "accent": content["accent"],
                    "options": content["options"],
                    "page": page,
                    "photos": {str(pid): {"src": photo_urls[pid]} for pid in used},
                    "runningTitle": running_title,
                    "folio": str(page_number),
                },
            )
        )
        page_number += 2 if spread else 1
    return sheets


def render(sheets: list[Sheet], *, created_at: datetime) -> bytes:
    """Render every sheet to its own PDF page (size taken from CSS @page) and merge them."""
    allowed = {_origin(settings.FRONTEND_INTERNAL_URL), _origin(settings.S3_ENDPOINT_URL or "")}
    timeout_ms = settings.PDF_RENDER_TIMEOUT_SECONDS * 1000

    def only_allowed(route: Route) -> None:
        # The print page may only load the app itself and signed storage URLs.
        if _origin(route.request.url) in allowed:
            route.continue_()
        else:
            route.abort()

    parts: list[bytes] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            context = browser.new_context()
            context.route("**/*", only_allowed)
            page = context.new_page()
            page.set_default_timeout(timeout_ms)
            page.goto(f"{settings.FRONTEND_INTERNAL_URL}/print", wait_until="networkidle")
            page.wait_for_function("() => typeof window.__pbRender === 'function'")
            for sheet in sheets:
                page.evaluate("payload => window.__pbRender(payload)", sheet.payload)
                parts.append(page.pdf(print_background=True, prefer_css_page_size=True))
        finally:
            browser.close()
    return merge(parts, created_at=created_at)


def merge(parts: list[bytes], *, created_at: datetime) -> bytes:
    """Concatenate PDFs with fixed metadata so the same input gives the same file."""
    out = pikepdf.Pdf.new()
    sources = [pikepdf.Pdf.open(io.BytesIO(part)) for part in parts]
    try:
        for source in sources:
            out.pages.extend(source.pages)
        stamp = created_at.strftime("D:%Y%m%d%H%M%SZ")
        out.docinfo = out.make_indirect(
            pikepdf.Dictionary(
                Producer=pikepdf.String("Photobook"),
                CreationDate=pikepdf.String(stamp),
                ModDate=pikepdf.String(stamp),
            )
        )
        buffer = io.BytesIO()
        out.save(buffer, deterministic_id=True)
        return buffer.getvalue()
    finally:
        for source in sources:
            source.close()


def print_long_side_px(content: dict[str, Any]) -> dict[int, int]:
    """Pixels needed on the long side of each photo for PRINT_DPI on its largest sheet."""
    fmt = catalog.get_format(content["format"])
    needed: dict[int, int] = {}
    for page in content["pages"]:
        spread = bool(catalog.get_template(page["layout"])["spread"])
        px = round(max(fmt.page_size_in(spread=spread)) * settings.PRINT_DPI)
        for slot in page["slots"]:
            if pid := slot.get("photoId"):
                needed[pid] = max(needed.get(pid, 0), px)
    return needed


def _cover_title(content: dict[str, Any]) -> str:
    for page in content["pages"][:1]:
        for slot in page["slots"]:
            if slot.get("slot") == "title" and slot.get("text"):
                return str(slot["text"])
    return ""


def _origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}"
