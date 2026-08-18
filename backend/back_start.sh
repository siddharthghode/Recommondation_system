#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================="
echo "  🚀 Starting PostgreSQL & Backend Initialization"
echo "=================================================="

# 1. Activate Python virtual environment if present
if [ -d "bookenv" ]; then
    source bookenv/bin/activate
elif [ -d "../bookenv" ]; then
    source ../bookenv/bin/activate
fi

# 2. Check environment configuration
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs -d '\n' 2>/dev/null || true)
fi

DB_NAME="${POSTGRES_DB:-library_db}"
DB_USER="${POSTGRES_USER:-library_user}"
DB_PASS="${POSTGRES_PASSWORD:-StrongPass@123}"
DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"

echo "==> PostgreSQL target: $DB_USER @ $DB_HOST:$DB_PORT ($DB_NAME)"

# 3. Create user, database, and grant all permissions in PostgreSQL
if command -v psql >/dev/null 2>&1; then
    echo "==> Ensuring PostgreSQL user, database, and permissions exist..."
    sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN CREATE USER $DB_USER WITH PASSWORD '$DB_PASS'; ELSE ALTER USER $DB_USER WITH PASSWORD '$DB_PASS'; END IF; END \$\$;" 2>/dev/null || true
    sudo -u postgres psql -c "SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
fi

# 4. Run Django Migrations (Creates all tables, schemas, and model permissions)
echo "==> Applying database migrations..."
python manage.py migrate

# 5. Import book catalogue if table is empty
echo "==> Checking book catalogue..."
BOOK_COUNT=$(python -c "import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'book_recommondation.settings'); django.setup(); from books.models import Book; print(Book.objects.count())" 2>/dev/null || echo "0")

if [ "$BOOK_COUNT" -eq 0 ]; then
    echo "==> Importing books from CSV..."
    python manage.py import_books
else
    echo "✓ Found $BOOK_COUNT books already in catalogue."
fi

# 6. Seed demo users, departments, borrows, and ML interactions
echo "==> Seeding initial data (departments, admin/librarian/students, permissions)..."
python manage.py seed_demo

echo "=================================================="
echo "  ✅ PostgreSQL is fully configured and ready!"
echo "=================================================="
