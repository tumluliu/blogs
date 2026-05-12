# Counter Deploy — Manual Smoke Checklist

Run after the first push that lands the counter (and after the one-time
VM bootstrap from `infra/vm-bootstrap.sh`).

## On the VM (single SSH session)

```bash
sudo bash /root/vm-bootstrap.sh   # idempotent; re-run picks up counter additions
systemctl status counter --no-pager | head -10
systemctl status counter-backup.timer --no-pager | head -5
ls -la /var/lib/counter/
```

Expected:
- `counter.service` active (after first CI deploy)
- `counter-backup.timer` enabled + active
- `/var/lib/counter/counter.db` (and later `.db.bak`) present, owned by `counter:counter`.

## From any browser / curl

```bash
curl -fsS https://luliu.me/api/_health
# → ok

curl -fsS https://luliu.me/api/stats/why-not-wechat
# → {"views":0,"likes":0}   (or higher if visits already counted)

curl -fsS -X POST https://luliu.me/api/view/why-not-wechat \
  -H 'User-Agent: Mozilla/5.0' -H 'Sec-Fetch-Site: same-origin'
# → {"views":N}

# Repeat from same IP within 30 min → no change.
```

## In a real browser

1. Open https://luliu.me/posts/why-not-wechat/.
2. Confirm engagement block at bottom shows:
   - `N 次阅读` (number, not `—`).
   - Word count (`字`).
   - Like button + Share button.
3. Click Like → button turns highlighted; refresh → still highlighted (localStorage).
4. Click Share:
   - Android Chrome → OS share sheet appears.
   - Desktop browser → toast `已复制链接` and clipboard contains the URL.
5. DevTools → Application → Local Storage: `liked:why-not-wechat = "1"`.

## Failure modes to spot

- API `/api/_health` returns 502 → counter service down. `journalctl -u counter -n 50`.
- Engagement shows persistent `—` → check CORS in DevTools Network tab; verify `Access-Control-Allow-Origin: https://luliu.me`.
- Like 429 on first click → check rate limiter sees correct client IP (Caddy forwarding `X-Forwarded-For`?).
