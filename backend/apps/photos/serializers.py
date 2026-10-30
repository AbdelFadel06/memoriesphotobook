from typing import cast

from django.conf import settings
from rest_framework import serializers

from apps.layouts import catalog
from services import storage

from .models import Photo


class PresignRequestSerializer(serializers.Serializer):
    content_type = serializers.ChoiceField(choices=settings.PHOTO_ALLOWED_MIME_TYPES)
    size = serializers.IntegerField(min_value=1)
    format = serializers.ChoiceField(choices=[])
    filename = serializers.CharField(required=False, allow_blank=True, max_length=255)
    album = serializers.IntegerField(required=False, min_value=1)

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        cast(serializers.ChoiceField, self.fields["format"]).choices = catalog.format_choices()


class PresignResponseSerializer(serializers.Serializer):
    photo_id = serializers.IntegerField()
    upload_url = serializers.URLField()
    headers = serializers.DictField(child=serializers.CharField())


class ConfirmRequestSerializer(serializers.Serializer):
    photo_id = serializers.IntegerField(min_value=1)


class PhotoSerializer(serializers.ModelSerializer):
    thumb_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        # gps is deliberately never exposed.
        fields = (
            "id",
            "album",
            "status",
            "width",
            "height",
            "orientation",
            "taken_at",
            "dominant_colors",
            "quality",
            "thumb_url",
            "preview_url",
            "created_at",
        )
        read_only_fields = fields

    def get_thumb_url(self, obj: Photo) -> str | None:
        return storage.presign_download(obj.thumb_key) if obj.thumb_key else None

    def get_preview_url(self, obj: Photo) -> str | None:
        return storage.presign_download(obj.preview_key) if obj.preview_key else None
