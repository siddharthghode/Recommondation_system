#!/bin/sh
set -e

echo "=================================================="
echo " Starting University Library Backend Service"
echo "=================================================="

# 1. Wait for database and verify credentials
echo "Checking database connectivity..."
python manage.py wait_for_db

# 2. Run database migrations idempotently
echo "Applying database migrations..."
python manage.py migrate --noinput

# 3. Create or update admin superuser if configured
if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "Creating/updating configured admin user..."
    python manage.py create_admin
fi

# 4. Collect static files for Whitenoise
echo "Collecting static assets..."
python manage.py collectstatic --noinput

PORT=${PORT:-8000}
WORKERS=${GUNICORN_WORKERS:-${WEB_CONCURRENCY:-3}}
TIMEOUT=${GUNICORN_TIMEOUT:-120}

echo "Starting Gunicorn WSGI server on 0.0.0.0:${PORT} (${WORKERS} workers)..."
exec gunicorn book_recommondation.wsgi:application \
    --bind 0.0.0.0:${PORT} \
    --workers ${WORKERS} \
    --timeout ${TIMEOUT}
