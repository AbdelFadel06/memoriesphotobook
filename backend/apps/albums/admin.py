from django.contrib import admin

from .models import Album, AlbumVersion


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "owner", "format", "theme", "status", "updated_at")
    list_filter = ("format", "theme", "status")
    search_fields = ("title", "owner__email")
    list_select_related = ("owner",)
    raw_id_fields = ("owner", "current_version")


@admin.register(AlbumVersion)
class AlbumVersionAdmin(admin.ModelAdmin):
    list_display = ("album", "number", "schema_version", "created_at")
    raw_id_fields = ("album",)

    def has_change_permission(self, request: object, obj: object = None) -> bool:
        return False
