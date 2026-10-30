from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from . import catalog


class CatalogView(APIView):
    """Formats, themes and templates, straight from shared/layouts."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={200: dict[str, Any]})
    def get(self, request: Request) -> Response:
        response = Response(
            {
                "formats": catalog.formats_file(),
                "themes": list(catalog.themes().values()),
                "templates": list(catalog.templates().values()),
            }
        )
        response["Cache-Control"] = "public, max-age=300"
        return response
