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

  it('counts Hangul syllables as words, not per-character', () => {
    // Hangul should NOT be counted per-character like CJK
    // '한국어 테스트' = 2 words (한국어, 테스트)
    expect(countWords('한국어 테스트')).toBe(2);
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

  it('re-queues draft when save fails', async () => {
    vi.useFakeTimers();
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('IndexedDB failed'))
      .mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const auto = createAutosaver(save, 100, { onError });
    auto.schedule({ ...base(), body: 'first' });
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    // Draft should be re-queued, not lost
    auto.schedule({ ...base(), body: 'second' });
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].body).toBe('second');
    vi.useRealTimers();
  });

  it('clobbers stale draft with newer on retry', async () => {
    vi.useFakeTimers();
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('IndexedDB failed'))
      .mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const auto = createAutosaver(save, 100, { onError });
    auto.schedule({ ...base(), body: 'stale' });
    await vi.advanceTimersByTimeAsync(100);
    // Error occurs, draft re-queued
    // Before next retry, a newer draft arrives
    auto.schedule({ ...base(), body: 'fresh' });
    // Fresh draft should replace stale
    await vi.advanceTimersByTimeAsync(100);
    expect(save.mock.calls[1][0].body).toBe('fresh');
    vi.useRealTimers();
  });

  it('flush waits for in-flight save', async () => {
    vi.useFakeTimers();
    let resolveFirstSave: (() => void) | null = null;
    const save = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolveFirstSave = resolve;
      });
    });
    const auto = createAutosaver(save, 100);
    auto.schedule({ ...base(), body: 'in-flight' });
    await vi.advanceTimersByTimeAsync(100);
    // save() is now running but not yet resolved
    expect(save).toHaveBeenCalledTimes(1);
    const flushPromise = auto.flush();
    expect(save).toHaveBeenCalledTimes(1); // No new save yet
    // Resolve the in-flight save
    resolveFirstSave?.();
    await flushPromise;
    // flush should have waited for in-flight before returning
    expect(save).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('flush saves newly pending while waiting for in-flight', async () => {
    vi.useFakeTimers();
    let resolveFirstSave: (() => void) | null = null;
    const save = vi.fn()
      .mockImplementationOnce(() => {
        return new Promise<void>((resolve) => {
          resolveFirstSave = resolve;
        });
      })
      .mockResolvedValueOnce(undefined);
    const auto = createAutosaver(save, 100);
    auto.schedule({ ...base(), body: 'first' });
    await vi.advanceTimersByTimeAsync(100);
    // save() is in-flight
    expect(save).toHaveBeenCalledTimes(1);
    const flushPromise = auto.flush();
    // While flush is waiting, new draft arrives
    auto.schedule({ ...base(), body: 'second' });
    resolveFirstSave?.();
    await flushPromise;
    // flush should have saved the second draft too
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].body).toBe('second');
    vi.useRealTimers();
  });
});
