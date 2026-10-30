import pytest
from django.db import IntegrityError

from apps.albums.models import AlbumVersion

from .factories import AlbumFactory

pytestmark = pytest.mark.django_db


def test_album_version_is_immutable() -> None:
    version = AlbumVersion.objects.create(
        album=AlbumFactory(), number=1, content={"pages": []}, schema_version=1
    )
    version.content = {"pages": [{}]}
    with pytest.raises(ValueError):
        version.save()


def test_album_version_number_is_unique_per_album() -> None:
    album = AlbumFactory()
    AlbumVersion.objects.create(album=album, number=1, content={}, schema_version=1)
    with pytest.raises(IntegrityError):
        AlbumVersion.objects.create(album=album, number=1, content={}, schema_version=1)
