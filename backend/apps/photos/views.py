from typing import cast

from django.db.models import QuerySet
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.pagination import CursorPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from services import photos

from .models import Photo
from .serializers import (
    ConfirmRequestSerializer,
    PhotoSerializer,
    PresignRequestSerializer,
    PresignResponseSerializer,
)


class PresignView(APIView):
    @extend_schema(request=PresignRequestSerializer, responses={201: PresignResponseSerializer})
    def post(self, request: Request) -> Response:
        serializer = PresignRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = photos.presign(
            cast(User, request.user),
            content_type=data["content_type"],
            size=data["size"],
            target_format=data["format"],
            filename=data.get("filename", ""),
            album_id=data.get("album"),
        )
        return Response(
            {
                "photo_id": result.photo.pk,
                "upload_url": result.upload_url,
                # The client must send exactly these headers with its PUT.
                "headers": {"Content-Type": result.photo.mime_type},
            },
            status=status.HTTP_201_CREATED,
        )


class ConfirmView(APIView):
    @extend_schema(request=ConfirmRequestSerializer, responses={202: PhotoSerializer})
    def post(self, request: Request) -> Response:
        serializer = ConfirmRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo = photos.confirm(cast(User, request.user), serializer.validated_data["photo_id"])
        return Response(PhotoSerializer(photo).data, status=status.HTTP_202_ACCEPTED)


class PhotoPagination(CursorPagination):
    ordering = "created_at"
    page_size = 100


@extend_schema(
    parameters=[OpenApiParameter("album", OpenApiTypes.INT, description="Photos of one album")]
)
class PhotoListView(generics.ListAPIView):
    serializer_class = PhotoSerializer
    pagination_class = PhotoPagination

    def get_queryset(self) -> QuerySet[Photo]:
        queryset = Photo.objects.filter(owner=cast(User, self.request.user)).exclude(
            status=Photo.Status.FAILED
        )
        album = self.request.query_params.get("album")
        if album is not None:
            queryset = queryset.filter(album_id=album if album.isdigit() else -1)
        return queryset
