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
    const callOrder: string[] = [];
    const save = vi.fn().mockImplementation(async (d: any) => {
      callOrder.push(d.body);
      if (d.body === 'stale') {
        throw new Error('IndexedDB failed');
      }
    });
    const onError = vi.fn();
    const auto = createAutosaver(save, 100, { onError });
    auto.schedule({ ...base(), body: 'stale' });
    await vi.advanceTimersByTimeAsync(100);
    // First save fails with 'stale', draft is re-queued
    expect(callOrder).toEqual(['stale']);
    expect(onError).toHaveBeenCalledTimes(1);
    // Before the re-queued 'stale' retry would fire, a fresh draft arrives
    auto.schedule({ ...base(), body: 'fresh' });
    // The fresh draft should replace the re-queued stale one
    await vi.advanceTimersByTimeAsync(1000);
    // Only 'fresh' should be saved (stale should not retry because fresh replaced it)
    expect(callOrder).toEqual(['stale', 'fresh']);
    expect(save).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('flush waits for in-flight save', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    let resolveFirstSave: (() => void) | null = null;
    const save = vi.fn().mockImplementation(() => {
      order.push('save-start');
      return new Promise<void>((resolve) => {
        resolveFirstSave = () => {
          order.push('save-end');
          resolve();
        };
      });
    });
    const auto = createAutosaver(save, 100);
    auto.schedule({ ...base(), body: 'in-flight' });
    await vi.advanceTimersByTimeAsync(100);
    // save() is now running but not yet resolved
    expect(order).toContain('save-start');
    const flushPromise = auto.flush();
    // flush is waiting for in-flight save, but it hasn't resolved yet
    let flushResolved = false;
    flushPromise.then(() => {
      order.push('flush-end');
      flushResolved = true;
    });
    // Advance timers but don't let microtasks run yet
    expect(flushResolved).toBe(false);
    // Resolve the in-flight save
    resolveFirstSave?.();
    // Now flush should resolve
    await flushPromise;
    expect(order).toEqual(['save-start', 'save-end', 'flush-end']);
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

  it('second flush waits for first flush pending-drain save (Finding A)', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    let resolveFirstSave: (() => void) | null = null;
    const save = vi.fn().mockImplementation((d: any) => {
      order.push(`save-start-${d.body}`);
      return new Promise<void>((resolve) => {
        resolveFirstSave = () => {
          order.push(`save-end-${d.body}`);
          resolve();
        };
      });
    });
    const auto = createAutosaver(save, 100);
    // Schedule a draft and immediately flush (no timer fires)
    auto.schedule({ ...base(), body: 'first' });
    const firstFlushPromise = auto.flush();
    // The first flush is draining pending and calling save()
    expect(order).toContain('save-start-first');
    // Before the first save settles, call flush again
    let secondFlushResolved = false;
    const secondFlushPromise = auto.flush().then(() => {
      order.push('flush2-end');
      secondFlushResolved = true;
    });
    // Second flush should NOT resolve yet
    expect(secondFlushResolved).toBe(false);
    // Resolve the first save
    resolveFirstSave?.();
    // Now both flushes should resolve
    await firstFlushPromise;
    await secondFlushPromise;
    // Verify order: both flushes waited for the save to settle
    expect(order).toContain('save-end-first');
    expect(order.indexOf('save-end-first')).toBeLessThan(order.indexOf('flush2-end'));
    vi.useRealTimers();
  });
});
