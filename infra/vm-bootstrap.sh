#!/bin/bash
# Run as root on a fresh Ubuntu 24.04 cx22 after Hetzner build.
# Idempotent: re-running is safe.

set -euo pipefail

echo "==> Hostname"
hostnamectl set-hostname luliu-me

echo "==> apt update + upgrade"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::="--force-confnew" upgrade
DEBIAN_FRONTEND=noninteractive apt-get -y install \
  rsync ufw curl debian-keyring debian-archive-keyring apt-transport-https \
  fail2ban unattended-upgrades

echo "==> Unattended security upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
APT
# Default 50unattended-upgrades.conf already restricts to security pocket on Ubuntu.
systemctl enable --now unattended-upgrades

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

echo "==> Sudo for Caddy reload only (deploy user)"
cat > /etc/sudoers.d/deploy-caddy <<'SUDO'
deploy ALL=(ALL) NOPASSWD: /bin/systemctl reload caddy
SUDO
chmod 440 /etc/sudoers.d/deploy-caddy
visudo -c -f /etc/sudoers.d/deploy-caddy

echo "==> SSH hardening"
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'SSH'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers root deploy
X11Forwarding no
SSH
sshd -t  # validate before reload — exits non-zero on syntax error
systemctl reload ssh

echo "==> fail2ban (sshd jail)"
cat > /etc/fail2ban/jail.d/sshd.conf <<'F2B'
[sshd]
enabled = true
port    = ssh
backend = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
F2B
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "==> Firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Disable noisy/unused defaults"
# motd-news (telemetry-ish ad in MOTD)
sed -i 's/^ENABLED=1/ENABLED=0/' /etc/default/motd-news 2>/dev/null || true
# Disable snapd if not needed (Caddy is via apt, no snap deps here)
systemctl disable --now snapd.service snapd.socket snapd.seeded.service 2>/dev/null || true

echo "==> Caddy placeholder (until real Caddyfile rsynced)"
test -f /etc/caddy/Caddyfile.bootstrapped || cat > /etc/caddy/Caddyfile <<'CADDY'
luliu.me, www.luliu.me {
    respond "site bootstrap pending" 503
}
CADDY
touch /etc/caddy/Caddyfile.bootstrapped

systemctl enable --now caddy
systemctl status caddy --no-pager | head -10

echo "==> Counter service user + state directory"
if ! id counter >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/counter --shell /usr/sbin/nologin counter
fi
install -d -o counter -g counter -m 0750 /var/lib/counter
install -d -o root    -g root    -m 0755 /opt/counter

echo "==> Allow deploy to read counter snapshots"
usermod -aG counter deploy
[ -f /var/lib/counter/counter.db.bak ] && chmod 0640 /var/lib/counter/counter.db.bak || true

echo "==> Counter sudo for deploy (restart only)"
cat > /etc/sudoers.d/deploy-counter <<'SUDO'
deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart counter, /bin/systemctl daemon-reload
SUDO
chmod 440 /etc/sudoers.d/deploy-counter
visudo -c -f /etc/sudoers.d/deploy-counter

echo "==> Counter file-install sudo for deploy"
cat > /etc/sudoers.d/deploy-counter-install <<'SUDO'
deploy ALL=(ALL) NOPASSWD: /usr/bin/install -m 0755 -o root -g root /tmp/counter /opt/counter/counter, /usr/bin/install -m 0644 -o root -g root /tmp/counter.service /etc/systemd/system/counter.service, /usr/bin/install -m 0644 -o root -g root /tmp/Caddyfile /etc/caddy/Caddyfile
SUDO
chmod 440 /etc/sudoers.d/deploy-counter-install
visudo -c -f /etc/sudoers.d/deploy-counter-install

echo "==> Counter systemd unit (placeholder until first CI deploy)"
if [ ! -f /etc/systemd/system/counter.service ]; then
  cat > /etc/systemd/system/counter.service <<'UNIT'
[Unit]
Description=luliu.me engagement counter service (placeholder)
After=network.target

[Service]
Type=simple
User=counter
Group=counter
ExecStart=/opt/counter/counter
Restart=on-failure
RestartSec=2s
Environment=COUNTER_DB=/var/lib/counter/counter.db
Environment=COUNTER_ADDR=127.0.0.1:8787

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/counter

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
fi
# Don't start yet — the binary lands via the first CI deploy.
systemctl enable counter || true

echo "==> Counter backup systemd timer"
cat > /etc/systemd/system/counter-backup.service <<'UNIT'
[Unit]
Description=Snapshot counter.db (online .backup)
After=counter.service

[Service]
Type=oneshot
User=counter
Group=counter
ExecStart=/usr/bin/sqlite3 /var/lib/counter/counter.db ".backup '/var/lib/counter/counter.db.bak'"
UNIT
cat > /etc/systemd/system/counter-backup.timer <<'UNIT'
[Unit]
Description=Daily counter.db snapshot

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
UNIT
# sqlite3 CLI for .backup
DEBIAN_FRONTEND=noninteractive apt-get -y install sqlite3
systemctl daemon-reload
systemctl enable --now counter-backup.timer

echo
echo "==> Bootstrap done."
echo "    SSH: PermitRootLogin prohibit-password (key-only); password auth off."
echo "    fail2ban: sshd jail enabled (5 fails / 10min → 1h ban)."
echo "    unattended-upgrades: enabled (security pocket)."
echo "    Next: copy real Caddyfile + add deploy public key, then run first deploy."
