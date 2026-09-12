import pytest
from io import StringIO
from django.core.management import call_command
from accounts.management.commands.check_redis import mask_redis_url


def test_mask_redis_url_masks_password():
    url = "redis://default:SecretPassword123@redis-node.cloud.redislabs.com:12345/1"
    masked = mask_redis_url(url)
    assert "SecretPassword123" not in masked
    assert "****" in masked
    assert "redis-node.cloud.redislabs.com:12345/1" in masked


def test_mask_redis_url_handles_local_and_empty():
    assert mask_redis_url("") == "Not Set"
    assert mask_redis_url("redis://127.0.0.1:6379/1") == "redis://127.0.0.1:6379/1"


@pytest.mark.django_db
def test_check_redis_command_execution():
    out = StringIO()
    call_command("check_redis", stdout=out)
    output = out.getvalue()
    assert "Redis Connection Verification" in output
    assert "PING succeeded" in output
    assert "Django is successfully connected to Redis" in output
