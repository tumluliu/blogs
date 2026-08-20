import { base64ToUtf8 } from './encoding.js';

export interface GhAuth {
  fetch: typeof fetch;
  pat: string;
  repo: string; // "owner/name"
}

export interface GhResult<T> {
  ok: boolean;
  status: number;
  message?: string;
  data?: T;
}

export interface GhFile {
  path: string;
  sha: string;
  text: string;
}

export interface GhEntry {
  name: string;
  path: string;
  sha: string;
}

const BRANCH = 'master';

function headers(pat: string): Record<string, string> {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function url(repo: string, path: string): string {
  return `https://api.github.com/repos/${repo}/contents/${path}`;
}

async function request<T>(
  auth: GhAuth,
  path: string,
  init: RequestInit,
  parse: (json: unknown) => T,
): Promise<GhResult<T>> {
  try {
    const res = await auth.fetch(url(auth.repo, path), {
      ...init,
      headers: headers(auth.pat),
    });
    if (!res.ok) {
      let message: string | undefined;
      try {
        message = ((await res.json()) as { message?: string })?.message;
      } catch {
        // non-JSON error body; the status alone has to do
      }
      return { ok: false, status: res.status, message };
    }
    return { ok: true, status: res.status, data: parse(await res.json()) };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown error';
    return { ok: false, status: 0, message: `network error: ${reason}` };
  }
}

export function getFile(auth: GhAuth, path: string): Promise<GhResult<GhFile>> {
  return request(auth, path, { method: 'GET' }, (json) => {
    const f = json as { path: string; sha: string; content: string };
    return { path: f.path, sha: f.sha, text: base64ToUtf8(f.content) };
  });
}

export function putFile(
  auth: GhAuth,
  args: { path: string; contentBase64: string; message: string; sha?: string },
): Promise<GhResult<{ sha: string }>> {
  const body: Record<string, string> = {
    message: args.message,
    content: args.contentBase64,
    branch: BRANCH,
  };
  if (args.sha) body.sha = args.sha;
  return request(auth, args.path, { method: 'PUT', body: JSON.stringify(body) }, (json) => ({
    sha: (json as { content?: { sha: string } }).content?.sha ?? '',
  }));
}

export function deleteFile(
  auth: GhAuth,
  args: { path: string; sha: string; message: string },
): Promise<GhResult<null>> {
  return request(
    auth,
    args.path,
    { method: 'DELETE', body: JSON.stringify({ message: args.message, sha: args.sha, branch: BRANCH }) },
    () => null,
  );
}

export function listDir(auth: GhAuth, path: string): Promise<GhResult<GhEntry[]>> {
  return request(auth, path, { method: 'GET' }, (json) => {
    const entries = json as { type: string; name: string; path: string; sha: string }[];
    return entries
      .filter((e) => e.type === 'file')
      .map((e) => ({ name: e.name, path: e.path, sha: e.sha }));
  });
}
