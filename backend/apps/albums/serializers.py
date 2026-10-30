from typing import Any

from rest_framework import serializers

from apps.layouts import catalog
from services import album_content

from .models import Album, AlbumVersion


class AlbumCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    format = serializers.ChoiceField(choices=[])
    theme = serializers.ChoiceField(choices=[])
    accent = serializers.RegexField(r"^#[0-9a-fA-F]{6}$", required=False)
    options = serializers.DictField(child=serializers.BooleanField(), required=False)
    photo_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=1000)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["format"].choices = catalog.format_choices()  # type: ignore[attr-defined]
        self.fields["theme"].choices = [(t, t) for t in catalog.themes()]  # type: ignore[attr-defined]

    def validate_options(self, value: dict[str, bool]) -> dict[str, bool]:
        if set(value) != set(album_content.OPTION_KEYS):
            raise serializers.ValidationError("Options invalides.")
        return value


class AlbumSaveSerializer(serializers.Serializer):
    base_version = serializers.IntegerField(min_value=0)
    content = serializers.JSONField()
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)


class AlbumDetailSerializer(serializers.ModelSerializer):
    version = serializers.IntegerField(source="current_version.number", read_only=True)
    content = serializers.JSONField(source="current_version.content", read_only=True)
    page_count = serializers.SerializerMethodField()

    class Meta:
        model = Album
        fields = (
            "id",
            "title",
            "format",
            "theme",
            "accent_color",
            "version",
            "page_count",
            "content",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_page_count(self, obj: Album) -> int:
        return album_content.page_count(obj.current_version.content) if obj.current_version else 0


class AlbumListSerializer(serializers.ModelSerializer):
    """History entry with what the dashboard needs to draw the cover with page-render."""

    version = serializers.IntegerField(source="current_version.number", read_only=True)
    page_count = serializers.SerializerMethodField()
    cover = serializers.SerializerMethodField()

    class Meta:
        model = Album
        fields = (
            "id",
            "title",
            "format",
            "theme",
            "accent_color",
            "version",
            "page_count",
            "cover",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_page_count(self, obj: Album) -> int:
        return album_content.page_count(obj.current_version.content) if obj.current_version else 0

    def get_cover(self, obj: Album) -> dict[str, Any] | None:
        if not obj.current_version or not obj.current_version.content["pages"]:
            return None
        content = obj.current_version.content
        page = content["pages"][0]
        urls: dict[int, str] = self.context.get("thumb_urls", {})
        ids = {s["photoId"] for s in page["slots"] if s.get("photoId") in urls}
        return {
            "page": page,
            "options": content["options"],
            "photos": {str(pid): {"src": urls[pid]} for pid in ids},
        }


class AlbumVersionSerializer(serializers.ModelSerializer):
    page_count = serializers.SerializerMethodField()

    class Meta:
        model = AlbumVersion
        fields = ("number", "page_count", "created_at")
        read_only_fields = fields

    def get_page_count(self, obj: AlbumVersion) -> int:
        return album_content.page_count(obj.content)
