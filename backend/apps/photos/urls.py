from django.urls import path

from .views import ConfirmView, PhotoListView, PresignView

urlpatterns = [
    path("photos", PhotoListView.as_view(), name="photo-list"),
    path("photos/presign", PresignView.as_view(), name="photo-presign"),
    path("photos/confirm", ConfirmView.as_view(), name="photo-confirm"),
]
