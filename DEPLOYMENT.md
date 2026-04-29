# Production Deployment Guide

Complete guide for deploying the Library Management System to production.

---

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Backend Deployment](#2-backend-deployment)
3. [Frontend Deployment](#3-frontend-deployment)
4. [Database Setup](#4-database-setup)
5. [Environment Configuration](#5-environment-configuration)
6. [Security Hardening](#6-security-hardening)
7. [Monitoring & Logging](#7-monitoring--logging)
8. [Backup Strategy](#8-backup-strategy)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Pre-Deployment Checklist

### Required Infrastructure

- [ ] Linux server (Ubuntu 22.04 LTS recommended)
- [ ] PostgreSQL 14+ database server
- [ ] Domain name with DNS configured
- [ ] SSL certificate (Let's Encrypt recommended)
- [ ] Minimum 2GB RAM, 2 CPU cores, 20GB storage

### Required Software

- [ ] Python 3.11+
- [ ] Node.js 18+
- [ ] Nginx
- [ ] PostgreSQL client libraries
- [ ] Git

---

## 2. Backend Deployment

### 2.1 Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3.11 python3.11-venv python3-pip postgresql postgresql-contrib nginx git

# Install PostgreSQL development headers (required for psycopg2)
sudo apt install -y libpq-dev python3-dev build-essential
```

### 2.2 Application Setup

```bash
# Create application user
sudo useradd -m -s /bin/bash library
sudo su - library

# Clone repository
git clone <your-repo-url> /home/library/app
cd /home/library/app/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

### 2.3 Environment Configuration

Create `/home/library/app/backend/.env`:

```env
# Django Core
DJANGO_SECRET_KEY=<generate-with-command-below>
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# JWT
JWT_SIGNING_KEY=<separate-random-string>

# Database
POSTGRES_DB=library_production
POSTGRES_USER=library_user
POSTGRES_PASSWORD=<strong-password>
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Email (optional - for notifications)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

**Generate secure keys:**

```bash
# Django secret key
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# JWT signing key
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

### 2.4 Database Migration

```bash
# Run migrations
python manage.py migrate

# Import books
python manage.py import_books

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput
```

### 2.5 Gunicorn Configuration

Create `/home/library/app/backend/gunicorn_config.py`:

```python
import multiprocessing

bind = "127.0.0.1:8000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 30
keepalive = 2
errorlog = "/home/library/logs/gunicorn-error.log"
accesslog = "/home/library/logs/gunicorn-access.log"
loglevel = "info"
```

Create log directory:

```bash
mkdir -p /home/library/logs
```

### 2.6 Systemd Service

Create `/etc/systemd/system/library-backend.service`:

```ini
[Unit]
Description=Library Management System Backend
After=network.target postgresql.service

[Service]
Type=notify
User=library
Group=library
WorkingDirectory=/home/library/app/backend
Environment="PATH=/home/library/app/backend/venv/bin"
ExecStart=/home/library/app/backend/venv/bin/gunicorn \
    --config /home/library/app/backend/gunicorn_config.py \
    book_recommondation.wsgi:application
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable library-backend
sudo systemctl start library-backend
sudo systemctl status library-backend
```

### 2.7 Nginx Configuration

Create `/etc/nginx/sites-available/library`:

```nginx
upstream library_backend {
    server 127.0.0.1:8000 fail_timeout=0;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Logging
    access_log /var/log/nginx/library-access.log;
    error_log /var/log/nginx/library-error.log;

    # Max upload size
    client_max_body_size 10M;

    # Static files
    location /static/ {
        alias /home/library/app/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /home/library/app/backend/media/;
        expires 7d;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://library_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_buffering off;
    }

    # Admin panel
    location /admin/ {
        proxy_pass http://library_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (React app)
    location / {
        root /home/library/app/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public";
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/library /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2.8 SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo systemctl reload nginx
```

Auto-renewal is configured automatically. Test with:

```bash
sudo certbot renew --dry-run
```

---

## 3. Frontend Deployment

### 3.1 Build Configuration

Update `frontend/src/services/api.js`:

```javascript
export const BASE_URL = import.meta.env.VITE_API_URL || "https://yourdomain.com/api";
```

Create `frontend/.env.production`:

```env
VITE_API_URL=https://yourdomain.com/api
```

### 3.2 Build and Deploy

```bash
cd /home/library/app/frontend

# Install dependencies
npm ci --production

# Build for production
npm run build

# Verify build
ls -lh dist/
```

The `dist/` folder is served by Nginx (configured in section 2.7).

### 3.3 Automated Deployment Script

Create `/home/library/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest code
cd /home/library/app
git pull origin main

# Backend
echo "📦 Updating backend..."
cd backend
source venv/bin/activate
pip install -r requirements.txt --upgrade
python manage.py migrate --noinput
python manage.py collectstatic --noinput
sudo systemctl restart library-backend

# Frontend
echo "🎨 Building frontend..."
cd ../frontend
npm ci --production
npm run build

echo "✅ Deployment complete!"
echo "🔍 Checking services..."
sudo systemctl status library-backend --no-pager
sudo systemctl status nginx --no-pager
```

Make executable:

```bash
chmod +x /home/library/deploy.sh
```

---

## 4. Database Setup

### 4.1 PostgreSQL Configuration

```bash
sudo -u postgres psql

-- Create database and user
CREATE DATABASE library_production;
CREATE USER library_user WITH PASSWORD 'your-strong-password';

-- Grant privileges
ALTER ROLE library_user SET client_encoding TO 'utf8';
ALTER ROLE library_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE library_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE library_production TO library_user;

-- Exit
\q
```

### 4.2 Connection Pooling (Optional but Recommended)

Install PgBouncer:

```bash
sudo apt install -y pgbouncer
```

Configure `/etc/pgbouncer/pgbouncer.ini`:

```ini
[databases]
library_production = host=127.0.0.1 port=5432 dbname=library_production

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
```

Update backend `.env`:

```env
POSTGRES_PORT=6432  # Use PgBouncer port
```

---

## 5. Environment Configuration

### 5.1 Django Settings for Production

Update `backend/book_recommondation/settings.py`:

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Security
DEBUG = os.getenv('DEBUG', 'False') == 'True'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB'),
        'USER': os.getenv('POSTGRES_USER'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD'),
        'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
        'PORT': os.getenv('POSTGRES_PORT', '5432'),
        'CONN_MAX_AGE': 600,  # Connection pooling
    }
}

# Static files
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_URL = '/static/'

# Media files
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'

# CORS
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_CREDENTIALS = True

# Security settings
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    X_FRAME_OPTIONS = 'DENY'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/home/library/logs/django.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['file', 'console'],
        'level': 'INFO',
    },
}
```

---

## 6. Security Hardening

### 6.1 Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### 6.2 Fail2Ban (Brute Force Protection)

```bash
sudo apt install -y fail2ban

# Create jail for Django admin
sudo tee /etc/fail2ban/jail.d/django.conf << EOF
[django-auth]
enabled = true
port = http,https
filter = django-auth
logpath = /home/library/logs/django.log
maxretry = 5
bantime = 3600
EOF

# Create filter
sudo tee /etc/fail2ban/filter.d/django-auth.conf << EOF
[Definition]
failregex = ^.* "POST /admin/login/ HTTP.*" 200
ignoreregex =
EOF

sudo systemctl restart fail2ban
```

### 6.3 Database Security

```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Change to:
# local   all             all                                     md5
# host    all             all             127.0.0.1/32            md5

sudo systemctl restart postgresql
```

### 6.4 Remove Messaging App (Already Done)

The messaging app has been removed from the codebase. Verify:

```bash
# Should NOT appear in INSTALLED_APPS
grep -n "messaging" backend/book_recommondation/settings.py

# Should NOT appear in URLs
grep -n "messaging" backend/book_recommondation/urls.py
```

---

## 7. Monitoring & Logging

### 7.1 Log Rotation

Create `/etc/logrotate.d/library`:

```
/home/library/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 library library
    sharedscripts
    postrotate
        systemctl reload library-backend > /dev/null 2>&1 || true
    endscript
}
```

### 7.2 System Monitoring

Install monitoring tools:

```bash
sudo apt install -y htop iotop nethogs
```

### 7.3 Application Health Check

Create `/home/library/healthcheck.sh`:

```bash
#!/bin/bash

# Check backend
if curl -f -s http://localhost:8000/api/books/ > /dev/null; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: FAILED"
    sudo systemctl restart library-backend
fi

# Check database
if sudo -u postgres psql -d library_production -c "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Database: OK"
else
    echo "❌ Database: FAILED"
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "⚠️  Disk usage: ${DISK_USAGE}%"
else
    echo "✅ Disk usage: ${DISK_USAGE}%"
fi
```

Add to crontab:

```bash
chmod +x /home/library/healthcheck.sh
crontab -e

# Add:
*/5 * * * * /home/library/healthcheck.sh >> /home/library/logs/healthcheck.log 2>&1
```

---

## 8. Backup Strategy

### 8.1 Database Backup

Create `/home/library/backup-db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/home/library/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="library_db_${DATE}.sql.gz"

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U library_user -h localhost library_production | gzip > "${BACKUP_DIR}/${FILENAME}"

# Keep only last 7 days
find $BACKUP_DIR -name "library_db_*.sql.gz" -mtime +7 -delete

echo "✅ Database backup completed: ${FILENAME}"
```

Add to crontab:

```bash
chmod +x /home/library/backup-db.sh
crontab -e

# Daily backup at 2 AM
0 2 * * * /home/library/backup-db.sh >> /home/library/logs/backup.log 2>&1
```

### 8.2 Restore Database

```bash
# Restore from backup
gunzip -c /home/library/backups/library_db_YYYYMMDD_HHMMSS.sql.gz | \
    psql -U library_user -h localhost library_production
```

---

## 9. Troubleshooting

### 9.1 Backend Not Starting

```bash
# Check logs
sudo journalctl -u library-backend -n 50 --no-pager

# Check Gunicorn logs
tail -f /home/library/logs/gunicorn-error.log

# Test manually
cd /home/library/app/backend
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

### 9.2 Database Connection Issues

```bash
# Test connection
psql -U library_user -h localhost -d library_production

# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### 9.3 Static Files Not Loading

```bash
# Recollect static files
cd /home/library/app/backend
source venv/bin/activate
python manage.py collectstatic --noinput

# Check permissions
sudo chown -R library:library /home/library/app/backend/staticfiles
```

### 9.4 CORS Errors

Verify in `backend/.env`:

```env
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Restart backend:

```bash
sudo systemctl restart library-backend
```

### 9.5 SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

### 9.6 High Memory Usage

```bash
# Check processes
htop

# Reduce Gunicorn workers in gunicorn_config.py
workers = 2  # Instead of multiprocessing.cpu_count() * 2 + 1

# Restart
sudo systemctl restart library-backend
```

---

## Quick Reference Commands

```bash
# Restart services
sudo systemctl restart library-backend
sudo systemctl restart nginx
sudo systemctl restart postgresql

# View logs
sudo journalctl -u library-backend -f
tail -f /home/library/logs/django.log
tail -f /var/log/nginx/library-error.log

# Deploy updates
/home/library/deploy.sh

# Database backup
/home/library/backup-db.sh

# Health check
/home/library/healthcheck.sh
```

---

## Post-Deployment Verification

- [ ] Visit `https://yourdomain.com` — frontend loads
- [ ] Login with demo credentials works
- [ ] Browse books page loads all 6000+ books
- [ ] Recommendations page works
- [ ] Librarian dashboard shows real data
- [ ] Admin panel accessible at `https://yourdomain.com/admin`
- [ ] SSL certificate valid (check browser padlock)
- [ ] No console errors in browser DevTools
- [ ] API responses are fast (<500ms)
- [ ] Database backups running daily
- [ ] Logs rotating properly

---

**Deployment completed successfully! 🎉**

For issues, check logs first:
- Backend: `/home/library/logs/django.log`
- Gunicorn: `/home/library/logs/gunicorn-error.log`
- Nginx: `/var/log/nginx/library-error.log`
