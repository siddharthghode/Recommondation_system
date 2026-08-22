# Production Deployment Guide

A complete, production-grade guide for deploying the **Library Management & Book Recommendation System** using Docker, Docker Compose, PostgreSQL 16, Django (Gunicorn + WhiteNoise), and React (Nginx reverse proxy).

---

## 1. Architecture Overview

In production, the application is deployed as three containerized services running on an isolated Docker bridge network:

```
                            Internet / Clients
                                   │
                                   ▼ [Port 80 / 443]
                     ┌───────────────────────────┐
                     │   library_frontend        │
                     │   (Nginx Alpine Reverse   │
                     │    Proxy + React SPA)     │
                     └─────────────┬─────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     │ /api/ & /admin/           │
                     ▼                           │
       ┌───────────────────────────┐             │
       │   library_backend         │             │
       │   (Django 6 + Gunicorn    │             │
       │    WSGI 3 Workers)        │             │
       └─────────────┬─────────────┘             │
                     │                           │
                     ▼                           │
       ┌───────────────────────────┐             │
       │   library_db              │             │
       │   (PostgreSQL 16 Alpine)  │◄────────────┘
       └───────────────────────────┘
```

---

## 2. Server Requirements & Sizing

### Recommended Server Specifications
* **OS**: Ubuntu 22.04 LTS or 24.04 LTS (64-bit)
* **Compute**: 2 vCPUs, 2 GB RAM (e.g., AWS EC2 `t3.small`, DigitalOcean Droplet, Hetzner CX22)
* **Storage**: 20+ GB SSD
* **Open Ports**: `22` (SSH), `80` (HTTP), `443` (HTTPS)

### Enable Swap Memory (Crucial for 1–2 GB RAM instances)
Vite asset compilation and Python ML package initialization can consume RAM during builds. Adding 2 GB of swap prevents Out-Of-Memory (OOM) errors:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Server Preparation & Docker Installation

Connect to your production VPS via SSH:
```bash
ssh root@YOUR_SERVER_IP
```

### Install Docker Engine & Docker Compose
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Enable Docker on startup
sudo systemctl enable docker
sudo systemctl start docker

# Configure UFW Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

---

## 4. Clone & Environment Configuration

### 1. Clone the Repository
```bash
git clone https://github.com/siddharthghode/Recommondation_system.git
cd Recommondation_system
```

### 2. Configure Production `.env`
Copy the template files:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

### 3. Generate a Secure Secret Key
Run this Python one-liner to generate a cryptographically strong secret key:
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 4. Edit `.env` and `backend/.env`
Open `.env` in an editor (`nano .env`):
```env
# ==============================================================================
# DATABASE CONFIGURATION
# ==============================================================================
POSTGRES_DB=library_db
POSTGRES_USER=library_user
POSTGRES_PASSWORD=Use_A_Very_Strong_Random_Password_Here_123!
POSTGRES_HOST=db
POSTGRES_PORT=5432

# ==============================================================================
# DJANGO SETTINGS
# ==============================================================================
DEBUG=False
DJANGO_SECRET_KEY=paste-your-generated-50-character-secret-key-here
DJANGO_ENV=production
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,YOUR_SERVER_IP,backend,frontend
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ==============================================================================
# SERVER / PORT CONFIGURATION
# ==============================================================================
FRONTEND_PORT=80

# ==============================================================================
# GOOGLE OAUTH CONFIGURATION (Optional)
# ==============================================================================
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com

# ==============================================================================
# EMAIL SMTP CONFIGURATION (Required for OTPs)
# ==============================================================================
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-16-character-gmail-app-password
DEFAULT_FROM_EMAIL=your-email@gmail.com
```

> **Note on Gmail SMTP**: Use a 16-character **App Password** generated from [Google Account Security](https://myaccount.google.com/apppasswords), not your personal account password.

---

## 5. Build and Launch

Build and start the application in detached mode:
```bash
docker compose up --build -d
```

### Verification Commands
```bash
# Check running containers (all should be Up / healthy)
docker compose ps

# View live application logs
docker compose logs -f backend
docker compose logs -f frontend

# Test backend health endpoint
curl http://localhost/api/health/
```

---

## 6. Initial Super Admin & Data Setup

### 1. Create Initial Super Admin
```bash
docker compose exec backend python manage.py createsuperuser
```
Follow the interactive prompts to set your username, email, and secure password.

### 2. (Optional) Seed 6,000 Book Catalog
```bash
docker compose exec backend python manage.py import_books
```

### 3. Log in to Django Admin
Visit `http://YOUR_SERVER_IP/admin/` or `https://yourdomain.com/admin/`:
1. Navigate to **Accounts > Departments** and add your academic departments (e.g., *Computer Science*, *Mechanical Engineering*, *History*).
2. Navigate to **Accounts > Users** to create librarian accounts and assign them to departments.

---

## 7. Domain & SSL / HTTPS Setup (Let's Encrypt)

### Option A: Using Certbot & Host Nginx
If you wish to terminate SSL at the host level:
1. Point your Domain's **A Record** (`@` and `www`) to `YOUR_SERVER_IP`.
2. Change `FRONTEND_PORT=8080` in `.env` and recreate containers:
   ```bash
   docker compose up -d --force-recreate frontend
   ```
3. Install host Nginx & Certbot:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```
4. Configure `/etc/nginx/sites-available/yourdomain.com`:
   ```nginx
   server {
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
5. Enable site and issue SSL:
   ```bash
   sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl restart nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

### Option B: Using Cloudflare SSL
1. Set nameservers to Cloudflare.
2. In Cloudflare SSL/TLS settings, set mode to **Full (Strict)** or **Flexible**.
3. Create an **A Record** pointing to your server's public IP with Proxy status enabled (Orange Cloud).

---

## 8. Database Backups & Maintenance

### 1. Create a Database Backup
```bash
docker compose exec db pg_dump -U library_user -d library_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Restore Database from Backup
```bash
cat backup_20260822_120000.sql | docker compose exec -T db psql -U library_user -d library_db
```

### 3. Automated Daily Cron Backup
Add a cron job (`crontab -e`):
```bash
0 2 * * * cd /root/Recommondation_system && docker compose exec db pg_dump -U library_user -d library_db > /root/backups/db_$(date +\%F).sql 2>&1
```

---

## 9. Production Troubleshooting

| Issue | Likely Cause | Fix |
| :--- | :--- | :--- |
| **`CSRF verification failed` (403)** | Missing domain in CSRF whitelist | Add `https://yourdomain.com` to `CSRF_TRUSTED_ORIGINS` in `.env` and run `docker compose up -d backend`. |
| **`DisallowedHost` (400)** | Domain not in allowed hosts | Add your domain to `ALLOWED_HOSTS` in `.env`. |
| **OTP Email not sending** | Invalid SMTP credentials or port blocked | Verify `EMAIL_HOST_USER` and 16-char app password in `.env`. Check logs with `docker compose logs backend`. |
| **Google Sign-In `origin_mismatch`** | Google Cloud Console origin missing | Add `https://yourdomain.com` to Authorized JavaScript Origins in Google Cloud Console. |
| **Out of Memory during build** | RAM exhausted during `npm run build` | Add a 2GB swap file as documented in Section 2. |
