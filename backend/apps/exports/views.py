from typing import cast

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import User
from services import exports

from .models import ExportJob
from .serializers import ExportJobSerializer


class ExportCreateView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "export"

    @extend_schema(request=None, responses={202: ExportJobSerializer})
    def post(self, request: Request, album_id: int) -> Response:
        job = exports.request_export(cast(User, request.user), album_id)
        return Response(ExportJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class ExportDetailView(generics.RetrieveAPIView):
    serializer_class = ExportJobSerializer

    def get_queryset(self) -> QuerySet[ExportJob]:
        return ExportJob.objects.select_related("album_version").filter(
            album_version__album__owner=cast(User, self.request.user)
        )
