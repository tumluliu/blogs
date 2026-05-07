export interface PublishDeps {
  fetch: typeof fetch;
  pat: string;
  repo: string; // "owner/name"
  filename: string; // e.g. "2026-05-07-0907.md"
  contentBase64: string;
  message: string;
}

export interface PublishResult {
  ok: boolean;
  status: number;
  message?: string;
}

export async function publishThought(deps: PublishDeps): Promise<PublishResult> {
  const url = `https://api.github.com/repos/${deps.repo}/contents/src/content/thoughts/${deps.filename}`;
  try {
    const res = await deps.fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${deps.pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: deps.message,
        content: deps.contentBase64,
        branch: 'master',
      }),
    });

    if (res.ok) {
      return { ok: true, status: res.status };
    }
    let msg: string | undefined;
    try {
      const data = await res.json();
      msg = data?.message;
    } catch {
      // body may not be JSON; ignore
    }
    return { ok: false, status: res.status, message: msg };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown error';
    return { ok: false, status: 0, message: `network error: ${reason}` };
  }
}
