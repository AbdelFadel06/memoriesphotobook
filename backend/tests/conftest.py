from collections.abc import Iterator

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from services import storage


class FakeStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def presign_upload(self, key: str, content_type: str, size: int) -> str:
        return f"http://storage.test/{key}?signed=put"

    def presign_download(self, key: str, filename: str | None = None) -> str:
        return f"http://storage.test/{key}?signed=get"

    def object_size(self, key: str) -> int | None:
        return len(self.objects[key]) if key in self.objects else None

    def read(self, key: str) -> bytes:
        return self.objects[key]

    def write(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data

    def delete(self, keys: list[str]) -> None:
        for key in keys:
            self.objects.pop(key, None)


@pytest.fixture(autouse=True)
def fake_storage(
    request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch
) -> Iterator[FakeStorage]:
    fake = FakeStorage()
    if request.node.get_closest_marker("pdf_integration"):
        yield fake  # real storage
        return
    for name in ("presign_upload", "presign_download", "object_size", "read", "write", "delete"):
        monkeypatch.setattr(storage, name, getattr(fake, name))
    yield fake


@pytest.fixture
def user(db: None) -> User:
    return User.objects.create_user("ada@example.com", "s3cret-pass-123")


@pytest.fixture
def other_user(db: None) -> User:
    return User.objects.create_user("bob@example.com", "s3cret-pass-123")


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture
def auth_api(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client
