# Plan D — VM Rebuild + Cutover

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Hetzner cx21 VM from Ubuntu 18.04 → Ubuntu 24.04, install Caddy, set up a `deploy` user with restricted sudo, configure GitHub Actions to build the Astro site and rsync to `/var/www/luliu.me/`, point `luliu.me` and `www.luliu.me` at the new build with auto-issued TLS, decommission the old Hexo stack. End state: fresh VM serving the new Astro site over HTTPS.

**Architecture:** Static dist served by Caddy. GitHub Actions builds on push and rsyncs `dist/` over SSH. VM only runs Caddy + ufw. Same IP. TLS auto-issued by Caddy on first request. No Docker, no Node, no Hexo on VM.

**Tech Stack:** Ubuntu 24.04, Caddy 2.x, ufw, GitHub Actions, rsync over SSH (ed25519 deploy key).

---

## Prerequisites

- Plan A complete (backup proven, Hetzner snapshot held).
- Plan B + C complete (`astro-migration` branch builds 241 pages locally).
- You are the Hetzner Cloud Console owner for the project.
- You have admin / shell access to make GitHub repo Actions secrets changes.
- DNS for `luliu.me` and `www.luliu.me` currently points at the cx21's existing IPv4 + IPv6. After rebuild, the IP **does not change** — no DNS work needed.
- Local repo has the full backup at `~/vm-backup-2026-05-05/` (Plan A) as rollback.

---

## Phase 1 — Pre-flight, SSH keys, infra files

### Task 1: Confirm pre-flight state

- [ ] **Step 1: Verify backup still held**

```bash
ls -lh ~/vm-backup-2026-05-05/docker/image-tumluliu-hexo-6.3.0.tar.gz
test -d ~/vm-backup-2026-05-05/hexo/source && echo "backup OK"
```

Expected: image tar ≥184 MB, hexo source dir present.

- [ ] **Step 2: Verify Hetzner snapshot still exists**

Open https://console.hetzner.cloud → server → Snapshots tab. Confirm `pre-astro-migration-2026-05-05` listed and "Available". If missing, **stop and re-create** before continuing.

- [ ] **Step 3: Confirm local build still green**

```bash
cd /Users/luliu/projects/blogs
git checkout astro-migration
pnpm build 2>&1 | tail -5
```

Expected: "Complete!", 241 pages built.

- [ ] **Step 4: Confirm DNS state**

```bash
dig +short luliu.me A
dig +short luliu.me AAAA
dig +short www.luliu.me CNAME
```

Note these values. After rebuild, the same IPs should still resolve. Save to `/tmp/dns-pre-cutover.txt`:

```bash
{
  echo "Pre-cutover DNS state — $(date)"
  echo "luliu.me A:    $(dig +short luliu.me A)"
  echo "luliu.me AAAA: $(dig +short luliu.me AAAA)"
  echo "www.luliu.me:  $(dig +short www.luliu.me CNAME ; dig +short www.luliu.me A)"
} > /tmp/dns-pre-cutover.txt
cat /tmp/dns-pre-cutover.txt
```

### Task 2: Generate dedicated GH Actions deploy SSH key

**Files:**
- Create: `~/.ssh/luliu-deploy-ed25519` and `.pub` (kept locally, NOT in repo)
- Create: `infra/deploy-key.pub` (committed; public half only)

- [ ] **Step 1: Generate ed25519 keypair (no passphrase, dedicated)**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/luliu-deploy-ed25519 -C "github-actions-deploy@luliu.me" -N ""
ls -la ~/.ssh/luliu-deploy-ed25519*
```

Expected: two files — private (`luliu-deploy-ed25519`, 0600) and public (`luliu-deploy-ed25519.pub`).

- [ ] **Step 2: Copy public half into repo**

```bash
mkdir -p infra
cp ~/.ssh/luliu-deploy-ed25519.pub infra/deploy-key.pub
cat infra/deploy-key.pub
```

Expected: one line `ssh-ed25519 AAAA... github-actions-deploy@luliu.me`.

- [ ] **Step 3: Commit public key**

```bash
git add infra/deploy-key.pub
git commit -m "infra: add GH Actions deploy SSH public key"
```

### Task 3: Author GH Actions workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write workflow**

```yaml
# .github/workflows/deploy.yml
name: deploy
on:
  push:
    branches: [master]
    paths-ignore:
      - 'docs/**'
      - 'README.md'
      - '.obsidian/**'
      - 'infra/**'
      - 'scripts/cnblogs/**'
      - 'scripts/cnblogs-cache/**'

concurrency:
  group: deploy-prod
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - name: Smoke check dist
        run: |
          test -f dist/index.html
          test -f dist/posts/index.html
          test -f dist/rss.xml
          [ "$(find dist -name '*.html' | wc -l)" -gt 100 ]

      - name: Setup SSH
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.VM_HOST }}" >> ~/.ssh/known_hosts

      - name: Rsync to VM
        run: |
          rsync -az --delete \
            --exclude='.well-known' \
            ./dist/ \
            "deploy@${{ secrets.VM_HOST }}:/var/www/luliu.me/"

      - name: Reload Caddy
        run: |
          ssh "deploy@${{ secrets.VM_HOST }}" 'sudo systemctl reload caddy'
```

- [ ] **Step 2: Commit (do not push yet — would trigger before VM is ready)**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GH Actions deploy workflow (build + rsync to VM)"
```

### Task 4: Author Caddy config + bootstrap script

**Files:**
- Create: `infra/Caddyfile`
- Create: `infra/vm-bootstrap.sh`

- [ ] **Step 1: Caddyfile**

```bash
cat > infra/Caddyfile <<'EOF'
luliu.me, www.luliu.me {
    root * /var/www/luliu.me
    file_server

    encode gzip zstd

    # Redirect bare /blog and any /blog/* path to root (old Hexo URL prefix)
    redir /blog /  permanent
    redir /blog/* / permanent

    @notfound {
        not file
        not path /
    }
    handle @notfound {
        rewrite * /404.html
        file_server
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Cache-Control "public, max-age=3600"
    }
    header /_astro/* Cache-Control "public, max-age=31536000, immutable"
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
}

# www.luliu.me canonical redirect
www.luliu.me {
    redir https://luliu.me{uri} permanent
}
EOF
cat infra/Caddyfile
```

- [ ] **Step 2: vm-bootstrap.sh**

```bash
cat > infra/vm-bootstrap.sh <<'EOF'
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
test -f /etc/caddy/Caddyfile || cat > /etc/caddy/Caddyfile <<'CADDY'
luliu.me, www.luliu.me {
    respond "site bootstrap pending" 503
}
CADDY

systemctl enable --now caddy
systemctl status caddy --no-pager | head -10

echo "==> Done. Next: copy real Caddyfile + add deploy public key, then run first deploy."
EOF
chmod +x infra/vm-bootstrap.sh
```

- [ ] **Step 3: Commit**

```bash
git add infra/Caddyfile infra/vm-bootstrap.sh
git commit -m "infra: add Caddyfile and vm-bootstrap.sh for fresh Ubuntu 24.04"
```

---

## Phase 2 — VM rebuild (MANUAL via Hetzner Cloud Console)

### Task 5: Rebuild VM in Hetzner Cloud Console

**This is the only irreversible step. Proceed only after re-confirming snapshot held.**

- [ ] **Step 1: Final snapshot sanity check**

Open https://console.hetzner.cloud → server → Snapshots. Confirm `pre-astro-migration-2026-05-05` is "Available". Note its ID.

- [ ] **Step 2: Note the assigned SSH keys for the server**

In the server detail view → "SSH keys" — confirm your personal SSH key is listed. (The rebuild reuses it.) If missing, add it before rebuilding.

- [ ] **Step 3: Initiate rebuild**

Server detail → "Rebuild" tab → choose **Ubuntu 24.04**. Confirm. Type the server name when prompted. Click "Rebuild". Takes ~3-5 min.

- [ ] **Step 4: Wait for IP to come back**

```bash
until ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new luliu.me 'cat /etc/os-release | head -2' 2>/dev/null; do
  echo "$(date +%H:%M:%S) waiting for SSH on luliu.me..."
  sleep 15
done
```

Expected: prints `NAME="Ubuntu"` and `VERSION="24.04..."`. Stop the loop manually if it hangs > 10 min.

The first SSH connection will warn that the host key is new — accept it.

- [ ] **Step 5: Confirm new OS**

```bash
ssh luliu.me 'uname -a; cat /etc/os-release | grep PRETTY'
```

Expected: `Linux ... 6.x.x` and `PRETTY_NAME="Ubuntu 24.04 ..."`.

### Task 6: Run bootstrap script

- [ ] **Step 1: Copy bootstrap script to VM**

```bash
scp infra/vm-bootstrap.sh root@luliu.me:/root/vm-bootstrap.sh
```

(After rebuild, Hetzner image's default user may be `root` rather than `lu` — confirm with `ssh root@luliu.me` first.)

- [ ] **Step 2: Run it**

```bash
ssh root@luliu.me 'bash /root/vm-bootstrap.sh' 2>&1 | tee /tmp/vm-bootstrap.log
```

Expected: ends with "Done. Next: copy real Caddyfile + add deploy public key, then run first deploy." Caddy running, deploy user created, ufw enabled.

- [ ] **Step 3: Smoke test that Caddy responds**

```bash
curl -sI http://luliu.me/ | head -3
```

Expected: `HTTP/1.1 503 Service Unavailable` (or `HTTP/1.1 200` with placeholder body) — proves Caddy is reachable on 80. **At this point the live luliu.me has stopped serving the old Hexo site** and is serving Caddy's placeholder.

If you need the old Hexo back: Hetzner Console → "Restore from snapshot" (~5 min).

### Task 7: Add deploy public key to VM

- [ ] **Step 1: Push the public key**

```bash
ssh root@luliu.me 'cat >> /home/deploy/.ssh/authorized_keys' < infra/deploy-key.pub
ssh root@luliu.me 'chmod 600 /home/deploy/.ssh/authorized_keys; chown deploy:deploy /home/deploy/.ssh/authorized_keys'
```

- [ ] **Step 2: Verify deploy user can SSH in (using the dedicated key)**

```bash
ssh -i ~/.ssh/luliu-deploy-ed25519 -o IdentitiesOnly=yes deploy@luliu.me 'whoami; sudo -n /bin/systemctl status caddy --no-pager | head -3'
```

Expected: `deploy` plus `Active: active (running)` from caddy. Sudo works without password.

### Task 8: Push real Caddyfile to VM

- [ ] **Step 1: Copy Caddyfile**

```bash
scp infra/Caddyfile root@luliu.me:/etc/caddy/Caddyfile
```

- [ ] **Step 2: Validate config**

```bash
ssh root@luliu.me 'caddy validate --config /etc/caddy/Caddyfile'
```

Expected: "Valid configuration".

- [ ] **Step 3: Reload Caddy**

```bash
ssh root@luliu.me 'systemctl reload caddy && systemctl status caddy --no-pager | head -5'
```

Expected: `Active: active (running)`.

- [ ] **Step 4: First TLS handshake test**

```bash
sleep 5  # let Caddy provision the cert
curl -sI https://luliu.me/ | head -5
```

Expected: HTTP 404 or 200 (depending on whether anything served yet). HTTPS handshake succeeds (Caddy auto-provisioned via ACME). If you see a TLS error, wait another 30s and retry — first issuance can take a moment.

---

## Phase 3 — GitHub Actions secrets + first deploy

### Task 9: Add GitHub Actions secrets

**This is a manual step in the GitHub UI.**

- [ ] **Step 1: Open repo → Settings → Secrets and variables → Actions → New repository secret**

Add two secrets:

| Name | Value |
|---|---|
| `DEPLOY_SSH_KEY` | Contents of `~/.ssh/luliu-deploy-ed25519` (the **private** key, full multi-line block including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) |
| `VM_HOST` | `luliu.me` |

To copy the private key to clipboard:

```bash
pbcopy < ~/.ssh/luliu-deploy-ed25519
```

Then paste into the GitHub UI for `DEPLOY_SSH_KEY`.

- [ ] **Step 2: Verify secrets list**

In repo settings, confirm both `DEPLOY_SSH_KEY` and `VM_HOST` are listed.

### Task 10: Push astro-migration branch and trigger first deploy

- [ ] **Step 1: Push branch first to verify CI is happy without deploying**

```bash
git push -u origin astro-migration
```

Watch the workflow run if any (the workflow only triggers on master). It shouldn't run yet.

- [ ] **Step 2: Merge to master and push**

```bash
git checkout master
git merge --ff-only astro-migration
git push origin master
```

Expected: GH Actions workflow triggers. View the run at `https://github.com/tumluliu/blogs/actions`.

- [ ] **Step 3: Watch the workflow**

```bash
gh run watch 2>&1 | tail -20
# (requires `gh` CLI; otherwise watch in the browser)
```

Expected: build succeeds (~60s), rsync succeeds (~5s), Caddy reload succeeds.

If build fails: `gh run view --log-failed` to inspect.

### Task 11: Verify the live site

- [ ] **Step 1: Curl checks (12 cutover checks per spec §13)**

```bash
echo "=== 1. luliu.me reachable ==="
curl -sI https://luliu.me/ | head -3

echo "=== 2. TLS valid ==="
echo | openssl s_client -connect luliu.me:443 -servername luliu.me 2>/dev/null | openssl x509 -noout -subject -issuer -dates

echo "=== 3. www redirect ==="
curl -sI https://www.luliu.me/ | head -3

echo "=== 4. /posts/ count check ==="
curl -s https://luliu.me/posts/ | grep -oE 'href="/posts/[^"/]+/"' | sort -u | wc -l

echo "=== 5. /thoughts/ ==="
curl -s -o /dev/null -w '%{http_code}\n' https://luliu.me/thoughts/

echo "=== 6. /rss.xml valid ==="
curl -s https://luliu.me/rss.xml | head -3

echo "=== 7. /sitemap-index.xml ==="
curl -s -o /dev/null -w '%{http_code}\n' https://luliu.me/sitemap-index.xml

echo "=== 8. /404.html for unknown path ==="
curl -s -o /dev/null -w '%{http_code}\n' https://luliu.me/this-does-not-exist/

echo "=== 9. /blog → / redirect (legacy) ==="
curl -sI https://luliu.me/blog/ | head -3

echo "=== 10. Page load time ==="
curl -s -o /dev/null -w 'time_total=%{time_total}s size=%{size_download}B\n' https://luliu.me/
```

Expected:
1. `200 OK`
2. Cert subject `luliu.me`, issuer Let's Encrypt, dates current.
3. `301` redirect to `https://luliu.me/`
4. ≥ 220 (post detail links).
5. `200`
6. Valid XML opening.
7. `200`
8. `404`
9. `301` to `/`
10. < 1 second.

- [ ] **Step 2: Spot-check 5 random post URLs**

```bash
for slug in $(ls src/content/posts/*.md | shuf -n 5 | xargs -n1 basename | sed 's/\.md$//'); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://luliu.me/posts/$slug/")
  echo "https://luliu.me/posts/$slug/ → $code"
done
```

Expected: all `200`.

- [ ] **Step 3: Open in browser, manually inspect**

Visit:
- https://luliu.me/
- https://luliu.me/posts/
- https://luliu.me/about/

Confirm:
- Page renders.
- Chinese text is legible.
- Links work.
- Image-bearing posts (e.g. one of the 21 cnblogs posts with images) display images.
- Sign-off in your scratchpad: "Plan D cutover verified, live and serving."

---

## Phase 4 — Post-cutover housekeeping

### Task 12: Delete master branch protection bypass for the migration

(If you set up any temporary CI skip rules, revert.)

- [ ] **Step 1: Confirm `paths-ignore` config in `.github/workflows/deploy.yml` is the long-term version**

Should already match what was committed in Task 3. Re-read the workflow file. No action unless you customized it.

### Task 13: Remove old hexo cron + leftover files (defensive)

After rebuild, the old `/etc/cron.daily/sync-lustyle-blogs` and the old `/home/lu/blogs/` are gone (rebuild wiped disk). Confirm:

- [ ] **Step 1: Check that legacy paths are absent**

```bash
ssh root@luliu.me 'test ! -e /etc/cron.daily/sync-lustyle-blogs && echo "legacy cron gone"'
ssh root@luliu.me 'test ! -d /home/lu && echo "legacy /home/lu gone"'
ssh root@luliu.me 'docker ps -a 2>/dev/null || echo "docker not installed (good)"'
```

Expected: all three "good" assertions hold.

### Task 14: Set up a 7-day retention reminder for backup + Hetzner snapshot

- [ ] **Step 1: Calendar reminder**

Add a reminder for `2026-05-12` (7 days out): "Delete Hetzner snapshot pre-astro-migration-2026-05-05 if site is stable."

Also, plan to delete `~/vm-backup-2026-05-05/` 30 days out (`2026-06-04`) if the site is healthy.

Don't delete either yet.

### Task 15: Final verification gate

- [ ] **Step 1: Health checklist**

```bash
echo "=== Branch state ==="
git branch --show-current  # should be master
git log --oneline -5

echo "=== Live site ==="
curl -sI https://luliu.me/ | head -1
curl -s https://luliu.me/posts/ | grep -c '<h2'

echo "=== TLS expiry ==="
echo | openssl s_client -connect luliu.me:443 -servername luliu.me 2>/dev/null | openssl x509 -noout -enddate

echo "=== Last GH Actions run ==="
gh run list --limit 1 2>/dev/null || echo "(install gh to see run status)"
```

Expected: master is current, last run succeeded, TLS expiry > 60 days out.

- [ ] **Step 2: Final sign-off**

Add to scratchpad:

```
Plan D complete: 2026-05-05 (or completion date)
luliu.me serving Astro from rebuilt Ubuntu 24.04 cx21.
Old Hexo decommissioned. GH Actions deploy on push working.
All four plans (A, B, C, D) complete.
```

---

## Done

When all tasks above are checked, the migration is complete:

1. VM rebuilt Ubuntu 18.04 → 24.04, fresh disk.
2. Caddy serves static dist with auto-provisioned TLS.
3. GitHub Actions builds Astro on every push to master and rsyncs to VM.
4. Deploy user has restricted sudo (Caddy reload only).
5. ufw locked down to 22/80/443.
6. luliu.me serving 222 posts (58 original + 164 cnblogs) plus thoughts feed.
7. Old Hexo Docker stack gone.
8. Backup + snapshot retained as rollback insurance for 7-30 days.

**Future work:** Plan E (theme polish), search via Pagefind, view counts via GoatCounter, comments via Giscus — all deferred to separate planning passes.

---

## Rollback paths

| Failure | Recovery |
|---|---|
| Bootstrap script broken on VM | Re-run; idempotent. Or `apt-get purge` and rerun. |
| Caddy TLS issuance fails | Wait 60s; verify ports 80/443 open via ufw; check `journalctl -u caddy -n 50`. If repeated 5+ times, switch to ACME staging endpoint while debugging. |
| GH Actions can't SSH | Re-check `DEPLOY_SSH_KEY` (full content with header/footer) and `VM_HOST`. `ssh-keyscan` may have failed — log in once manually first to seed known_hosts on the runner (see `ssh-keyscan -H "$VM_HOST" >> ~/.ssh/known_hosts` step). |
| Site looks wrong after first deploy | Re-deploy old hexo from local backup: `rsync -az ~/vm-backup-2026-05-05/dist/ deploy@luliu.me:/var/www/luliu.me/` (after running `hexo generate` from the backup locally to produce a static dist; OR full Hetzner snapshot restore. |
| Disk full / VM problem | Hetzner Console → Restore from snapshot. ~5 min, returns to pre-migration state. |
