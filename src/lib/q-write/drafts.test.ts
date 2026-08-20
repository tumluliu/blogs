import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { newDraft, putDraft, getDraft, listDrafts, deleteDraft } from './drafts.js';

describe('drafts store', () => {
  beforeEach(async () => {
    for (const d of await listDrafts()) await deleteDraft(d.id);
  });

  it('creates a blank draft in local state', () => {
    const d = newDraft('id-1', new Date(2026, 7, 19, 12, 0));
    expect(d).toMatchObject({ id: 'id-1', state: 'local', slugManual: false, tags: [], body: '' });
    expect(d.createdAt).toBe(d.updatedAt);
  });

  it('round-trips a draft', async () => {
    const d = newDraft('id-2', new Date());
    d.title = '标题';
    d.body = '正文';
    await putDraft(d);
    expect(await getDraft('id-2')).toEqual(d);
  });

  it('overwrites on put with the same id', async () => {
    const d = newDraft('id-3', new Date());
    await putDraft(d);
    await putDraft({ ...d, title: '改过' });
    const all = await listDrafts();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('改过');
  });

  it('lists newest-updated first', async () => {
    const older = { ...newDraft('old', new Date()), updatedAt: '2026-08-01T10:00:00.000Z' };
    const newer = { ...newDraft('new', new Date()), updatedAt: '2026-08-18T10:00:00.000Z' };
    await putDraft(older);
    await putDraft(newer);
    expect((await listDrafts()).map((d) => d.id)).toEqual(['new', 'old']);
  });

  it('deletes', async () => {
    await putDraft(newDraft('gone', new Date()));
    await deleteDraft('gone');
    expect(await getDraft('gone')).toBeUndefined();
  });

  it('returns undefined for an unknown id', async () => {
    expect(await getDraft('nope')).toBeUndefined();
  });

  it('rejects putDraft when the write transaction aborts', async () => {
    // A put that reports request success and then loses the transaction
    // (quota, a crash mid-commit) must not look like a saved draft: the
    // editor's autosave treats a resolved putDraft as "safely stored".
    const { spy } = stubAbortingTransaction();
    try {
      await expect(putDraft(newDraft('aborted', new Date()))).rejects.toThrow(/abort/i);
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects deleteDraft when the write transaction aborts', async () => {
    const { spy } = stubAbortingTransaction();
    try {
      await expect(deleteDraft('aborted')).rejects.toThrow(/abort/i);
    } finally {
      spy.mockRestore();
    }
  });

  it('retries opening the database after a failed open instead of caching the rejection', async () => {
    // A phone that denies IndexedDB once (private mode prompt, transient
    // quota error) must not leave the app permanently unable to store a
    // draft: the failed open must not stay cached in dbPromise.
    vi.resetModules();
    const realOpen = indexedDB.open.bind(indexedDB);
    let opens = 0;
    const spy = vi.spyOn(indexedDB, 'open').mockImplementation(((...args: [string, number?]) => {
      opens += 1;
      if (opens > 1) return realOpen(...args);
      const req: Record<string, unknown> = {
        error: new Error('open denied'),
        result: undefined,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => (req.onerror as (() => void) | null)?.());
      return req as unknown as IDBOpenDBRequest;
    }) as typeof indexedDB.open);

    try {
      const fresh = await import('./drafts.js');
      await expect(fresh.getDraft('anything')).rejects.toThrow('open denied');
      await expect(fresh.getDraft('anything')).resolves.toBeUndefined();
      expect(opens).toBe(2);
    } finally {
      spy.mockRestore();
      vi.resetModules();
    }
  });
});

// Replaces IDBDatabase#transaction with one that fires the request's success
// callback — what the store used to resolve on — and then aborts.
function stubAbortingTransaction() {
  const req: Record<string, unknown> = { result: undefined, onsuccess: null, onerror: null };
  const t: Record<string, unknown> = {
    objectStore: () => ({ put: () => req, delete: () => req, get: () => req }),
    oncomplete: null,
    onerror: null,
    onabort: null,
    error: new Error('QuotaExceededError'),
  };
  const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
    queueMicrotask(() => {
      (req.onsuccess as (() => void) | null)?.();
      (t.onabort as (() => void) | null)?.();
    });
    return t as unknown as IDBTransaction;
  });
  return { spy };
}
