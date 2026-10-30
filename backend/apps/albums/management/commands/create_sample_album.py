import uuid
from typing import Any

import pyvips
from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction

from apps.accounts.models import User
from apps.albums.models import Album, AlbumVersion
from apps.layouts import catalog
from apps.photos.models import Photo
from services import photos, storage

# (label, width, height, base colour)
SAMPLES = [
    ("Couverture", 4000, 5000, (196, 92, 56)),
    ("Ouidah", 5000, 4000, (52, 110, 150)),
    ("Marché", 3000, 4500, (180, 140, 60)),
    ("Plage", 3000, 4500, (60, 150, 140)),
    ("Ganvié", 4000, 6000, (120, 80, 140)),
    ("Pendjari", 7200, 3600, (90, 130, 70)),
]


class Command(BaseCommand):
    help = "Create a sample album (generated photos, every MVP template) to check the print output."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--email", default="demo@example.com")
        parser.add_argument("--format", default="A4_portrait", choices=list(catalog.formats()))
        parser.add_argument("--theme", default="galerie_claire", choices=list(catalog.themes()))

    def handle(self, *args: Any, **options: Any) -> None:
        user, created = User.objects.get_or_create(email=options["email"])
        if created:
            user.set_password("demo-password-123")
            user.save()

        ids = [self._photo(user, options["format"], *sample).pk for sample in SAMPLES]
        theme = catalog.themes()[options["theme"]]
        content = {
            "schemaVersion": 1,
            "format": options["format"],
            "theme": options["theme"],
            "accent": theme["defaultAccent"],
            "options": {"verticalTitle": True, "line": True, "captions": True},
            "pages": [
                {
                    "id": "p1",
                    "layout": "cover_block",
                    "slots": [
                        {"slot": "photo1", "photoId": ids[0], "focus": [0.5, 0.4]},
                        {"slot": "title", "text": "Bénin 2026"},
                        {"slot": "subtitle", "text": "Un été en famille"},
                    ],
                },
                {
                    "id": "p2",
                    "layout": "photo_caption",
                    "slots": [
                        {"slot": "photo1", "photoId": ids[1]},
                        {"slot": "title", "text": "Ouidah"},
                        {
                            "slot": "caption",
                            "text": "La route des esclaves, au coucher du soleil.\n"
                            "Un moment de silence partagé.",
                        },
                    ],
                },
                {
                    "id": "p3",
                    "layout": "two_side_by_side",
                    "slots": [
                        {"slot": "photo1", "photoId": ids[2]},
                        {"slot": "photo2", "photoId": ids[3]},
                        {"slot": "title", "text": "Cotonou"},
                        {"slot": "caption", "text": "Le marché Dantokpa, puis la plage."},
                    ],
                },
                {
                    "id": "p4",
                    "layout": "full_bleed",
                    "slots": [{"slot": "photo1", "photoId": ids[4]}],
                },
                {
                    "id": "p5",
                    "layout": "spread_full",
                    "spread": True,
                    "slots": [{"slot": "photo1", "photoId": ids[5]}],
                },
            ],
        }

        with transaction.atomic():
            album = Album.objects.create(
                owner=user,
                title="Bénin 2026",
                format=options["format"],
                theme=options["theme"],
                accent_color=content["accent"],
            )
            version = AlbumVersion.objects.create(
                album=album, number=1, content=content, schema_version=1
            )
            album.current_version = version
            album.save(update_fields=["current_version"])
            Photo.objects.filter(pk__in=ids).update(album=album)

        self.stdout.write(self.style.SUCCESS(f"Album {album.pk} created for {user.email}"))

    def _photo(
        self, user: User, fmt: str, label: str, width: int, height: int, rgb: tuple[int, int, int]
    ) -> Photo:
        data = _generate(label, width, height, rgb)
        key = f"users/{user.pk}/originals/{uuid.uuid4().hex}.jpg"
        storage.write(key, data, "image/jpeg")
        photo = Photo.objects.create(
            owner=user,
            target_format=fmt,
            original_name=f"{label}.jpg",
            mime_type="image/jpeg",
            size_bytes=len(data),
            original_key=key,
        )
        photos.process(photo.pk)
        photo.refresh_from_db()
        return photo


def _generate(label: str, width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    """Diagonal gradient with a centred label and a grid, to check crop and sharpness."""
    xyz = pyvips.Image.xyz(width, height)
    ramp = (xyz[0] / width + xyz[1] / height) / 2
    bands = [ramp * c + (ramp * -1 + 1) * c * 0.35 for c in rgb]
    image = bands[0].bandjoin(bands[1:])
    grid = ((xyz[0] % (width // 8)) < 6) | ((xyz[1] % (height // 8)) < 6)
    image = grid.ifthenelse([255, 255, 255], image).cast("uchar").copy(interpretation="srgb")
    # Autofit the label into the central third of the image.
    text = pyvips.Image.text(label, font="sans bold", width=width * 2 // 3, height=height // 6)
    label_layer = text.new_from_image([255, 255, 255]).bandjoin(text).copy(interpretation="srgb")
    image = image.composite2(
        label_layer, "over", x=(width - text.width) // 2, y=(height - text.height) // 2
    ).flatten()
    out: bytes = image.cast("uchar").jpegsave_buffer(Q=90)
    return out
