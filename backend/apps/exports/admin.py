from django.contrib import admin

from .models import ExportJob


@admin.register(ExportJob)
class ExportJobAdmin(admin.ModelAdmin):
    list_display = ("id", "album_version", "status", "created_at", "finished_at")
    list_filter = ("status",)
    raw_id_fields = ("album_version",)
