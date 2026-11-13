import os
import sys
import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = "Wait for PostgreSQL database to be available and verify credentials."

    def add_arguments(self, parser):
        parser.add_argument(
            "--timeout",
            type=int,
            default=int(os.getenv("DB_WAIT_TIMEOUT", "30")),
            help="Maximum seconds to wait for database connectivity (default: 30)",
        )
        parser.add_argument(
            "--interval",
            type=float,
            default=1.5,
            help="Polling interval in seconds between connection attempts (default: 1.5)",
        )

    def handle(self, *args, **options):
        timeout = options["timeout"]
        interval = options["interval"]
        start_time = time.time()

        db_conn = connections["default"]
        db_settings = db_conn.settings_dict
        db_name = db_settings.get("NAME")
        db_user = db_settings.get("USER")
        db_host = db_settings.get("HOST") or "localhost"
        db_port = db_settings.get("PORT") or "5432"

        self.stdout.write(
            self.style.NOTICE(
                f"Waiting for PostgreSQL database '{db_name}' at {db_host}:{db_port} (user: {db_user})..."
            )
        )

        attempt = 0
        while True:
            attempt += 1
            try:
                # Attempt to open connection and run a simple test query
                db_conn.ensure_connection()
                with db_conn.cursor() as cursor:
                    cursor.execute("SELECT 1;")
                    cursor.fetchone()

                elapsed = time.time() - start_time
                self.stdout.write(
                    self.style.SUCCESS(
                        f"SUCCESS: Connected to PostgreSQL '{db_name}' at {db_host}:{db_port} in {elapsed:.2f}s."
                    )
                )
                return

            except OperationalError as exc:
                err_str = str(exc)
                elapsed = time.time() - start_time

                # Check if it is an authentication failure
                if "password authentication failed" in err_str:
                    self.stdout.write(
                        self.style.ERROR(
                            "\n" + "=" * 70 + "\n"
                            "DATABASE AUTHENTICATION ERROR DETECTED\n"
                            "=" * 70 + "\n"
                            f"PostgreSQL rejected credentials for user '{db_user}'.\n\n"
                            "CAUTION: If this database volume was previously initialized,\n"
                            "changing POSTGRES_PASSWORD in .env does NOT alter the password inside\n"
                            "an already-initialized PostgreSQL persistent volume (postgres_data).\n\n"
                            "To resolve this, choose one of the following:\n\n"
                            "Option 1: Update the password inside the existing database:\n"
                            f"  docker compose exec db psql -U {db_user} -d {db_name} -c \\\n"
                            f"    \"ALTER USER {db_user} WITH PASSWORD '<new_password>';\"\n\n"
                            "Option 2: Revert POSTGRES_PASSWORD in .env to the previous password.\n\n"
                            "Option 3: For a clean fresh local start (DESTROYS LOCAL DB DATA):\n"
                            "  docker compose down -v\n"
                            "  docker compose up -d --build\n"
                            "=" * 70 + "\n"
                        )
                    )
                    sys.exit(1)

                if elapsed >= timeout:
                    self.stdout.write(
                        self.style.ERROR(
                            f"\nFAILURE: Database connection timed out after {timeout} seconds.\n"
                            f"Host: {db_host}:{db_port}, DB: {db_name}, User: {db_user}\n"
                            f"Underlying error: {err_str}\n"
                        )
                    )
                    sys.exit(1)

                self.stdout.write(
                    f"Attempt {attempt}: PostgreSQL not ready yet ({err_str.strip()[:60]}...). Retrying in {interval}s..."
                )
                time.sleep(interval)
