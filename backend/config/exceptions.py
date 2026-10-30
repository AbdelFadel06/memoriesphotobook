from typing import Any

from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ApiError(exceptions.APIException):
    """Business error carrying a stable machine-readable code."""

    status_code = 400

    def __init__(self, code: str, detail: str, status_code: int | None = None) -> None:
        super().__init__(detail=detail, code=code)
        if status_code is not None:
            self.status_code = status_code


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Normalise every error to {"code", "detail", "fields"}."""
    response = exception_handler(exc, context)
    if response is None or not isinstance(exc, exceptions.APIException):
        return response

    fields: dict[str, Any] = {}
    if isinstance(exc, exceptions.ValidationError) and isinstance(exc.detail, dict):
        fields = exc.detail
        code, detail = "invalid", "Certaines informations sont invalides."
    else:
        codes = exc.get_codes()
        code = codes if isinstance(codes, str) else "error"
        detail = str(exc.detail)

    response.data = {"code": code, "detail": detail, "fields": fields}
    return response
