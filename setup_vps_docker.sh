#!/usr/bin/env bash
# VPS Docker setup helper for CRM 3.0
# Run this script as root on the target machine.

set -euo pipefail

log() {
  printf '=> %s\n' "$*"
}

info() {
  printf '\n== %s ==\n' "$1"
}

ensure_user() {
  local username=$1
  if ! id "$username" >/dev/null 2>&1; then
    log "Creating user $username"
    useradd -m -s /bin/bash "$username"
  else
    log "User $username already exists"
  fi
}

info "Docker prerequisites"
log "Updating apt cache"
DEBIAN_FRONTEND=noninteractive apt-get update -y

log "Installing Docker packages"
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-plugin

ensure_user deploy
log "Adding deploy to docker group"
usermod -aG docker deploy

log "Configuring deploy sudoers"
mkdir -p /etc/sudoers.d
printf 'deploy ALL=(ALL) NOPASSWD: ALL\n' >/etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

log "Preparing deploy SSH directory"
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
cat >/home/deploy/.ssh/authorized_keys <<'EOF'
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCizZi6jg/xOspuzolTEexavJr0ONOriuo/kJHkNoNo3DakipgznpV5X+5QC6aXGduDxuvfXPq2OHmA29bMeGrHkY+zt8jiz3GKXNJolMt976k5FAgbXRZY6d8ABi4xOCGi3E4BfaU89Z2gYK/CRlGgWaSuzqfE4Hqlke2s8mhuk7xLIEhHm3insKMUUyGbOT2bZEs5iCqRKtL4ZF4uKS/9uw6JwQQCwx2MMa/VRj0IW3d3r43HQgnABHC7n/BKJ8uCwcmlIlKfPv+SrwMavIXF8CxYglVfFdd16SMSG0r80nKxmQSsL6ozm9Vq4UoNU/Epq6QfhLhWpjGLk5ZaGyFYNDFreazOVlo+XeLHNtxY4dD0YTlQ5krilpbwZ8B0yz7nbs+Q7+5xhEhRKVr4C6RC59sy7Ydm+dVtqhK8ye52F0Z2M0QIS/koUxty8BcBEP0rv+O2+Juwo6kv2dGKw5eku8xMTZbx5Sl1IvKVb61JisHGRKZ0evCa2fKua2uS1353j+1J0Gif+mpLmJ6JIpRxMCFUyU9Sh9T0iZ/2PKYCYPcvKhjWVLRDUOt87Ohr3LJEY8SkVHMDQtZIUomemUjMKC1aaCVQgynpy2ZQY2iROsy2CgW0nntWa4wXOa2dx/amQEXPQ37eH2PSTvKPcaBOzlkcacsB/6Jgqjl9thWRnw== User@DESKTOP-1UU0E7T
EOF
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

log "Enabling Docker service"
systemctl enable docker
systemctl start docker

info "Verification"
docker --version
docker compose version
id deploy

info "Setup complete"
cat <<'EOF'
Next steps:
- Test SSH:  ssh -i deploy_key deploy@<your-vps-ip>
- Test Docker: ssh -i deploy_key deploy@<your-vps-ip> 'docker ps'
- Test sudo:   ssh -i deploy_key deploy@<your-vps-ip> 'sudo whoami'
EOF
