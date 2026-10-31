from typing import cast

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.pagination import CursorPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from services import albums

from .models import Album
from .serializers import (
    AlbumCreateSerializer,
    AlbumDetailSerializer,
    AlbumListSerializer,
    AlbumSaveSerializer,
    AlbumVersionSerializer,
)


class AlbumPagination(CursorPagination):
    ordering = "-updated_at"
    page_size = 24


def _user(request: Request) -> User:
    return cast(User, request.user)


class AlbumListCreateView(generics.ListAPIView):
    serializer_class = AlbumListSerializer
    pagination_class = AlbumPagination

    def get_queryset(self) -> QuerySet[Album]:
        return albums.owned(_user(self.request)).select_related("current_version")

    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        page = self.paginate_queryset(self.get_queryset()) or []
        context = {
            **self.get_serializer_context(),
            "thumb_urls": albums.cover_photo_urls(_user(request), page),
        }
        return self.get_paginated_response(
            AlbumListSerializer(page, many=True, context=context).data
        )

    @extend_schema(request=AlbumCreateSerializer, responses={201: AlbumDetailSerializer})
    def post(self, request: Request) -> Response:
        serializer = AlbumCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        album = albums.create(
            _user(request),
            title=data["title"],
            format_id=data["format"],
            theme=data["theme"],
            photo_ids=data["photo_ids"],
            accent=data.get("accent"),
            options=data.get("options"),
            keep_order=data["order"] == "manual",
        )
        return Response(AlbumDetailSerializer(album).data, status=status.HTTP_201_CREATED)


class AlbumDetailView(APIView):
    @extend_schema(responses=AlbumDetailSerializer)
    def get(self, request: Request, album_id: int) -> Response:
        return Response(AlbumDetailSerializer(albums.get(_user(request), album_id)).data)

    @extend_schema(request=AlbumSaveSerializer, responses=AlbumDetailSerializer)
    def put(self, request: Request, album_id: int) -> Response:
        serializer = AlbumSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        album = albums.save(
            _user(request),
            album_id,
            base_version=data["base_version"],
            content=data["content"],
            title=data.get("title"),
        )
        return Response(AlbumDetailSerializer(album).data)

    @extend_schema(responses={204: None})
    def delete(self, request: Request, album_id: int) -> Response:
        albums.delete(_user(request), album_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AlbumVersionListView(APIView):
    @extend_schema(responses=AlbumVersionSerializer(many=True))
    def get(self, request: Request, album_id: int) -> Response:
        album = albums.get(_user(request), album_id)
        return Response(AlbumVersionSerializer(album.versions.all(), many=True).data)


class AlbumRestoreView(APIView):
    @extend_schema(request=None, responses=AlbumDetailSerializer)
    def post(self, request: Request, album_id: int, number: int) -> Response:
        album = albums.restore(_user(request), album_id, number)
        return Response(AlbumDetailSerializer(album).data)


class AlbumAutolayoutView(APIView):
    @extend_schema(request=None, responses=AlbumDetailSerializer)
    def post(self, request: Request, album_id: int) -> Response:
        album = albums.regenerate(_user(request), album_id)
        return Response(AlbumDetailSerializer(album).data)
