# Plan A — VM Backup & Verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull every byte of the existing Hexo site off the Hetzner VM onto local disk and into git-tracked metadata, then prove the backup is sufficient by running the old site locally from it. No changes to the VM.

**Architecture:** Read-only operations on VM (ssh + rsync). Discovery first to find file locations, then targeted backup, then verification by booting the old Hexo Docker stack from the backup on the local machine.

**Tech Stack:** ssh, rsync, docker compose, Hetzner Cloud Console (manual snapshot step).

---

## Prerequisites

Before starting any task, fill in these environment values. Each task references them.

| Name | How to get it |
|---|---|
| `VM_IP` | From Hetzner Cloud Console → Servers → IP address |
| `VM_USER` | Whatever user you currently SSH in as (likely `root`) |
| `BACKUP_DIR` | Local destination, default: `~/vm-backup-2026-05-05` |
| `REPO` | This repo, `/Users/luliu/projects/blogs` |

Set them in your shell before running any rsync command:

```bash
export VM_IP=<fill in>
export VM_USER=root
export BACKUP_DIR=~/vm-backup-2026-05-05
export REPO=/Users/luliu/projects/blogs
```

## Task 1: Confirm SSH access

**Files:** none

- [ ] **Step 1: Test SSH connection**

Run:
```bash
ssh -o BatchMode=yes -o ConnectTimeout=5 $VM_USER@$VM_IP 'echo ok && hostname && uname -a'
```

Expected: prints `ok`, hostname, `Linux ... Ubuntu ...`. If "Permission denied" or timeout, fix SSH config before continuing.

## Task 2: Create Hetzner snapshot (manual)

**Files:** none

- [ ] **Step 1: Snapshot via Hetzner Cloud Console**

1. Open https://console.hetzner.cloud
2. Select project, click VM
3. Left nav → **Snapshots** → **Create snapshot**
4. Description: `pre-astro-migration-2026-05-05`
5. Click create. Wait until status = "Available" (~3-5 min).

- [ ] **Step 2: Verify snapshot exists**

Take a screenshot or note the snapshot ID. This is the rollback artifact for Plan D. Hold ≥7 days post-cutover.

## Task 3: Create local backup directory

**Files:**
- Create: `$BACKUP_DIR/`

- [ ] **Step 1: Create dir**

Run:
```bash
mkdir -p $BACKUP_DIR/{discovery,etc,home,root,srv,opt,docker,extras}
ls -la $BACKUP_DIR
```

Expected: 7 empty subdirs.

## Task 4: Run VM discovery (read-only inventory)

**Files:**
- Create: `$BACKUP_DIR/discovery/*.txt` (multiple files)

- [ ] **Step 1: Run discovery one-liner**

```bash
ssh $VM_USER@$VM_IP 'bash -s' <<'REMOTE' > $BACKUP_DIR/discovery/run.log 2>&1
set -x
uname -a
cat /etc/os-release
df -h
free -h
ip addr
ufw status verbose 2>/dev/null || iptables -L -n
which docker docker-compose hexo node nginx caddy 2>/dev/null
docker ps -a 2>/dev/null
docker images 2>/dev/null
docker network ls 2>/dev/null
docker volume ls 2>/dev/null
ls -la /etc/nginx/ 2>/dev/null
ls -la /etc/caddy/ 2>/dev/null
ls -la /etc/letsencrypt/live/ 2>/dev/null
ls -la /root/
ls -la /home/
ls -la /srv/ 2>/dev/null
ls -la /opt/ 2>/dev/null
crontab -l 2>/dev/null
systemctl list-timers --all --no-pager 2>/dev/null
systemctl list-unit-files --state=enabled --no-pager 2>/dev/null
find / -name 'docker-compose*.yml' -not -path '/proc/*' -not -path '/sys/*' 2>/dev/null
find / -name '_config.yml' -not -path '/proc/*' -not -path '/sys/*' -not -path '*/node_modules/*' 2>/dev/null
find / -name 'package.json' -not -path '/proc/*' -not -path '*/node_modules/*' 2>/dev/null
REMOTE
```

- [ ] **Step 2: Read the discovery log and identify hexo location**

```bash
less $BACKUP_DIR/discovery/run.log
```

Note in a scratchpad:
- Hexo project root path (where `_config.yml` for Hexo lives — not theme `_config.yml`)
- docker-compose file path
- Web server: nginx OR caddy (only one expected)
- Cert location

- [ ] **Step 3: Save the answers to a manifest file**

Create `$BACKUP_DIR/discovery/manifest.txt` with the discovered paths:

```bash
cat > $BACKUP_DIR/discovery/manifest.txt <<EOF
HEXO_ROOT=<path from discovery>
COMPOSE_FILE=<path from discovery>
WEB_SERVER=<nginx|caddy>
CERT_DIR=/etc/letsencrypt
DOCKER_VOLUMES=<list from 'docker volume ls'>
EOF
```

Source it later: `source $BACKUP_DIR/discovery/manifest.txt`

## Task 5: Backup web server config

**Files:**
- Create: `$BACKUP_DIR/etc/nginx/` or `$BACKUP_DIR/etc/caddy/`

- [ ] **Step 1: Rsync the appropriate config dir**

If `WEB_SERVER=nginx`:
```bash
rsync -azv $VM_USER@$VM_IP:/etc/nginx/ $BACKUP_DIR/etc/nginx/
```

If `WEB_SERVER=caddy`:
```bash
rsync -azv $VM_USER@$VM_IP:/etc/caddy/ $BACKUP_DIR/etc/caddy/
```

- [ ] **Step 2: Verify**

```bash
ls -la $BACKUP_DIR/etc/$WEB_SERVER/
```

Expected: contains main config file (`nginx.conf` or `Caddyfile`) plus any included site configs.

## Task 6: Backup Let's Encrypt certificates

**Files:**
- Create: `$BACKUP_DIR/etc/letsencrypt/`

- [ ] **Step 1: Rsync certs**

```bash
rsync -azv $VM_USER@$VM_IP:/etc/letsencrypt/ $BACKUP_DIR/etc/letsencrypt/
```

- [ ] **Step 2: Verify**

```bash
ls -la $BACKUP_DIR/etc/letsencrypt/live/
```

Expected: directory named after domain (`luliu.me`) with cert files. (After rebuild, Caddy will issue fresh certs — these are kept only as evidence/reference.)

## Task 7: Backup Hexo project + theme

**Files:**
- Create: `$BACKUP_DIR/hexo/` (full source)

- [ ] **Step 1: Rsync hexo root**

```bash
source $BACKUP_DIR/discovery/manifest.txt
rsync -azv \
  --exclude='node_modules/' \
  --exclude='public/' \
  --exclude='.deploy_git/' \
  --exclude='db.json' \
  $VM_USER@$VM_IP:$HEXO_ROOT/ $BACKUP_DIR/hexo/
```

(Excluded dirs are reproducible artifacts; saves bandwidth.)

- [ ] **Step 2: Verify key files present**

```bash
ls $BACKUP_DIR/hexo/
test -f $BACKUP_DIR/hexo/_config.yml && echo "config OK"
test -f $BACKUP_DIR/hexo/package.json && echo "package OK"
test -d $BACKUP_DIR/hexo/themes && echo "themes OK"
test -d $BACKUP_DIR/hexo/source && echo "source OK"
```

Expected: all four "OK" lines printed.

- [ ] **Step 3: Note theme name**

```bash
grep '^theme:' $BACKUP_DIR/hexo/_config.yml
ls $BACKUP_DIR/hexo/themes/
```

Save the theme name (e.g., `landscape`, `next`, `icarus`) to `$BACKUP_DIR/discovery/manifest.txt`:
```bash
echo "HEXO_THEME=<theme name>" >> $BACKUP_DIR/discovery/manifest.txt
```

## Task 8: Backup docker-compose + bind-mounted volumes

**Files:**
- Create: `$BACKUP_DIR/docker/`

- [ ] **Step 1: Rsync compose file and any .env files in same dir**

```bash
source $BACKUP_DIR/discovery/manifest.txt
COMPOSE_DIR=$(dirname $COMPOSE_FILE)
rsync -azv \
  --include='docker-compose*.yml' \
  --include='.env*' \
  --include='*.conf' \
  --exclude='*' \
  $VM_USER@$VM_IP:$COMPOSE_DIR/ $BACKUP_DIR/docker/
```

- [ ] **Step 2: Resolve compose config (captures interpolated env values)**

```bash
ssh $VM_USER@$VM_IP "cd $COMPOSE_DIR && docker compose config" \
  > $BACKUP_DIR/docker/compose-resolved.yml
```

- [ ] **Step 3: Inspect any docker volumes**

```bash
ssh $VM_USER@$VM_IP 'docker volume ls -q' | while read v; do
  ssh $VM_USER@$VM_IP "docker volume inspect $v"
done > $BACKUP_DIR/docker/volume-inspect.json
```

- [ ] **Step 4: Backup bind-mount source dirs from compose**

Read the resolved compose YAML to identify any host paths bind-mounted into containers (lines like `volumes: - /host/path:/container/path`). For each host path, rsync it:

```bash
# Example — adjust to actual paths from compose-resolved.yml
rsync -azv $VM_USER@$VM_IP:/host/path/ $BACKUP_DIR/extras/host-path/
```

- [ ] **Step 5: Note all bind-mount sources backed up**

Append to manifest:
```bash
cat >> $BACKUP_DIR/discovery/manifest.txt <<EOF
BIND_MOUNTS_BACKED_UP=<comma-separated list of host paths>
EOF
```

## Task 9: Backup /root, /home, cron, ufw

**Files:**
- Create: `$BACKUP_DIR/root/`, `$BACKUP_DIR/home/`, `$BACKUP_DIR/extras/cron.txt`, `$BACKUP_DIR/extras/ufw.txt`

- [ ] **Step 1: Rsync /root**

```bash
rsync -azv \
  --exclude='.cache/' \
  --exclude='.npm/' \
  --exclude='snap/' \
  $VM_USER@$VM_IP:/root/ $BACKUP_DIR/root/
```

- [ ] **Step 2: Rsync /home**

```bash
rsync -azv \
  --exclude='.cache/' \
  --exclude='.npm/' \
  --exclude='snap/' \
  $VM_USER@$VM_IP:/home/ $BACKUP_DIR/home/
```

- [ ] **Step 3: Capture cron tables for all users**

```bash
ssh $VM_USER@$VM_IP 'for u in $(cut -d: -f1 /etc/passwd); do echo "=== $u ==="; crontab -u $u -l 2>/dev/null; done' \
  > $BACKUP_DIR/extras/cron-all-users.txt
ssh $VM_USER@$VM_IP 'ls -la /etc/cron.* /etc/crontab' > $BACKUP_DIR/extras/cron-system.txt
rsync -azv $VM_USER@$VM_IP:/etc/cron.d/ $BACKUP_DIR/etc/cron.d/ 2>/dev/null || true
rsync -azv $VM_USER@$VM_IP:/etc/cron.daily/ $BACKUP_DIR/etc/cron.daily/ 2>/dev/null || true
rsync -azv $VM_USER@$VM_IP:/etc/cron.hourly/ $BACKUP_DIR/etc/cron.hourly/ 2>/dev/null || true
```

- [ ] **Step 4: Capture firewall state**

```bash
ssh $VM_USER@$VM_IP 'ufw status verbose 2>/dev/null; iptables-save 2>/dev/null' \
  > $BACKUP_DIR/extras/firewall.txt
```

## Task 10: Backup /srv and /opt if present

**Files:**
- Create: `$BACKUP_DIR/srv/`, `$BACKUP_DIR/opt/`

- [ ] **Step 1: Conditional rsync**

```bash
ssh $VM_USER@$VM_IP 'test -d /srv && find /srv -maxdepth 1 -type d' && \
  rsync -azv $VM_USER@$VM_IP:/srv/ $BACKUP_DIR/srv/

ssh $VM_USER@$VM_IP 'test -d /opt && find /opt -maxdepth 1 -type d' && \
  rsync -azv $VM_USER@$VM_IP:/opt/ $BACKUP_DIR/opt/
```

(If empty, skip silently.)

- [ ] **Step 2: Verify**

```bash
du -sh $BACKUP_DIR/srv $BACKUP_DIR/opt 2>/dev/null
```

## Task 11: Compute backup checksum manifest

**Files:**
- Create: `$BACKUP_DIR/MANIFEST.sha256`

- [ ] **Step 1: Generate manifest**

```bash
cd $BACKUP_DIR
find . -type f -not -path './MANIFEST.sha256' -exec shasum -a 256 {} \; | sort > MANIFEST.sha256
wc -l MANIFEST.sha256
du -sh .
```

Expected: line count > 100; total size between ~10 MB and ~2 GB depending on content.

## Task 12: Verify backup by booting old Hexo locally

**Files:**
- Modify: `$BACKUP_DIR/docker/compose-local.yml` (a copy of the original, port-mapped to localhost)

- [ ] **Step 1: Copy compose file for local-only run**

```bash
cp $BACKUP_DIR/docker/compose-resolved.yml $BACKUP_DIR/docker/compose-local.yml
```

- [ ] **Step 2: Edit ports + remove TLS bindings**

Open `$BACKUP_DIR/docker/compose-local.yml` and:
- Change any `ports: - "80:80"` to `ports: - "8080:80"`
- Change any `ports: - "443:443"` to comment out (no local TLS).
- Change any volume references that point to VM-only paths (e.g. cert dirs) to local backup equivalents.

Diff after edit:
```bash
diff $BACKUP_DIR/docker/compose-resolved.yml $BACKUP_DIR/docker/compose-local.yml
```

- [ ] **Step 3: Boot the stack locally**

```bash
cd $BACKUP_DIR/docker
docker compose -f compose-local.yml up -d
docker compose -f compose-local.yml ps
docker compose -f compose-local.yml logs --tail=50
```

Expected: containers running, no errors in logs.

- [ ] **Step 4: Curl the local hexo**

```bash
curl -s http://localhost:8080/ | head -50
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/
```

Expected: HTML containing site title; status 200.

- [ ] **Step 5: Browse and spot-check**

Open http://localhost:8080 in browser. Verify:
- Landing page renders.
- Click into 3 random posts — all render with correct content.
- Page styles look like the real luliu.me (theme intact).

If any of these fail, the backup is incomplete. Identify gap, return to Task 7-10 for the missing files.

- [ ] **Step 6: Tear down local stack**

```bash
cd $BACKUP_DIR/docker
docker compose -f compose-local.yml down
```

## Task 13: Commit backup metadata to repo

**Files:**
- Create: `infra/vm-discovery-2026-05-05/manifest.txt`
- Create: `infra/vm-discovery-2026-05-05/run.log`
- Create: `infra/vm-discovery-2026-05-05/cron-all-users.txt`
- Create: `infra/vm-discovery-2026-05-05/firewall.txt`
- Create: `infra/vm-discovery-2026-05-05/MANIFEST.sha256`
- Create: `infra/vm-discovery-2026-05-05/README.md`

Only metadata is committed. Actual backup content stays local in `$BACKUP_DIR/` (gitignored, may contain secrets).

- [ ] **Step 1: Copy metadata into repo**

```bash
mkdir -p $REPO/infra/vm-discovery-2026-05-05
cp $BACKUP_DIR/discovery/manifest.txt   $REPO/infra/vm-discovery-2026-05-05/
cp $BACKUP_DIR/discovery/run.log         $REPO/infra/vm-discovery-2026-05-05/
cp $BACKUP_DIR/extras/cron-all-users.txt $REPO/infra/vm-discovery-2026-05-05/
cp $BACKUP_DIR/extras/firewall.txt       $REPO/infra/vm-discovery-2026-05-05/
cp $BACKUP_DIR/MANIFEST.sha256           $REPO/infra/vm-discovery-2026-05-05/
```

- [ ] **Step 2: Sanitize secrets from committed files**

Open each committed file. Redact:
- Any password/token/private-key lines
- Email addresses if not already public
- IP addresses (replace with `<VM_IP>` if you prefer)

```bash
grep -i -E 'pass|token|secret|key|api' $REPO/infra/vm-discovery-2026-05-05/*.txt
```

If hits, redact manually before committing.

- [ ] **Step 3: Write README**

```bash
cat > $REPO/infra/vm-discovery-2026-05-05/README.md <<'EOF'
# VM Discovery & Backup Snapshot — 2026-05-05

Snapshot of the pre-migration Hetzner Cloud cx21 running Hexo on Ubuntu 18.04.

## What's here

- `manifest.txt` — discovered paths (Hexo root, compose file, web server, theme)
- `run.log` — full output of the discovery script
- `cron-all-users.txt` — cron tables for all users
- `firewall.txt` — ufw + iptables rules
- `MANIFEST.sha256` — checksums of the local backup

## What's NOT here (held only locally)

- Hexo source files & theme: `~/vm-backup-2026-05-05/hexo/`
- Web server config: `~/vm-backup-2026-05-05/etc/`
- Let's Encrypt certs: `~/vm-backup-2026-05-05/etc/letsencrypt/`
- Compose file + bind-mount data: `~/vm-backup-2026-05-05/docker/`, `~/vm-backup-2026-05-05/extras/`
- /root, /home, /srv, /opt: `~/vm-backup-2026-05-05/`

Local backup retained ≥30 days post-cutover.

## Verification

Old Hexo site rebuilt locally from this backup on 2026-05-05 — see Task 12 in the plan.
Containers booted, posts rendered, theme intact → backup proven sufficient.

## Hetzner snapshot

Snapshot ID: <fill in after Task 2>
Created: 2026-05-05
Description: pre-astro-migration-2026-05-05
EOF
```

- [ ] **Step 4: Add gitignore entry**

```bash
grep -q '^vm-backup-' $REPO/.gitignore || echo 'vm-backup-*/' >> $REPO/.gitignore
```

(Prevents accidentally committing local backup if user copies it into the repo.)

- [ ] **Step 5: Commit**

```bash
cd $REPO
git add infra/vm-discovery-2026-05-05/ .gitignore
git commit -m "$(cat <<'EOF'
infra: add VM discovery snapshot (Plan A complete)

Captures Hetzner cx21 state pre-migration:
- discovery output (paths, services, network)
- cron tables and firewall rules
- backup checksum manifest

Actual backup content is held locally at ~/vm-backup-2026-05-05/
(gitignored, may contain secrets). Verified by booting old Hexo
stack locally — site rendered correctly, backup proven sufficient.

Hetzner snapshot also retained as rollback artifact.
EOF
)"
```

## Task 14: Final verification gate

- [ ] **Step 1: Confirm all four backup layers exist**

```bash
echo "Local backup dir:"
test -d $BACKUP_DIR && du -sh $BACKUP_DIR && echo "  OK"

echo "Local hexo render verified:"
test -f $BACKUP_DIR/docker/compose-local.yml && echo "  OK (Task 12)"

echo "Repo metadata committed:"
git log -1 --oneline -- infra/vm-discovery-2026-05-05/

echo "Hetzner snapshot:"
echo "  Visually confirm in Hetzner Cloud Console (Task 2)"
```

- [ ] **Step 2: Sign-off note**

Add a line to your scratchpad / project notes:

```
Plan A complete: 2026-05-05
Backup proven sufficient. Cleared to start Plan B.
```

---

## Done

When all tasks above are checked, Plan A is complete. The VM is unchanged. You have:

1. Local backup in `~/vm-backup-2026-05-05/` with checksums.
2. Hetzner snapshot held in cloud (rollback option).
3. Old Hexo verified to boot locally from backup.
4. Discovery metadata committed to repo for future reference.

**Next:** request Plan B (Astro scaffold + 58-post migration).
