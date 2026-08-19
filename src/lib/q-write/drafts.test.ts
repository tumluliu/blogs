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
});
