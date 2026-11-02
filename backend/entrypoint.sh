#!/bin/sh
set -e

# If an explicit command was passed to container, execute it directly
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# Run migrations if enabled (defaults to true for standalone deploys; disable in multi-replica environments)
if [ "${MIGRATE_ON_BOOT:-true}" = "true" ] || [ "${MIGRATE_ON_BOOT:-true}" = "1" ]; then
    echo "Running database migrations..."
    python manage.py migrate --noinput
fi

if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "Creating/updating production admin..."
    python manage.py create_admin
fi

# Static files are pre-compiled during Docker build; only run if explicitly requested
if [ "${COLLECT_STATIC_ON_BOOT:-false}" = "true" ] || [ "${COLLECT_STATIC_ON_BOOT:-false}" = "1" ]; then
    echo "Collecting static files..."
    python manage.py collectstatic --noinput
fi

PORT=${PORT:-8000}
WORKERS=${GUNICORN_WORKERS:-${WEB_CONCURRENCY:-3}}
TIMEOUT=${GUNICORN_TIMEOUT:-120}

echo "Starting Gunicorn server on 0.0.0.0:${PORT} with ${WORKERS} workers..."
exec gunicorn book_recommondation.wsgi:application \
    --bind 0.0.0.0:${PORT} \
    --workers ${WORKERS} \
    --timeout ${TIMEOUT} \
    --access-logfile - \
    --error-logfile -
