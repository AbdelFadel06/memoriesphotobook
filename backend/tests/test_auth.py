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


def test_login_with_wrong_password_has_french_message(api: APIClient, user: User) -> None:
    res = api.post("/api/auth/login", {"email": user.email, "password": "wrong-password"})
    assert res.status_code == 401
    assert res.data["detail"] == "Adresse e-mail ou mot de passe incorrect."


def test_me_requires_auth(api: APIClient) -> None:
    res = api.get("/api/auth/me")
    assert res.status_code == 401
    assert set(res.data) == {"code", "detail", "fields"}


def test_update_profile_name_and_email(auth_api: APIClient, user: User) -> None:
    res = auth_api.patch(
        "/api/auth/me", {"name": "  Ada Lovelace ", "email": "Ada@New.com"}, format="json"
    )
    assert res.status_code == 200
    assert (res.data["name"], res.data["email"]) == ("Ada Lovelace", "ada@new.com")
    user.refresh_from_db()
    assert user.email == "ada@new.com"


def test_update_profile_rejects_taken_email(
    auth_api: APIClient, user: User, other_user: User
) -> None:
    res = auth_api.patch("/api/auth/me", {"email": other_user.email}, format="json")
    assert res.status_code == 400
    assert "email" in res.data["fields"]


def test_update_profile_ignores_read_only_fields(auth_api: APIClient, user: User) -> None:
    auth_api.patch("/api/auth/me", {"plan": "pro", "quota_photos": 99999}, format="json")
    user.refresh_from_db()
    assert (user.plan, user.quota_photos) == ("free", 3000)


def test_change_password(auth_api: APIClient, api: APIClient, user: User) -> None:
    res = auth_api.post(
        "/api/auth/password",
        {"current_password": "s3cret-pass-123", "new_password": "a-brand-new-passphrase"},
        format="json",
    )
    assert res.status_code == 204
    login = api.post("/api/auth/login", {"email": user.email, "password": "a-brand-new-passphrase"})
    assert login.status_code == 200


def test_change_password_requires_current_one(auth_api: APIClient) -> None:
    res = auth_api.post(
        "/api/auth/password",
        {"current_password": "wrong", "new_password": "a-brand-new-passphrase"},
        format="json",
    )
    assert res.status_code == 400
    assert "current_password" in res.data["fields"]
