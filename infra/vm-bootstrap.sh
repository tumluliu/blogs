#!/bin/bash
# Run as root on a fresh Ubuntu 24.04 cx21 after Hetzner rebuild.
# Idempotent: re-running is safe.

set -euo pipefail

echo "==> apt update + upgrade"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::="--force-confnew" upgrade
DEBIAN_FRONTEND=noninteractive apt-get -y install rsync ufw curl debian-keyring debian-archive-keyring apt-transport-https

echo "==> Install Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get -y install caddy
fi

echo "==> Create deploy user"
if ! id deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash deploy
fi
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

echo "==> Web root"
mkdir -p /var/www/luliu.me
chown -R deploy:deploy /var/www/luliu.me

echo "==> Sudo for Caddy reload only"
cat > /etc/sudoers.d/deploy-caddy <<'SUDO'
deploy ALL=(ALL) NOPASSWD: /bin/systemctl reload caddy
SUDO
chmod 440 /etc/sudoers.d/deploy-caddy
visudo -c -f /etc/sudoers.d/deploy-caddy

echo "==> Firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Caddy config (placeholder until Caddyfile rsynced)"
test -f /etc/caddy/Caddyfile.bootstrapped || cat > /etc/caddy/Caddyfile <<'CADDY'
luliu.me, www.luliu.me {
    respond "site bootstrap pending" 503
}
CADDY
touch /etc/caddy/Caddyfile.bootstrapped

systemctl enable --now caddy
systemctl status caddy --no-pager | head -10

echo "==> Done. Next: copy real Caddyfile + add deploy public key, then run first deploy."
