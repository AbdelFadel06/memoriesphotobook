from django.urls import path

from .views import ExportCreateView, ExportDetailView

urlpatterns = [
    path("albums/<int:album_id>/export", ExportCreateView.as_view(), name="album-export"),
    path("exports/<int:pk>", ExportDetailView.as_view(), name="export-detail"),
]
