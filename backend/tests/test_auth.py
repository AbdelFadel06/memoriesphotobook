import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User

pytestmark = pytest.mark.django_db


def test_register_returns_tokens(api: APIClient) -> None:
    res = api.post(
        "/api/auth/register", {"email": "New@Example.com", "password": "a-long-passphrase"}
    )
    assert res.status_code == 201
    assert res.data["user"]["email"] == "new@example.com"
    assert res.data["access"] and res.data["refresh"]


def test_register_rejects_duplicate_email(api: APIClient, user: User) -> None:
    res = api.post("/api/auth/register", {"email": user.email, "password": "a-long-passphrase"})
    assert res.status_code == 400
    assert res.data["code"] == "invalid"
    assert "email" in res.data["fields"]


def test_register_rejects_weak_password(api: APIClient) -> None:
    res = api.post("/api/auth/register", {"email": "x@example.com", "password": "12345678"})
    assert res.status_code == 400
    assert "password" in res.data["fields"]


def test_login_refresh_and_me(api: APIClient, user: User) -> None:
    res = api.post("/api/auth/login", {"email": user.email, "password": "s3cret-pass-123"})
    assert res.status_code == 200
    refreshed = api.post("/api/auth/refresh", {"refresh": res.data["refresh"]})
    assert refreshed.status_code == 200

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.data['access']}")
    me = api.get("/api/auth/me")
    assert me.status_code == 200
    assert me.data["email"] == user.email


def test_me_requires_auth(api: APIClient) -> None:
    res = api.get("/api/auth/me")
    assert res.status_code == 401
    assert set(res.data) == {"code", "detail", "fields"}
