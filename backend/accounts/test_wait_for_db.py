import pytest
from io import StringIO
from unittest.mock import MagicMock, patch
from django.core.management import call_command
from django.db.utils import OperationalError


@pytest.mark.django_db
def test_wait_for_db_success():
    """Verify wait_for_db reports success when connection succeeds."""
    out = StringIO()
    call_command("wait_for_db", timeout=5, interval=0.1, stdout=out)
    output = out.getvalue()
    assert "SUCCESS: Connected to PostgreSQL" in output or "SUCCESS" in output


@pytest.mark.django_db
def test_wait_for_db_auth_failure_handling():
    """Verify wait_for_db exits cleanly with informative message on password auth error."""
    out = StringIO()
    mock_conn = MagicMock()
    mock_conn.ensure_connection.side_effect = OperationalError("FATAL: password authentication failed for user \"postgres\"")
    mock_conn.settings_dict = {
        "NAME": "library_recommondation",
        "USER": "postgres",
        "HOST": "db",
        "PORT": "5432",
    }

    with patch.dict("accounts.management.commands.wait_for_db.connections", {"default": mock_conn}):
        with pytest.raises(SystemExit) as exc_info:
            call_command("wait_for_db", timeout=2, interval=0.1, stdout=out)
        assert exc_info.value.code == 1

    output = out.getvalue()
    assert "DATABASE AUTHENTICATION ERROR DETECTED" in output
    assert "ALTER USER" in output


@pytest.mark.django_db
def test_wait_for_db_timeout_handling():
    """Verify wait_for_db exits on connection timeout."""
    out = StringIO()
    mock_conn = MagicMock()
    mock_conn.ensure_connection.side_effect = OperationalError("could not connect to server: Connection refused")
    mock_conn.settings_dict = {
        "NAME": "library_recommondation",
        "USER": "postgres",
        "HOST": "db",
        "PORT": "5432",
    }

    with patch.dict("accounts.management.commands.wait_for_db.connections", {"default": mock_conn}):
        with pytest.raises(SystemExit) as exc_info:
            call_command("wait_for_db", timeout=0.3, interval=0.1, stdout=out)
        assert exc_info.value.code == 1

    output = out.getvalue()
    assert "FAILURE: Database connection timed out" in output
