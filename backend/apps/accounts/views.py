from typing import cast

from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from services import avatars

from .models import User
from .serializers import (
    AvatarConfirmSerializer,
    AvatarPresignSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=RegisterSerializer, responses={201: UserSerializer})
    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.create_user(**serializer.validated_data)
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class MeView(APIView):
    @extend_schema(responses=UserSerializer)
    def get(self, request: Request) -> Response:
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=UserSerializer, responses=UserSerializer)
    def patch(self, request: Request) -> Response:
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PasswordChangeView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=PasswordChangeSerializer, responses={204: None})
    def post(self, request: Request) -> Response:
        user = cast(User, request.user)
        serializer = PasswordChangeSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class AvatarPresignView(APIView):
    @extend_schema(request=AvatarPresignSerializer, responses={201: None})
    def post(self, request: Request) -> Response:
        serializer = AvatarPresignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = avatars.presign(
            cast(User, request.user),
            content_type=serializer.validated_data["content_type"],
            size=serializer.validated_data["size"],
        )
        return Response(
            {
                "key": result.key,
                "upload_url": result.upload_url,
                "headers": {"Content-Type": serializer.validated_data["content_type"]},
            },
            status=status.HTTP_201_CREATED,
        )


class AvatarView(APIView):
    @extend_schema(request=AvatarConfirmSerializer, responses=UserSerializer)
    def post(self, request: Request) -> Response:
        serializer = AvatarConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = avatars.confirm(cast(User, request.user), serializer.validated_data["key"])
        return Response(UserSerializer(user).data)

    @extend_schema(responses=UserSerializer)
    def delete(self, request: Request) -> Response:
        return Response(UserSerializer(avatars.remove(cast(User, request.user))).data)
