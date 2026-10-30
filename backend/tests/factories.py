import factory

from apps.accounts.models import User
from apps.albums.models import Album
from apps.photos.models import Photo


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    password = factory.django.Password("s3cret-pass-123")


class AlbumFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Album

    owner = factory.SubFactory(UserFactory)
    format = "square_21"
    theme = "galerie_claire"
    accent_color = "#3b3b3b"


class PhotoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Photo

    owner = factory.SubFactory(UserFactory)
    target_format = "square_21"
    mime_type = "image/jpeg"
    size_bytes = 1000
    original_key = factory.Sequence(lambda n: f"users/1/originals/{n}.jpg")
