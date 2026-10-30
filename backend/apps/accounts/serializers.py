from django.contrib.auth import password_validation
from rest_framework import serializers

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
    class Meta:
        model = User
        fields = ("id", "email", "plan", "quota_photos", "created_at")
        read_only_fields = fields
