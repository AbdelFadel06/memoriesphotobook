from django.urls import path

from .views import (
    AlbumAutolayoutView,
    AlbumDetailView,
    AlbumListCreateView,
    AlbumRestoreView,
    AlbumVersionListView,
)

urlpatterns = [
    path("albums", AlbumListCreateView.as_view(), name="album-list"),
    path("albums/<int:album_id>", AlbumDetailView.as_view(), name="album-detail"),
    path("albums/<int:album_id>/versions", AlbumVersionListView.as_view(), name="album-versions"),
    path(
        "albums/<int:album_id>/versions/<int:number>/restore",
        AlbumRestoreView.as_view(),
        name="album-restore",
    ),
    path(
        "albums/<int:album_id>/autolayout", AlbumAutolayoutView.as_view(), name="album-autolayout"
    ),
]
