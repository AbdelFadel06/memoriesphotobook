from django.conf import settings
from django.db import models


class Photo(models.Model):
    class Orientation(models.TextChoices):
        PORTRAIT = "portrait"
        LANDSCAPE = "landscape"
        SQUARE = "square"

    class Quality(models.TextChoices):
        OK = "ok"
        LOW = "low"
        BAD = "bad"

    class Status(models.TextChoices):
        PENDING = "pending"
        READY = "ready"
        FAILED = "failed"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="photos"
    )
    # Photos are uploaded during the wizard, before the album exists, so this is set later.
    album = models.ForeignKey(
        "albums.Album", null=True, blank=True, on_delete=models.SET_NULL, related_name="photos"
    )
    # Album format chosen in the wizard, used to grade print quality.
    target_format = models.CharField(max_length=32)
    original_name = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=32)
    size_bytes = models.PositiveBigIntegerField()
    original_key = models.CharField(max_length=512)
    thumb_key = models.CharField(max_length=512, blank=True)
    preview_key = models.CharField(max_length=512, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    orientation = models.CharField(max_length=16, choices=Orientation.choices, blank=True)
    taken_at = models.DateTimeField(null=True, blank=True)
    gps = models.JSONField(null=True, blank=True)
    dominant_colors = models.JSONField(default=list, blank=True)
    quality = models.CharField(max_length=8, choices=Quality.choices, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["owner"])]

    def __str__(self) -> str:
        return f"Photo {self.pk} ({self.status})"
