from typing import Any

from django.conf import settings
from django.db import models


class Album(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft"
        READY = "ready"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="albums"
    )
    title = models.CharField(max_length=200, blank=True)
    format = models.CharField(max_length=32)
    theme = models.CharField(max_length=32)
    accent_color = models.CharField(max_length=7)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    current_version = models.ForeignKey(
        "AlbumVersion", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    layout_seed = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["owner", "created_at"])]

    def __str__(self) -> str:
        return self.title or f"Album {self.pk}"


class AlbumVersion(models.Model):
    """Immutable snapshot of the album JSON. Every save creates a new row."""

    album = models.ForeignKey(Album, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    content = models.JSONField()
    schema_version = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["album", "number"], name="unique_album_version_number")
        ]
        ordering = ["-number"]

    def __str__(self) -> str:
        return f"{self.album_id} v{self.number}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            raise ValueError("AlbumVersion is immutable")
        super().save(*args, **kwargs)
