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
