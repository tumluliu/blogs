# VM Discovery & Backup Snapshot — 2026-05-05

Pre-migration snapshot of the Hetzner Cloud cx21 (`luliu.me`) running Hexo on Ubuntu 18.04.

## What's here (committed metadata)

| File | Purpose |
|---|---|
| `manifest.txt` | Discovered paths, runtime details, deploy mechanism |
| `run.log` | Full discovery script output (MAC + IPv6 redacted) |
| `cron-all-users.txt` | Per-user crontabs |
| `etc-crontab.txt` | System crontab |
| `firewall.txt` | ufw + iptables-save output |
| `nginx-luliu.me.conf` | Active nginx site config (proxies to hexo container) |
| `sync-lustyle-blogs.cron` | The deploy script: `git pull origin master` daily |
| `MANIFEST.sha256` | Checksums of the local backup tree |

## What's NOT committed (held only locally, gitignored)

Local backup at `~/vm-backup-2026-05-05/` (~2.5 GB):

- `hexo/` — full Hexo project source (excludes `node_modules`, `public`)
- `etc/nginx/`, `etc/letsencrypt/` — server configs and live certs
- `home/`, `root/` — user home dirs (includes `.ssh`, `.gnupg` — sensitive)
- `docker/image-tumluliu-hexo-6.3.0.tar.gz` (184 MB) — locally-built image, not on Docker Hub
- `docker/compose-resolved.yml`, `inspect-all-containers.json`
- `extras/` — cron tables, firewall, etc.

Local backup retained ≥30 days post-cutover.

## Verification

Old Hexo site rebuilt locally from this backup on 2026-05-05:

1. Loaded the saved image: `docker load < image-tumluliu-hexo-6.3.0.tar.gz`
2. Booted compose with bind mounts to `~/vm-backup-2026-05-05/hexo/`
3. NexT theme 8.16.0 loaded.
4. `http://localhost:4321/blog/` returned 200.
5. Individual post URLs (e.g. `/blog/2023/01/01/2023.../`) returned 200 with content.
6. Post count vs live: 20 (local) vs 21 (live) — single missing post is a recent commit not yet pulled by VM cron.

→ Backup proven sufficient. No-data-loss gate passed.

## Hetzner snapshot

A Hetzner Cloud snapshot was also taken on 2026-05-05 as additional rollback insurance. Held in cloud console for ≥7 days post-cutover.

## Key findings (worth knowing for next plans)

- Hexo URL base is `/blog` (nginx proxies `luliu.me/*` → `localhost:4000` → hexo container at `http://localhost:4321/blog/`).
- The `tumluliu/hexo:6.3.0` Docker image was built locally on the VM (not on Docker Hub). Its tarball is the only copy.
- Theme `next` (npm package `hexo-theme-next@^8.16.0`) is installed inside the container, not on the host filesystem.
- Deploy mechanism: `/etc/cron.daily/sync-lustyle-blogs` runs `git pull origin master` once a day in `/home/lu/blogs/source/_posts/`.
- Hexo container restarts automatically (`restart: always`); `hexo s` watches files, re-renders on change.
- VM has substantial legacy content under `/home/lu/aws-bak/`, `/home/lu/hexo_lustyle/`, `/home/lu/docker-hexo/` — pre-migration snapshots, captured but not currently in use.
- No certbot post-renewal hook found that reloads nginx — relying on default certbot timer behavior.
