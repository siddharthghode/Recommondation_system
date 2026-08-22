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
echo "Starting Gunicorn server on 0.0.0.0:${PORT}..."
exec gunicorn book_recommondation.wsgi:application \
    --bind 0.0.0.0:${PORT} \
    --workers 3 \
    --timeout 120
