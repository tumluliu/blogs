import type { Draft } from '../drafts.js';
import { parseDoc, serializeDoc, docTitle, setDocTitle, patchMeta, type Doc } from '../frontmatter.js';
import { postPath, slugFromEntryName } from '../paths.js';
import { utf8Base64 } from '../../gh/encoding.js';
import { putFile, deleteFile, type GhAuth } from '../../gh/client.js';
import { findUploadingPlaceholder } from './images.js';

// Keys q-write derives wholesale from dedicated Draft fields and rewrites on
// every save. Everything else — including `date` (stamped once, never
// rewritten), `slug`, `source` and `title` — rides along in frontmatterExtra
// so it survives a round-trip untouched.
//
// `title` deliberately rides along even though the editor has a title field:
// where the title lives (a `title:` key vs. the body's H1) is a property of
// the document, and `docTitle`/`setDocTitle` can only make that call if the
// original `title:` key is still in front of them. Strip it here and a post
// carrying both a `title:` and an H1 loses the key and has its H1 rewritten.
const META_KEYS = new Set(['tags', 'draft', 'updated']);

// The frontmatter a Draft carries between saves: everything the serialized
// document holds except the keys rebuilt from Draft fields each time.
function extraFrom(fm: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fm)) {
    if (!META_KEYS.has(k)) extra[k] = v;
  }
  return extra;
}

// Matches only a fence that starts at position 0 — never a `---` horizontal
// rule that shows up later in the body. Used solely to strip an orphaned,
// unparseable frontmatter block; the leading `---...---` region itself isn't
// trusted to carry usable data once yaml.load has already rejected it.
const LEADING_FENCE_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export function draftFromRemote(id: string, path: string, sha: string, raw: string, now: Date): Draft {
  let doc: Doc;
  try {
    doc = parseDoc(raw);
  } catch (e) {
    // 229 posts, some hand-edited or imported from cnblogs — a malformed
    // frontmatter block must not crash the editor. Fall back to treating the
    // file as body text, same as a file with no `---` block at all — but
    // strip the orphaned fence first. Leaving it in place would let a later
    // resave wrap a brand-new frontmatter block around it, demoting whatever
    // was in there to inert text sitting under a second `---` pair.
    console.warn(`q-write: malformed frontmatter in ${path}, opening as plain body`, e);
    const body = raw.replace(LEADING_FENCE_RE, '').replace(/^\r?\n/, '');
    doc = { fm: {}, hadFrontmatter: false, body };
  }
  const { title } = docTitle(doc);
  const extra = extraFrom(doc.fm);
  const iso = now.toISOString();
  return {
    id,
    title,
    slug: slugFromEntryName(path.split('/').pop() ?? ''),
    // A file already on disk owns its filename; never auto-rename it.
    slugManual: true,
    tags: Array.isArray(doc.fm.tags) ? (doc.fm.tags as string[]) : [],
    // The body is kept verbatim; when the title lives in an H1 it stays there.
    body: doc.body,
    frontmatterExtra: extra,
    hadFrontmatter: doc.hadFrontmatter,
    remotePath: path,
    remoteSha: sha,
    state: doc.fm.draft === true ? 'synced' : 'published',
    createdAt: iso,
    updatedAt: iso,
  };
}

// Renders the draft to the exact bytes that go into the repo, and hands back
// the document those bytes were serialized from so the caller can fold the
// frontmatter it just wrote back into the Draft.
export function renderDraft(d: Draft, opts: { publish: boolean; now: Date }): { markdown: string; doc: Doc } {
  let doc: Doc = { fm: { ...d.frontmatterExtra }, hadFrontmatter: d.hadFrontmatter, body: d.body };

  // Taken before anything is patched, so the fm-vs-H1 question is answered
  // against the document as it exists in the repo, not against a rebuilt one.
  const existingTitle = docTitle(doc);
  const isNew = !d.remotePath;

  if (isNew) {
    doc = patchMeta(doc, {
      slug: d.slug,
      date: opts.now.toISOString(),
      source: (d.frontmatterExtra.source as string) ?? 'original',
    });
    doc = setDocTitle(doc, d.title);
  } else {
    // Editing something that already exists: `date` is left exactly as it was
    // (it rides in frontmatterExtra), and `updated` is stamped instead.
    if (d.title && d.title !== existingTitle.title) doc = setDocTitle(doc, d.title);
    if (doc.fm.slug !== undefined) doc = patchMeta(doc, { slug: d.slug });
    doc = patchMeta(doc, { updated: opts.now.toISOString() });
  }

  if (d.tags.length > 0) doc = patchMeta(doc, { tags: d.tags });
  // 存到仓库 on a post that is already live is a checkpoint, not a retraction:
  // the state machine only runs local → synced → published, and nothing in the
  // UI announces an unpublish. Writing `draft: true` here would drop the post
  // out of /, /posts/, /tags/* and rss.xml on the next deploy.
  doc = patchMeta(doc, { draft: !opts.publish && d.state !== 'published' });

  return { markdown: serializeDoc(doc), doc };
}

export function docFromDraft(d: Draft, opts: { publish: boolean; now: Date }): string {
  return renderDraft(d, opts).markdown;
}

export interface SaveOutcome {
  ok: boolean;
  status: number;
  message?: string;
  draft: Draft;
  conflict?: boolean;
}

export async function saveDraftToRepo(
  auth: GhAuth,
  d: Draft,
  opts: { publish: boolean; now: Date },
): Promise<SaveOutcome> {
  const path = postPath(d.slug);
  const renaming = !!d.remotePath && d.remotePath !== path;
  const { markdown, doc } = renderDraft(d, opts);
  const message = `${opts.publish ? 'post' : 'draft'}: ${d.slug} via q-write`;

  const res = await putFile(auth, {
    path,
    contentBase64: utf8Base64(markdown),
    message,
    // A rename writes a brand-new path, so the old sha must not travel with it.
    sha: renaming ? undefined : d.remoteSha,
  });

  if (!res.ok) {
    const conflict = res.status === 409 || res.status === 422;
    return { ok: false, status: res.status, message: res.message, draft: d, conflict };
  }

  let message2: string | undefined;
  if (renaming && d.remoteSha && d.remotePath) {
    const del = await deleteFile(auth, {
      path: d.remotePath,
      sha: d.remoteSha,
      message: `chore: remove ${d.remotePath} after q-write rename`,
    });
    // Content is already safe at the new path; a failed delete is a warning.
    if (!del.ok) message2 = `新路径已写入，但旧文件 ${d.remotePath} 删除失败（${del.status}），需手动清理`;
  }

  return {
    ok: true,
    status: res.status,
    message: message2,
    draft: {
      ...d,
      // Fold the frontmatter that was just written back into the draft.
      // Without this the next save rebuilds the document from a stale (for a
      // first save, empty) frontmatterExtra while `remotePath` already makes
      // it look like an edit — so `date`, `slug` and `source` would never be
      // written again and the post would be re-dated by the build on every
      // deploy.
      frontmatterExtra: extraFrom(doc.fm),
      hadFrontmatter: doc.hadFrontmatter,
      remotePath: path,
      remoteSha: res.data?.sha ?? d.remoteSha,
      // A checkpoint of a live post leaves it live (see renderDraft), so the
      // state must stay `published` too — falling back to `synced` would let
      // the *next* checkpoint write draft: true and unpublish it after all.
      state: opts.publish || d.state === 'published' ? 'published' : 'synced',
      updatedAt: opts.now.toISOString(),
    },
  };
}

// The pure decision behind the "can this draft even be committed" gate that
// the editor's save/publish buttons must check before doing anything else.
// Extracted out of the DOM wiring (which vitest's `node` environment can't
// exercise) so both refusals — and the exact message shown for each — are
// covered by a real test instead of living only in an `<script>` `if` that
// nothing catches if it's ever deleted.
export type PreflightResult =
  | { ok: true }
  | { ok: false; reason: 'no-slug'; message: string }
  | { ok: false; reason: 'uploading'; message: string; uploadId: string };

// The rename half of a commit — PUT the new path, DELETE the old one — takes
// a file (and every link pointing at it) off the site. Extracted from the DOM
// wiring for the same reason as preflightCommit: so the fact that a slug
// change *moves* rather than copies, and the exact prompt that says so, are
// covered by a test instead of living only in an `<script>` `confirm(...)`.
export type RenamePlan =
  | { renames: false }
  | { renames: true; from: string; to: string; message: string };

export function renamePlan(d: Draft): RenamePlan {
  const to = postPath(d.slug);
  if (!d.remotePath || d.remotePath === to) return { renames: false };
  return {
    renames: true,
    from: d.remotePath,
    to,
    message:
      `改 slug 会移动仓库里的文件，不是复制。\n\n` +
      `新文件：${to}\n删除旧文件：${d.remotePath}\n\n` +
      `旧链接会失效。确定继续？`,
  };
}

export function preflightCommit(d: Draft): PreflightResult {
  if (!d.slug) {
    return { ok: false, reason: 'no-slug', message: '先写标题（或手动填 slug）' };
  }
  const uploadId = findUploadingPlaceholder(d.body);
  if (uploadId) {
    return {
      ok: false,
      reason: 'uploading',
      uploadId,
      message: `图片 ${uploadId} 还没传完，重试或删除后再存`,
    };
  }
  return { ok: true };
}
