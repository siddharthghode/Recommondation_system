#!/bin/bash

#database
echo "==> Setting up PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE library_db;"
sudo -u postgres psql -c "CREATE USER library_user WITH PASSWORD 'StrongPass@123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE library_db TO library_user;"
sudo -u postgres psql -c "ALTER DATABASE library_db OWNER TO library_user;"

#backend
cd /backend
python3 -m venv bookenv && source bookenv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py import_books
python manage.py seed_demo