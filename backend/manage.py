#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def auto_create_postgres_db():
    """Ensure PostgreSQL database exists before running commands like migrate."""
    if len(sys.argv) > 1 and sys.argv[1] in ('migrate', 'makemigrations', 'runserver', 'test', 'setup_db'):
        db_name = os.getenv('POSTGRES_DB', 'library_db')
        db_user = os.getenv('POSTGRES_USER', 'library_user')
        db_pass = os.getenv('POSTGRES_PASSWORD', 'StrongPass@123')
        db_host = os.getenv('POSTGRES_HOST', '127.0.0.1')
        db_port = os.getenv('POSTGRES_PORT', '5432')

        try:
            import psycopg2
            from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
            import subprocess

            # 1. First test if target database already connects
            try:
                conn = psycopg2.connect(
                    dbname=db_name,
                    user=db_user,
                    password=db_pass,
                    host=db_host,
                    port=db_port,
                    connect_timeout=3,
                )
                conn.close()
                return
            except psycopg2.OperationalError as e:
                err_str = str(e)

                # Attempt automated user/db creation via local postgres socket or sudo if available
                if 'password authentication failed' in err_str or f'database "{db_name}" does not exist' in err_str:
                    try:
                        # Try connecting as postgres user via unix socket or localhost
                        admin_conn = psycopg2.connect(
                            dbname='postgres',
                            user='postgres',
                            host='/var/run/postgresql' if os.path.exists('/var/run/postgresql') else db_host,
                            port=db_port,
                            connect_timeout=2,
                        )
                        admin_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                        with admin_conn.cursor() as cur:
                            cur.execute(f"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '{db_user}') THEN CREATE USER {db_user} WITH PASSWORD '{db_pass}'; ELSE ALTER USER {db_user} WITH PASSWORD '{db_pass}'; END IF; END $$;")
                            cur.execute(f"SELECT 'CREATE DATABASE {db_name} OWNER {db_user}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '{db_name}')\\gexec")
                            cur.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{db_name}" TO "{db_user}";')
                        admin_conn.close()
                        print(f"✅ Automatically configured PostgreSQL user '{db_user}' and database '{db_name}'.")
                        return
                    except Exception:
                        pass

                # If database does not exist, try creating it with configured credentials
                if f'database "{db_name}" does not exist' in err_str:
                    try:
                        admin_conn = psycopg2.connect(
                            dbname='postgres',
                            user=db_user,
                            password=db_pass,
                            host=db_host,
                            port=db_port,
                            connect_timeout=3,
                        )
                        admin_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                        with admin_conn.cursor() as cur:
                            cur.execute(f'CREATE DATABASE "{db_name}";')
                            cur.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{db_name}" TO "{db_user}";')
                        admin_conn.close()
                        print(f"✅ Automatically created PostgreSQL database: '{db_name}'.")
                    except Exception:
                        pass
        except ImportError:
            pass
        except Exception:
            pass


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'book_recommondation.settings')
    auto_create_postgres_db()
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()

