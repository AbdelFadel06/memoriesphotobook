from django.urls import path

from .views import (
    AvatarPresignView,
    AvatarView,
    LoginView,
    MeView,
    PasswordChangeView,
    RefreshView,
    RegisterView,
)

urlpatterns = [
    path("register", RegisterView.as_view(), name="auth-register"),
    path("login", LoginView.as_view(), name="auth-login"),
    path("refresh", RefreshView.as_view(), name="auth-refresh"),
    path("me", MeView.as_view(), name="auth-me"),
    path("me/avatar/presign", AvatarPresignView.as_view(), name="auth-avatar-presign"),
    path("me/avatar", AvatarView.as_view(), name="auth-avatar"),
    path("password", PasswordChangeView.as_view(), name="auth-password"),
]
