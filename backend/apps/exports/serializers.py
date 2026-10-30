from rest_framework import serializers

from services import exports

from .models import ExportJob


class ExportJobSerializer(serializers.ModelSerializer):
    album = serializers.IntegerField(source="album_version.album_id", read_only=True)
    version = serializers.IntegerField(source="album_version.number", read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ExportJob
        fields = (
            "id",
            "album",
            "version",
            "status",
            "error",
            "download_url",
            "created_at",
            "finished_at",
        )
        read_only_fields = fields

    def get_download_url(self, obj: ExportJob) -> str | None:
        return exports.download_url(obj)
