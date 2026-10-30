from django.contrib.auth import password_validation
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from services import avatars

from .models import User


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value: str) -> str:
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse.")
        return value

    def validate_password(self, value: str) -> str:
        password_validation.validate_password(value)
        return value


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "name", "avatar_url", "plan", "quota_photos", "created_at")
        read_only_fields = ("id", "plan", "quota_photos", "created_at")
        extra_kwargs = {"name": {"max_length": 120}}

    def get_avatar_url(self, obj: User) -> str | None:
        return avatars.url(obj)

    def validate_name(self, value: str) -> str:
        return value.strip()

    def validate_email(self, value: str) -> str:
        value = value.lower()
        taken = User.objects.filter(email=value)
        if self.instance is not None:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse.")
        return value


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value: str) -> str:
        if not self.context["user"].check_password(value):
            raise serializers.ValidationError("Le mot de passe actuel est incorrect.")
        return value

    def validate_new_password(self, value: str) -> str:
        password_validation.validate_password(value, self.context["user"])
        return value


class LoginSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "no_active_account": "Adresse e-mail ou mot de passe incorrect.",
    }


class AvatarPresignSerializer(serializers.Serializer):
    content_type = serializers.CharField()
    size = serializers.IntegerField(min_value=1)


class AvatarConfirmSerializer(serializers.Serializer):
    key = serializers.CharField(max_length=512)
