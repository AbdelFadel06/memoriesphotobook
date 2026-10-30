"""S3-compatible object storage (RustFS locally, R2/B2 in production). Private bucket only."""

from functools import cache
from typing import Any

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from django.conf import settings


@cache
def client(public: bool = False) -> Any:
    # URLs handed to the browser must be signed against the host it can reach.
    endpoint = settings.S3_PUBLIC_ENDPOINT_URL if public else settings.S3_ENDPOINT_URL
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name=settings.S3_REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def presign_upload(key: str, content_type: str, size: int) -> str:
    """Signed PUT URL; content type and exact length are part of the signature."""
    url: str = client(public=True).generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": key,
            "ContentType": content_type,
            "ContentLength": size,
        },
        ExpiresIn=settings.SIGNED_URL_TTL_SECONDS,
    )
    return url


def presign_download(key: str, filename: str | None = None) -> str:
    params: dict[str, str] = {"Bucket": settings.S3_BUCKET, "Key": key}
    if filename:
        params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'
    url: str = client(public=True).generate_presigned_url(
        "get_object", Params=params, ExpiresIn=settings.SIGNED_URL_TTL_SECONDS
    )
    return url


def object_size(key: str) -> int | None:
    """Size in bytes, or None if the object does not exist."""
    try:
        head = client().head_object(Bucket=settings.S3_BUCKET, Key=key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
    return int(head["ContentLength"])


def read(key: str) -> bytes:
    body: bytes = client().get_object(Bucket=settings.S3_BUCKET, Key=key)["Body"].read()
    return body


def write(key: str, data: bytes, content_type: str) -> None:
    client().put_object(Bucket=settings.S3_BUCKET, Key=key, Body=data, ContentType=content_type)


def delete(keys: list[str]) -> None:
    keys = [k for k in keys if k]
    if keys:
        client().delete_objects(
            Bucket=settings.S3_BUCKET, Delete={"Objects": [{"Key": k} for k in keys]}
        )
