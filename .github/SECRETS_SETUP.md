# GitHub Secrets Configuration

This document provides a step-by-step guide for configuring GitHub Secrets required for the CI/CD pipeline.

## Quick Setup

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret below

## Required Secrets (for VPS Deployment)

### `VPS_HOST`
- **Purpose**: IP address or hostname of your VPS/server
- **Value**: Example: `123.45.67.89` or `deploy.example.com`
- **How to find**: Check your VPS provider's dashboard or SSH connection info

### `VPS_USER`
- **Purpose**: SSH username for deployment user on VPS
- **Value**: Example: `deploy` or `ubuntu`
- **How to find**: The SSH user you created for deployments
- **Setup on VPS**:
  ```bash
  # Create deployment user (if not exists)
  sudo useradd -m -s /bin/bash deploy
  sudo usermod -aG docker deploy  # Add to docker group
  ```

### `VPS_SSH_KEY`
- **Purpose**: Private SSH key for authentication
- **Value**: Full contents of your private key file
- **How to generate**:
  ```bash
  # On your local machine
  ssh-keygen -t rsa -b 4096 -f deploy_key -N ""

  # Contents of deploy_key (entire file, including -----BEGIN/END-----)
  cat deploy_key
  ```
- **Setup on VPS**:
  ```bash
  # On VPS as deploy user
  mkdir -p ~/.ssh
  echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
  chmod 700 ~/.ssh
  chmod 600 ~/.ssh/authorized_keys
  ```

### `VPS_PORT`
- **Purpose**: SSH port for connecting to VPS
- **Value**: Usually `22` (unless you changed it)
- **How to verify**: Try `ssh -p PORT deploy@HOST`

## Optional Secrets (for Notifications & Registry)

### `SLACK_WEBHOOK`
- **Purpose**: Slack webhook URL for deployment notifications
- **Value**: Example: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`
- **How to get**:
  1. Go to [Slack API Apps](https://api.slack.com/apps)
  2. Create or select your app
  3. Enable "Incoming Webhooks"
  4. Create a new webhook, copy the URL

### `DOCKER_REGISTRY`
- **Purpose**: Docker Hub username (if pushing images to registry)
- **Value**: Your Docker Hub username

### `DOCKER_PASSWORD`
- **Purpose**: Docker Hub password or access token
- **Value**: Your Docker Hub password or personal access token

## Verification

### Test SSH Connection
After setting up secrets, test the SSH connection from GitHub Actions:

```bash
# Locally, test if SSH works
ssh -i deploy_key deploy@YOUR_VPS_IP

# Should connect without password
```

### View Current Secrets
To verify secrets are set:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see your secrets listed
3. Click on each to verify (values are hidden)

## Security Best Practices

✅ **DO:**
- Generate separate SSH keys for deployment
- Rotate SSH keys regularly
- Use strong SSH key passphrases locally
- Keep SSH keys in GitHub Secrets, never commit them
- Limit SSH user permissions (deploy user shouldn't have sudo)

❌ **DON'T:**
- Commit SSH keys to repository
- Share private keys via email/chat
- Use your personal SSH key for deployment
- Add passwords to secrets (use SSH keys instead)
- Commit `.env` files with secrets

## Troubleshooting

### SSH Connection Fails
```
error: SSH key validation failed, SSH private key is invalid or encrypted
```
**Solution**: Ensure your private key:
- Has no passphrase (or matches the one you set)
- Is in PEM format (not OpenSSH format)
- Contains complete `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`

### Deployment Fails with "Permission denied"
- Check SSH key is in `~/.ssh/authorized_keys` on VPS
- Verify permissions: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`
- Test manually: `ssh -i key deploy@host "docker --version"`

### Health Check Fails
- Ensure VPS firewall allows HTTP access on port 80 or 443
- Check API is accessible: `curl http://VPS_IP/health/`
- Review backend logs: `docker-compose logs backend`

## Advanced: IP Whitelisting (Optional)

For security, you can restrict GitHub Actions to specific IP ranges:

1. On VPS, check GitHub's IP ranges:
   - [GitHub IP Ranges](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses)

2. Update SSH firewall rules:
   ```bash
   # On VPS (requires sudo)
   sudo ufw allow from GITHUB_IP_RANGE to any port 22
   ```

## One-Time Setup Checklist

- [ ] Generate SSH key pair locally
- [ ] Create `deploy` user on VPS
- [ ] Add public key to `~/.ssh/authorized_keys`
- [ ] Test SSH connection manually
- [ ] Add all required secrets to GitHub
- [ ] Add optional secrets (Slack, Docker) if needed
- [ ] Test CI pipeline by making a commit to `develop` branch
- [ ] Verify deployment by pushing to `master` branch
- [ ] Check deployment logs in GitHub Actions

## SSH Key Generation (Detailed)

```bash
# Generate new key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/deploy_key -N ""

# Display private key for GitHub secret
cat ~/.ssh/deploy_key

# Display public key for VPS authorized_keys
cat ~/.ssh/deploy_key.pub

# Test locally
ssh -i ~/.ssh/deploy_key deploy@YOUR_VPS_IP

# Add key to ssh-agent (optional, for local development)
ssh-add ~/.ssh/deploy_key
```

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [SSH Key Setup Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
