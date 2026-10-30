import time
from typing import Any

from botocore.exceptions import ClientError, EndpointConnectionError
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from services.storage import client as storage_client


class Command(BaseCommand):
    help = "Create the private storage bucket and its CORS rules if missing (local dev)."

    def handle(self, *args: Any, **options: Any) -> None:
        client = storage_client()
        bucket = settings.S3_BUCKET
        for _ in range(30):
            try:
                client.head_bucket(Bucket=bucket)
                self.stdout.write(f"Bucket {bucket} exists")
                break
            except EndpointConnectionError:
                time.sleep(1)
            except ClientError:
                client.create_bucket(Bucket=bucket)
                self.stdout.write(self.style.SUCCESS(f"Bucket {bucket} created"))
                break
        else:
            raise CommandError("Storage is not reachable")

        client.put_bucket_cors(
            Bucket=bucket,
            CORSConfiguration={
                "CORSRules": [
                    {
                        "AllowedOrigins": settings.CORS_ALLOWED_ORIGINS,
                        "AllowedMethods": ["GET", "PUT"],
                        "AllowedHeaders": ["*"],
                        "MaxAgeSeconds": 3600,
                    }
                ]
            },
        )
