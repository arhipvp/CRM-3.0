#!/bin/bash
# VPS Docker Setup Script for CRM 3.0
# Run this script as root on the VPS

set -e

echo "============================================"
echo "🐳 Setting up Docker and Docker Compose"
echo "============================================"

# Update package manager
echo ""
echo "📦 Updating package manager..."
apt-get update

# Install Docker
echo ""
echo "🐳 Installing Docker..."
apt-get install -y docker.io

# Install Docker-Compose
echo ""
echo "🔧 Installing Docker Compose Plugin..."
apt-get install -y docker-compose-plugin

# Create deploy user if it doesn't exist
echo ""
echo "👤 Setting up deploy user..."
useradd -m -s /bin/bash deploy 2>/dev/null || echo "   ℹ️  Deploy user already exists"

# Add deploy user to docker group
echo "🔐 Adding deploy to docker group..."
usermod -aG docker deploy

# Configure passwordless sudo for deploy user
echo "🔓 Configuring passwordless sudo..."
mkdir -p /etc/sudoers.d
echo "deploy ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

# Create SSH directory for deploy user
echo "🔑 Setting up SSH directory..."
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh

# Copy the public key (paste your public key content below)
cat > /home/deploy/.ssh/authorized_keys << 'EOF'
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCizZi6jg/xOspuzolTEexavJr0ONOriuo/kJHkNoNo3DakipgznpV5X+5QC6aXGduDxuvfXPq2OHmA29bMeGrHkY+zt8jiz3GKXNJolMt976k5FAgbXRZY6d8ABi4xOCGi3E4BfaU89Z2gYK/CRlGgWaSuzqfE4Hqlke2s8mhuk7xLIEhHm3insKMUUyGbOT2bZEs5iCqRKtL4ZF4uKS/9uw6JwQQCwx2MMa/VRj0IW3d3r43HQgnABHC7n/BKJ8uCwcmlIlKfPv+SrwMavIXF8CxYglVfFdd16SMSG0r80nKxmQSsL6ozm9Vq4UoNU/Epq6QfhLhWpjGLk5ZaGyFYNDFreazOVlo+XeLHNtxY4dD0YTlQ5krilpbwZ8B0yz7nbs+Q7+5xhEhRKVr4C6RC59sy7Ydm+dVtqhK8ye52F0Z2M0QIS/koUxty8BcBEP0rv+O2+Juwo6kv2dGKw5eku8xMTZbx5Sl1IvKVb61JisHGRKZ0evCa2fKua2uS1353j+1J0Gif+mpLmJ6JIpRxMCFUyU9Sh9T0iZ/2PKYCYPcvKhjWVLRDUOt87Ohr3LJEY8SkVHMDQtZIUomemUjMKC1aaCVQgynpy2ZQY2iROsy2CgW0nntWa4wXOa2dx/amQEXPQ37eH2PSTvKPcaBOzlkcacsB/6Jgqjl9thWRnw== User@DESKTOP-1UU0E7T
EOF

chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# Enable Docker service
echo "🚀 Enabling Docker service..."
systemctl enable docker
systemctl start docker

# Verify installation
echo ""
echo "============================================"
echo "✅ Verification"
echo "============================================"
docker --version
docker compose version
echo ""
echo "👤 Deploy user info:"
id deploy
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Test SSH connection: ssh -i deploy_key deploy@173.249.7.183"
echo "2. Test Docker access:   ssh -i deploy_key deploy@173.249.7.183 'docker ps'"
echo "3. Verify sudo:         ssh -i deploy_key deploy@173.249.7.183 'sudo whoami'"
