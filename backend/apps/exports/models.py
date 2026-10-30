from django.db import models


class ExportJob(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued"
        RUNNING = "running"
        DONE = "done"
        FAILED = "failed"

    album_version = models.ForeignKey(
        "albums.AlbumVersion", on_delete=models.CASCADE, related_name="exports"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    pdf_key = models.CharField(max_length=512, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Export {self.pk} ({self.status})"
