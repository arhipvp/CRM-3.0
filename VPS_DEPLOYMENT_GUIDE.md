# VPS Deployment Guide for CRM 3.0

Complete guide for deploying CRM 3.0 on your VPS at 173.249.7.183

## Prerequisites

- VPS: Ubuntu 24.04.3 LTS (173.249.7.183)
- Root SSH access with password: `E9478f786082`
- Deploy SSH key: `deploy_key` (in project root)
- Public key already registered with GitHub

## Step 1: Install Docker and Docker-Compose (MANUAL)

**Connect to your VPS as root:**
```bash
ssh root@173.249.7.183
# Password: E9478f786082
```

**Run the setup script:**
```bash
bash << 'SETUP'
#!/bin/bash
set -e

echo "============================================"
echo "🐳 Setting up Docker and Docker-Compose"
echo "============================================"

# Update package manager
apt-get update -qq

# Install Docker
apt-get install -y docker.io

# Install Docker-Compose
apt-get install -y docker-compose

# Create deploy user if needed
useradd -m -s /bin/bash deploy 2>/dev/null || echo "Deploy user already exists"

# Add to docker group
usermod -aG docker deploy

# Configure passwordless sudo
mkdir -p /etc/sudoers.d
echo "deploy ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

# Setup SSH
mkdir -p /home/deploy/.ssh
cat > /home/deploy/.ssh/authorized_keys << 'EOF'
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCizZi6jg/xOspuzolTEexavJr0ONOriuo/kJHkNoNo3DakipgznpV5X+5QC6aXGduDxuvfXPq2OHmA29bMeGrHkY+zt8jiz3GKXNJolMt976k5FAgbXRZY6d8ABi4xOCGi3E4BfaU89Z2gYK/CRlGgWaSuzqfE4Hqlke2s8mhuk7xLIEhHm3insKMUUyGbOT2bZEs5iCqRKtL4ZF4uKS/9uw6JwQQCwx2MMa/VRj0IW3d3r43HQgnABHC7n/BKJ8uCwcmlIlKfPv+SrwMavIXF8CxYglVfFdd16SMSG0r80nKxmQSsL6ozm9Vq4UoNU/Epq6QfhLhWpjGLk5ZaGyFYNDFreazOVlo+XeLHNtxY4dD0YTlQ5krilpbwZ8B0yz7nbs+Q7+5xhEhRKVr4C6RC59sy7Ydm+dVtqhK8ye52F0Z2M0QIS/koUxty8BcBEP0rv+O2+Juwo6kv2dGKw5eku8xMTZbx5Sl1IvKVb61JisHGRKZ0evCa2fKua2uS1353j+1J0Gif+mpLmJ6JIpRxMCFUyU9Sh9T0iZ/2PKYCYPcvKhjWVLRDUOt87Ohr3LJEY8SkVHMDQtZIUomemUjMKC1aaCVQgynpy2ZQY2iROsy2CgW0nntWa4wXOa2dx/amQEXPQ37eH2PSTvKPcaBOzlkcacsB/6Jgqjl9thWRnw== User@DESKTOP-1UU0E7T
EOF

chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Verify
echo ""
echo "============================================"
echo "✅ Verification"
echo "============================================"
docker --version
docker-compose --version
id deploy

echo ""
echo "✅ Setup complete!"
SETUP

# Exit from root
exit
```

**Verify setup from your local machine:**
```bash
cd "C:\Dev\CRM 3.0"
ssh -i deploy_key deploy@173.249.7.183 "docker ps"
ssh -i deploy_key deploy@173.249.7.183 "docker-compose --version"
ssh -i deploy_key deploy@173.249.7.183 "sudo whoami"
```

All commands should succeed without prompting for a password.

## Step 2: Create VPS Deployment Directory

**Create directory structure:**
```bash
ssh -i deploy_key deploy@173.249.7.183 << 'SETUP'
mkdir -p /home/deploy/crm3-deploy
cd /home/deploy/crm3-deploy
mkdir -p .env
SETUP
```

## Step 3: Clone Repository on VPS

**Clone the code:**
```bash
ssh -i deploy_key deploy@173.249.7.183 << 'SETUP'
cd /home/deploy/crm3-deploy
git clone https://github.com/arhipvp/CRM-3.0.git .
SETUP
```

## Step 4: Configure Environment Files

**Create .env file on VPS:**

```bash
ssh -i deploy_key deploy@173.249.7.183 << 'SETUP'
cd /home/deploy/crm3-deploy
cat > .env << 'ENV'
# Backend Django Settings
DEBUG=False
DJANGO_SECRET_KEY=your-secure-random-key-here-change-this
DJANGO_DB_ENGINE=django.db.backends.postgresql
DJANGO_DB_HOST=db
DJANGO_DB_PORT=5432
DJANGO_DB_NAME=crm3
DJANGO_DB_USER=crm3
DJANGO_DB_PASSWORD=secure-password-change-this
ALLOWED_HOSTS=173.249.7.183,yourdomain.com
CORS_ALLOWED_ORIGINS=http://173.249.7.183:3000,https://yourdomain.com

# Frontend Settings
VITE_API_URL=http://173.249.7.183:8000/api/v1

# Docker Build Tag
IMAGE_TAG=latest
ENV
SETUP
```

**⚠️ IMPORTANT:** Change the values for:
- `DJANGO_SECRET_KEY` - Generate a secure random key
- `DJANGO_DB_PASSWORD` - Use a strong password
- `ALLOWED_HOSTS` - Add your actual domain when ready
- `CORS_ALLOWED_ORIGINS` - Update for production

## Step 5: Manual Build and Deployment Process

**SSH into the VPS:**
```bash
ssh -i deploy_key deploy@173.249.7.183
cd /home/deploy/crm3-deploy
```

**Build Docker images:**
```bash
docker-compose -f docker-compose.prod.yml build --no-cache
```

**Start the application:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Verify services are running:**
```bash
docker-compose -f docker-compose.prod.yml ps
```

**Check logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f backend
```

**Run migrations:**
```bash
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --no-input
```

**Create superuser (optional):**
```bash
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py createsuperuser
```

## Step 6: Automated Deployment with GitHub Actions

The CI/CD pipeline is already configured and will automatically:

1. **On push to develop branch:** Run tests, linting, and build checks
2. **On push to master branch:** Build and push Docker images to your VPS

**To trigger deployment:**
```bash
# Push to master to trigger automatic deployment
git checkout master
git merge develop
git push origin master
```

GitHub Actions will automatically:
- Build Docker images
- Push to VPS via SSH
- Run migrations
- Restart services
- Send Slack notifications

## Step 7: Access Your Application

- **Frontend:** `http://173.249.7.183:3000`
- **API:** `http://173.249.7.183:8000/api/v1`
- **Django Admin:** `http://173.249.7.183:8000/admin`

## Common Commands

**SSH into deployment directory:**
```bash
ssh -i deploy_key deploy@173.249.7.183
cd /home/deploy/crm3-deploy
```

**View logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f db
```

**Stop services:**
```bash
docker-compose -f docker-compose.prod.yml down
```

**Rebuild and restart:**
```bash
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

**Connect to database:**
```bash
docker-compose -f docker-compose.prod.yml exec db psql -U crm3 -d crm3
```

**Backup database:**
```bash
docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U crm3 crm3 > backup.sql
```

## Troubleshooting

**Docker not found:**
- Verify Docker installation: `docker --version`
- Check if service is running: `sudo systemctl status docker`
- Restart Docker: `sudo systemctl restart docker`

**Permission denied errors:**
- Verify deploy user is in docker group: `id deploy`
- Verify user has SSH key access without password: `ssh -i deploy_key deploy@173.249.7.183`
- Verify passwordless sudo: `ssh -i deploy_key deploy@173.249.7.183 'sudo whoami'`

**Database connection errors:**
- Check if PostgreSQL is running: `docker ps`
- Check database logs: `docker-compose logs db`
- Verify environment variables in .env file

**Frontend not accessible:**
- Check if frontend service is running: `docker ps`
- Verify port 3000 is open and accessible
- Check CORS_ALLOWED_ORIGINS setting in .env

## Security Considerations

- [ ] Change all default passwords in .env
- [ ] Generate secure DJANGO_SECRET_KEY
- [ ] Update ALLOWED_HOSTS for your domain
- [ ] Set DEBUG=False in production
- [ ] Configure SSL/TLS with a reverse proxy (Nginx)
- [ ] Set up firewall rules (only allow necessary ports)
- [ ] Enable automated backups of PostgreSQL
- [ ] Review and restrict SSH access
- [ ] Set up monitoring and alerting

## Next Steps

1. Run the manual Docker setup on the VPS
2. Test SSH access with deploy user
3. Create deployment directory and clone repository
4. Configure .env with production values
5. Build and start services
6. Test application access
7. Configure domain/SSL
8. Set up automated backups

For questions or issues, refer to the project documentation or GitHub issues.
