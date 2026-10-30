from django.contrib import admin

from .models import Photo


@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "album", "status", "quality", "orientation", "created_at")
    list_filter = ("status", "quality", "orientation")
    search_fields = ("owner__email", "original_name")
    list_select_related = ("owner", "album")
    raw_id_fields = ("owner", "album")
    exclude = ("gps",)
