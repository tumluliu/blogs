import { describe, it, expect, vi } from 'vitest';
import { applyTitle, applySlug, touch, countWords, createAutosaver } from './state.js';
import { newDraft } from '../drafts.js';

const base = () => newDraft('id', new Date(2026, 7, 19, 12, 0));

describe('applyTitle', () => {
  it('regenerates the slug while it is still automatic', () => {
    const d = applyTitle(base(), '空间记忆');
    expect(d.title).toBe('空间记忆');
    expect(d.slug).toBe('kong-jian-ji-yi');
  });

  it('leaves a hand-edited slug alone', () => {
    const d = applyTitle(applySlug(base(), 'my-slug'), '空间记忆');
    expect(d.slug).toBe('my-slug');
    expect(d.slugManual).toBe(true);
  });
});

describe('countWords', () => {
  it('counts CJK characters individually', () => {
    expect(countWords('空间记忆')).toBe(4);
  });

  it('counts latin words, not letters', () => {
    expect(countWords('hello brave new world')).toBe(4);
  });

  it('counts a mixed line as the sum of both', () => {
    expect(countWords('从 Obsidian 到 q-write')).toBe(4); // 从, Obsidian, 到, q-write
  });

  it('ignores markdown image placeholders', () => {
    expect(countWords('图\n\n![](uploading:img-1)')).toBe(1);
  });
});

describe('touch', () => {
  it('advances updatedAt but not createdAt', () => {
    const d = touch(base(), new Date(2026, 7, 19, 13, 0));
    expect(d.updatedAt).not.toBe(d.createdAt);
  });
});

describe('createAutosaver', () => {
  it('coalesces rapid edits into one save', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const auto = createAutosaver(save, 800);
    auto.schedule({ ...base(), body: 'a' });
    auto.schedule({ ...base(), body: 'ab' });
    auto.schedule({ ...base(), body: 'abc' });
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].body).toBe('abc');
    vi.useRealTimers();
  });

  it('flush saves immediately and cancels the pending timer', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const auto = createAutosaver(save, 800);
    auto.schedule({ ...base(), body: 'x' });
    await auto.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('flush with nothing pending does nothing', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await createAutosaver(save, 800).flush();
    expect(save).not.toHaveBeenCalled();
  });
});
