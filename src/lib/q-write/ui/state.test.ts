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
    const savedBodies: string[] = [];
    let resolveStaleReject: (() => void) | null = null;
    const save = vi.fn().mockImplementation((d: any) => {
      return new Promise<void>((resolve, reject) => {
        if (d.body === 'stale') {
          resolveStaleReject = () => {
            reject(new Error('IndexedDB failed'));
          };
        } else if (d.body === 'fresh') {
          savedBodies.push('fresh');
          resolve();
        }
      });
    });
    const onError = vi.fn();
    const auto = createAutosaver(save, 50, { onError });
    auto.schedule({ ...base(), body: 'stale' });
    // Let timer fire
    await vi.advanceTimersByTimeAsync(50);
    expect(save).toHaveBeenCalledTimes(1);
    // While stale save is in flight, schedule fresh
    auto.schedule({ ...base(), body: 'fresh' });
    // Advance timer for fresh
    await vi.advanceTimersByTimeAsync(50);
    // Reject the stale save
    resolveStaleReject?.();
    // Let everything complete
    await vi.advanceTimersByTimeAsync(100);
    // Fresh should have been saved
    expect(savedBodies).toContain('fresh');
    // Stale error should have been reported
    expect(onError).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('flush waits for in-flight save', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    let resolveSavePromise: (() => void) | null = null;
    let savePromise: Promise<void>;
    const save = vi.fn().mockImplementation(() => {
      order.push('save-start');
      savePromise = new Promise<void>((resolve) => {
        resolveSavePromise = resolve;
      });
      // Attach .then() to the promise itself, not to the resolver
      savePromise.then(() => {
        order.push('save-end');
      });
      return savePromise;
    });
    const auto = createAutosaver(save, 100);
    auto.schedule({ ...base(), body: 'in-flight' });
    await vi.advanceTimersByTimeAsync(100);
    // save() is now running but not yet resolved
    expect(order).toContain('save-start');
    const flushPromise = auto.flush();
    // Attach .then() to flush promise
    flushPromise.then(() => {
      order.push('flush-end');
    });
    // Resolve the in-flight save
    resolveSavePromise?.();
    // Now flush should resolve
    await flushPromise;
    expect(order).toEqual(['save-start', 'save-end', 'flush-end']);
    vi.useRealTimers();
  });

  it('flush saves newly pending while waiting for in-flight', async () => {
    vi.useFakeTimers();
    const inFlightCount: number[] = [];
    let currentlyInFlight = 0;
    let maxConcurrent = 0;
    let resolveFirstSave: (() => void) | null = null;
    const save = vi.fn()
      .mockImplementationOnce(() => {
        currentlyInFlight++;
        maxConcurrent = Math.max(maxConcurrent, currentlyInFlight);
        inFlightCount.push(currentlyInFlight);
        return new Promise<void>((resolve) => {
          resolveFirstSave = resolve;
        }).finally(() => {
          currentlyInFlight--;
        });
      })
      .mockImplementationOnce(() => {
        currentlyInFlight++;
        maxConcurrent = Math.max(maxConcurrent, currentlyInFlight);
        inFlightCount.push(currentlyInFlight);
        return Promise.resolve().finally(() => {
          currentlyInFlight--;
        });
      });
    const auto = createAutosaver(save, 50);
    auto.schedule({ ...base(), body: 'first' });
    await vi.advanceTimersByTimeAsync(50);
    const flushPromise = auto.flush();
    auto.schedule({ ...base(), body: 'second' });
    await vi.advanceTimersByTimeAsync(50);
    resolveFirstSave?.();
    await flushPromise;
    // With serialization, at most one save should be in flight at a time
    expect(maxConcurrent).toBe(1);
    vi.useRealTimers();
  });

  it('second flush waits for first flush pending-drain save (Finding A)', async () => {
    vi.useFakeTimers();
    let saveCompleted = false;
    let resolveSavePromise: (() => void) | null = null;
    const save = vi.fn().mockImplementation((d: any) => {
      return new Promise<void>((resolve) => {
        resolveSavePromise = () => {
          saveCompleted = true;
          resolve();
        };
      });
    });
    const auto = createAutosaver(save, 100);
    // Schedule and immediately flush
    auto.schedule({ ...base(), body: 'first' });
    const firstFlushPromise = auto.flush();
    // Let flush run and queue the save
    await vi.runOnlyPendingTimersAsync();
    // Call flush again while save is in flight
    let secondFlushReturned = false;
    const secondFlushPromise = auto.flush().then(() => {
      secondFlushReturned = true;
    });
    // Second flush should not return before save completes
    expect(secondFlushReturned).toBe(false);
    // Resolve the save
    resolveSavePromise?.();
    await vi.runOnlyPendingTimersAsync();
    // Now both flushes should have completed
    await firstFlushPromise;
    await secondFlushPromise;
    expect(saveCompleted).toBe(true);
    expect(secondFlushReturned).toBe(true);
    vi.useRealTimers();
  });
});
