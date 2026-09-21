#!/bin/sh
set -e

echo "Running database migrations..."
python manage.py migrate --noinput

if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "Creating/updating production admin..."
    python manage.py create_admin
fi

echo "Collecting static files..."
python manage.py collectstatic --noinput

PORT=${PORT:-8000}
WORKERS=${GUNICORN_WORKERS:-${WEB_CONCURRENCY:-3}}
TIMEOUT=${GUNICORN_TIMEOUT:-120}

echo "Starting Gunicorn server on 0.0.0.0:${PORT} with ${WORKERS} workers..."
exec gunicorn book_recommondation.wsgi:application \
    --bind 0.0.0.0:${PORT} \
    --workers ${WORKERS} \
    --timeout ${TIMEOUT}
