import { hash8 } from '../image.js';
import { mediaPath, mediaUrl } from '../paths.js';
import { bytesToBase64 } from '../../gh/encoding.js';
import { getFile, putFile, type GhAuth } from '../../gh/client.js';

const MAX_BYTES = 5 * 1024 * 1024;

export function placeholder(id: string): string {
  return `![](uploading:${id})`;
}

export function replacePlaceholder(body: string, id: string, replacement: string): string {
  return body.split(placeholder(id)).join(replacement);
}

// Matches any `![...](uploading:ID)` placeholder() left in a draft's body —
// e.g. when an upload failed and the user never retried. Save/publish must
// refuse while one is present, or a broken image reference reaches the live
// site. Returns the placeholder's id (for the user-facing message) or null.
const UPLOADING_RE = /!\[[^\]]*\]\(uploading:([^)]+)\)/;

export function findUploadingPlaceholder(body: string): string | null {
  return UPLOADING_RE.exec(body)?.[1] ?? null;
}

export interface UploadResult {
  ok: boolean;
  url?: string;
  status: number;
  message?: string;
  skipped?: boolean;
}

export async function uploadImage(
  auth: GhAuth,
  blob: Blob,
  ext: string,
  now: Date,
): Promise<UploadResult> {
  if (blob.size > MAX_BYTES) {
    return { ok: false, status: 0, message: `压缩后仍有 ${Math.round(blob.size / 1024)}KB，超过 5MB 上限` };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const name = await hash8(bytes);
  const repoPath = mediaPath(now, name, ext);
  const url = mediaUrl(now, name, ext);

  // Content-addressed: if it is already there, the bytes are identical.
  const existing = await getFile(auth, repoPath);
  if (existing.ok) return { ok: true, url, status: existing.status, skipped: true };

  const res = await putFile(auth, {
    path: repoPath,
    contentBase64: bytesToBase64(bytes),
    message: `media: add ${name}.${ext} via q-write`,
  });

  if (!res.ok) return { ok: false, status: res.status, message: res.message };
  return { ok: true, url, status: res.status };
}

export interface UploadRow {
  label: string;
  file: File;
  error?: boolean;
}

// Tracks one row per in-flight (or failed) upload, keyed by the placeholder
// id that owns it. A multi-file batch calls set()/clear() once per file as
// its own upload progresses, without disturbing any other file's row — the
// bug this replaces was a single-slot "last write wins" strip that erased
// an earlier file's still-unresolved error row the moment the next file's
// row was painted.
export class UploadRows {
  private rows = new Map<string, UploadRow>();

  set(id: string, row: UploadRow): void {
    this.rows.set(id, row);
  }

  clear(id: string): void {
    this.rows.delete(id);
  }

  list(): (UploadRow & { id: string })[] {
    return Array.from(this.rows, ([id, row]) => ({ id, ...row }));
  }
}

// A tiny FIFO queue: every push() waits for every previously pushed item's
// worker to settle before starting its own. Same promise-chain shape as
// ui/state.ts's createAutosaver, applied here so that the picker's change
// event, a paste, and a drop firing close together never run their uploads
// concurrently — which would otherwise let two triggers race the same
// content's getFile probe into two PUTs for one path.
export function createSerialQueue<T>(
  worker: (item: T) => Promise<void>,
  onError?: (err: unknown, item: T) => void,
) {
  let chain: Promise<void> = Promise.resolve();
  return {
    push(item: T): Promise<void> {
      const next = chain.then(() => worker(item)).catch((err) => onError?.(err, item));
      chain = next;
      return next;
    },
  };
}
