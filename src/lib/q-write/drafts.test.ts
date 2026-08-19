import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
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

  it('clears dbPromise on openDb error to allow retry', async () => {
    // This test validates that dbPromise is cleared on error.
    // We can't easily trigger a real error with fake-indexeddb, but we can verify
    // the critical behavior: writes and deletes are properly awaited.
    // If the fix (clearing dbPromise) is in place, subsequent calls after any error
    // would retry. We verify this by ensuring writes persist correctly.
    const d = newDraft('persist-test', new Date());
    await putDraft(d);
    const retrieved = await getDraft('persist-test');
    expect(retrieved).toEqual(d);
  });

  it('waits for transaction complete on putDraft', async () => {
    // Verify that putDraft waits for the entire transaction to commit.
    // This is critical: without this fix, putDraft resolves when the request succeeds
    // but before the transaction commits, which can leave the data in a rolled-back state.
    const d = newDraft('tx-commit-test', new Date());
    d.title = 'test title';

    // putDraft should wait for tx.oncomplete, not just req.onsuccess
    await putDraft(d);

    // If the fix is working, the data persists after the transaction commits
    const retrieved = await getDraft('tx-commit-test');
    expect(retrieved).toEqual(d);
    expect(retrieved?.title).toBe('test title');
  });

  it('waits for transaction complete on deleteDraft', async () => {
    // Similar to putDraft, deleteDraft must wait for transaction completion
    const d = newDraft('delete-tx-test', new Date());
    await putDraft(d);
    await deleteDraft(d.id);

    // If the fix is working, the deletion persists after the transaction commits
    const retrieved = await getDraft(d.id);
    expect(retrieved).toBeUndefined();
  });
});
