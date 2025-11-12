# CRM 3.0 Deployment Checklist

## ✅ Completed Tasks

- [x] GitHub Actions CI/CD pipeline configured (.github/workflows/ci.yml)
- [x] Automated deployment workflow ready (.github/workflows/deploy.yml)
- [x] SSH key pair generated (deploy_key, deploy_key.pub)
- [x] GitHub Secrets configured (VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_PORT)
- [x] Production docker-compose.yml created
- [x] Production environment template created (.env.production.example)
- [x] VPS setup script prepared
- [x] Comprehensive deployment guide created (VPS_DEPLOYMENT_GUIDE.md)

## 📋 Manual VPS Setup Steps

### Step 1: Install Docker (MANUAL - Run on VPS as root)
```bash
# SSH as root
ssh root@173.249.7.183

# Copy and paste the entire setup script from VPS_DEPLOYMENT_GUIDE.md
# This will install Docker, Docker-Compose, and configure deploy user
```

**Expected output:**
- Docker version displayed
- Docker-Compose version displayed
- Deploy user created and in docker group

### Step 2: Verify From Local Machine
```bash
cd "C:\Dev\CRM 3.0"

# Test SSH access
ssh -i deploy_key deploy@173.249.7.183 "whoami"

# Test Docker access
ssh -i deploy_key deploy@173.249.7.183 "docker ps"

# Test passwordless sudo
ssh -i deploy_key deploy@173.249.7.183 "sudo whoami"
```

### Step 3: Create Deployment Directory
```bash
ssh -i deploy_key deploy@173.249.7.183 << 'SETUP'
mkdir -p /home/deploy/crm3-deploy
cd /home/deploy/crm3-deploy
git clone https://github.com/arhipvp/CRM-3.0.git .
SETUP
```

### Step 4: Configure Environment
```bash
ssh -i deploy_key deploy@173.249.7.183 << 'SETUP'
cd /home/deploy/crm3-deploy
cat > .env << 'ENV'
DEBUG=False
DJANGO_SECRET_KEY=<GENERATE_SECURE_KEY>
DJANGO_DB_ENGINE=django.db.backends.postgresql
DJANGO_DB_HOST=db
DJANGO_DB_PORT=5432
DJANGO_DB_NAME=crm3
DJANGO_DB_USER=crm3
DJANGO_DB_PASSWORD=<SECURE_PASSWORD>
ALLOWED_HOSTS=173.249.7.183,yourdomain.com
CORS_ALLOWED_ORIGINS=http://173.249.7.183:3000
VITE_API_URL=http://173.249.7.183:8000/api/v1
IMAGE_TAG=latest
ENV
SETUP
```

**⚠️ IMPORTANT:** Replace:
- `<GENERATE_SECURE_KEY>` with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- `<SECURE_PASSWORD>` with a strong password

### Step 5: First Manual Deployment
```bash
ssh -i deploy_key deploy@173.249.7.183 << 'SETUP'
cd /home/deploy/crm3-deploy
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --no-input
SETUP
```

### Step 6: Verify Application
```bash
# Test API
curl http://173.249.7.183:8000/api/v1/health/

# View logs
ssh -i deploy_key deploy@173.249.7.183 << 'LOGS'
cd /home/deploy/crm3-deploy
docker-compose -f docker-compose.prod.yml logs backend
LOGS
```

## 🚀 Automated Deployment (After Manual Setup)

Once manual setup is complete, future deployments are automatic:

```bash
# Make changes locally
git add .
git commit -m "Feature: description"

# Push to develop (runs tests)
git push origin develop

# Merge to master (triggers deployment)
git checkout master
git merge develop
git push origin master
```

GitHub Actions will automatically:
1. Build Docker images
2. Push to VPS via SSH
3. Pull latest code
4. Build containers
5. Run migrations
6. Restart services
7. Send Slack notification (if configured)

## 📁 Files Prepared for Deployment

```
C:\Dev\CRM 3.0\
├── docker-compose.prod.yml          # Production compose config
├── .env.production.example           # Environment template
├── setup_vps_docker.sh              # VPS setup script
├── VPS_DEPLOYMENT_GUIDE.md          # This guide
├── DEPLOYMENT_CHECKLIST.md          # This checklist
├── deploy_key                       # SSH private key
├── deploy_key.pub                   # SSH public key
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Test & build pipeline
│       └── deploy.yml               # Automatic deployment
```

## 🔐 Security Reminders

Before going live:

- [ ] Generate new DJANGO_SECRET_KEY (never commit)
- [ ] Create strong database password (never commit)
- [ ] Update ALLOWED_HOSTS to your domain
- [ ] Set DEBUG=False
- [ ] Configure SSL/TLS with reverse proxy (Nginx)
- [ ] Review and restrict firewall rules
- [ ] Set up automated database backups
- [ ] Enable audit logging

## 🆘 Troubleshooting

### Docker not found
```bash
ssh -i deploy_key deploy@173.249.7.183 "docker --version"
ssh -i deploy_key deploy@173.249.7.183 "sudo systemctl restart docker"
```

### Permission denied
```bash
# Check deploy user is in docker group
ssh -i deploy_key deploy@173.249.7.183 "id"

# Should see: groups=...,docker(...)
```

### Database won't connect
```bash
ssh -i deploy_key deploy@173.249.7.183 << 'LOGS'
cd /home/deploy/crm3-deploy
docker-compose -f docker-compose.prod.yml logs db
LOGS
```

### Application not responding
```bash
ssh -i deploy_key deploy@173.249.7.183 << 'LOGS'
cd /home/deploy/crm3-deploy
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml ps
LOGS
```

## 📞 Support

For issues:
1. Check application logs (see above)
2. Verify all environment variables in .env
3. Ensure Docker services are running
4. Check firewall and port accessibility
5. Review VPS_DEPLOYMENT_GUIDE.md for detailed commands

## Next: Manual Setup Timeline

1. **Today:** Run Docker setup script on VPS (30 mins)
2. **Today:** Create deployment directory and clone repo (5 mins)
3. **Today:** Configure .env file (10 mins)
4. **Today:** Run first deployment (20 mins)
5. **Today:** Verify application is working (10 mins)

**Total time estimate: ~75 minutes**

After this, deployments are fully automated via GitHub Actions!
