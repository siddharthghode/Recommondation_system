import os
import time
from urllib.parse import urlparse
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django_redis import get_redis_connection


def mask_redis_url(url: str) -> str:
    """Mask credentials in Redis URL for safe display."""
    if not url:
        return "Not Set"
    try:
        parsed = urlparse(url)
        netloc = ""
        if parsed.username:
            netloc += parsed.username
        if parsed.password:
            netloc += ":****"
        if netloc:
            netloc += "@"
        netloc += parsed.hostname or ""
        if parsed.port:
            netloc += f":{parsed.port}"
        return f"{parsed.scheme}://{netloc}{parsed.path}"
    except Exception:
        return "<url masked>"


class Command(BaseCommand):
    help = "Verify connection to Redis / Redis Cloud and check Django cache operations."

    def handle(self, *args, **options):
        raw_url = os.getenv("REDIS_URL")
        masked_url = mask_redis_url(raw_url) if raw_url else "Not configured (using default fallback)"

        self.stdout.write(self.style.NOTICE("=================================================="))
        self.stdout.write(self.style.NOTICE(" Redis Cloud Connection Verification"))
        self.stdout.write(self.style.NOTICE("=================================================="))
        self.stdout.write(f"Configured REDIS_URL: {masked_url}")

        if not raw_url or raw_url.strip() in ("", "your_redis_cloud_url"):
            self.stdout.write(
                self.style.WARNING(
                    "\n[WARNING] REDIS_URL is not set in environment or is set to placeholder."
                    "\nTo connect to Redis Cloud, add REDIS_URL to your .env file:"
                    "\n  REDIS_URL=redis://default:<password>@<host>:<port>"
                )
            )

        # 1. Test low-level Redis connection (PING)
        self.stdout.write("\n1. Testing raw Redis connection (PING)...")
        try:
            client = get_redis_connection("default")
            start = time.time()
            pong = client.ping()
            latency = (time.time() - start) * 1000
            if pong:
                self.stdout.write(
                    self.style.SUCCESS(f"   [OK] PING succeeded! Response: PONG (Latency: {latency:.2f}ms)")
                )
            else:
                self.stdout.write(self.style.ERROR("   [FAIL] Ping returned non-truthy response."))
                return
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"   [FAIL] Could not connect to Redis: {e}"))
            return

        # 2. Test Django Cache backend operations (SET, GET, DELETE)
        self.stdout.write("\n2. Testing Django Cache backend (SET/GET/DELETE)...")
        try:
            test_key = "django_redis_verify_check"
            test_val = f"redis_ok_{int(time.time())}"
            cache.set(test_key, test_val, timeout=30)
            retrieved = cache.get(test_key)
            cache.delete(test_key)

            if retrieved == test_val:
                self.stdout.write(
                    self.style.SUCCESS(
                        "   [OK] Django cache operations succeeded! (Set, Retrieved, and Deleted test key)"
                    )
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        "\n===> SUCCESS: Django is successfully connected to Redis! <===\n"
                    )
                )
            else:
                self.stdout.write(
                    self.style.ERROR(
                        f"   [FAIL] Cache value mismatch. Expected {test_val}, got {retrieved}"
                    )
                )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"   [FAIL] Django cache operation failed: {e}"))
