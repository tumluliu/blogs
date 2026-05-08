# luliu.me

Source for [luliu.me](https://luliu.me/) — long-form posts and a
stream of shorter thoughts. Built with Astro and deployed via GitHub
Actions to a self-hosted VM.

## Authoring

A post is just a markdown file under `src/content/posts/`. Frontmatter
is optional — `title`, `slug`, `date`, `tags`, etc. are all derived if
you omit them. See [`docs/obsidian-workflow.md`](docs/obsidian-workflow.md)
for the full authoring guide.

Mobile thought capture is handled by a tiny PWA at
[/q-sort/](https://luliu.me/q-sort/) — installable to the Android home
screen.

## Local development

Requires Node 22+ and pnpm.

```sh
pnpm install   # also installs the pre-push build-check hook
pnpm dev       # localhost:4321
pnpm build     # full static build into ./dist
pnpm test      # vitest
```

## Repo layout

```
src/content/         markdown posts and thoughts
src/content/diagrams/ shared images, optimised by Astro
src/pages/q-sort/    Quick-Thought capture PWA
public/              static assets (icons, manifest, sw.js, legacy images)
scripts/             one-shot tools (cnblogs import, icon generator, etc.)
docs/                authoring guide and design specs
.githooks/           pre-push build check
```

## Deploy

A push to `master` triggers `.github/workflows/deploy.yml`, which
builds, smoke-checks, and rsyncs `dist/` to the VM. The pre-push hook
(`.githooks/pre-push`) runs `pnpm build` locally first to catch
breakage before it reaches CI. Skip with `git push --no-verify`.
