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
    // Every attempt is recorded, so a stale retry after the newer draft shows up
    // as an extra trailing entry rather than being invisible to the assertions.
    const attempted: string[] = [];
    let rejectStale: (() => void) | null = null;
    const save = vi.fn().mockImplementation((d: { body: string }) => {
      attempted.push(d.body);
      if (d.body === 'stale') {
        return new Promise<void>((_resolve, reject) => {
          rejectStale = () => reject(new Error('IndexedDB failed'));
        });
      }
      return Promise.resolve();
    });
    const onError = vi.fn();
    const auto = createAutosaver(save, 50, { onError });
    auto.schedule({ ...base(), body: 'stale' });
    await vi.advanceTimersByTimeAsync(50);
    expect(attempted).toEqual(['stale']);
    // The newer draft lands while the failing save is still unresolved.
    auto.schedule({ ...base(), body: 'fresh' });
    await vi.advanceTimersByTimeAsync(50);
    rejectStale!();
    await vi.advanceTimersByTimeAsync(200);
    // 'stale' must never be attempted again — the newer draft owns the slot, so
    // the last write to the store is 'fresh' and nothing is left queued.
    expect(attempted).toEqual(['stale', 'fresh']);
    expect(onError).toHaveBeenCalledTimes(1);
    await auto.flush();
    expect(attempted).toEqual(['stale', 'fresh']);
    vi.useRealTimers();
  });

  it('flush gives up after a failed save instead of retrying in a loop', async () => {
    // A retry inside flush would await the second (never-settling) save and hang.
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('IndexedDB failed'))
      .mockImplementation(() => new Promise<void>(() => {}));
    const onError = vi.fn();
    const auto = createAutosaver(save, 800, { onError });
    auto.schedule({ ...base(), body: 'doomed' });
    await auto.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
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
    resolveSavePromise!();
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
    resolveFirstSave!();
    await flushPromise;
    // With serialization, at most one save should be in flight at a time
    expect(maxConcurrent).toBe(1);
    vi.useRealTimers();
  });

  it('flush waits for a save the chain picked up while flush was waiting (Finding A)', async () => {
    vi.useFakeTimers();
    // Completion is recorded from the save promise itself, so the ordering is
    // observed, never decided by the order the test wires its callbacks up in.
    const order: string[] = [];
    const finish: Array<() => void> = [];
    let outstanding = 0;
    const save = vi.fn().mockImplementation((d: { body: string }) => {
      order.push(`save-start:${d.body}`);
      outstanding++;
      return new Promise<void>((resolve) => {
        finish.push(() => {
          outstanding--;
          order.push(`save-end:${d.body}`);
          resolve();
        });
      });
    });
    const auto = createAutosaver(save, 100);
    auto.schedule({ ...base(), body: 'A' });
    await vi.advanceTimersByTimeAsync(100);
    // A is in flight; nothing pending, no timer armed.
    expect(order).toEqual(['save-start:A']);

    let outstandingWhenFlushResolved = -1;
    const flushed = auto.flush().then(() => {
      outstandingWhenFlushResolved = outstanding;
      order.push('flush-resolved');
    });

    // B lands while flush is waiting and its debounce fires, extending the queue
    // behind the save flush is already waiting on.
    auto.schedule({ ...base(), body: 'B' });
    await vi.advanceTimersByTimeAsync(100);

    finish.shift()!(); // A settles, so the queue moves on to B
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toContain('save-start:B');
    expect(order).not.toContain('flush-resolved');

    finish.shift()!(); // B settles
    await flushed;
    expect(outstandingWhenFlushResolved).toBe(0);
    expect(order).toEqual([
      'save-start:A',
      'save-end:A',
      'save-start:B',
      'save-end:B',
      'flush-resolved',
    ]);
    vi.useRealTimers();
  });

  it('neither of two concurrent flushes returns while a draft is still queued (Finding A)', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const finish: Array<() => void> = [];
    const save = vi.fn().mockImplementation((d: { body: string }) => {
      order.push(`save-start:${d.body}`);
      return new Promise<void>((resolve) => {
        finish.push(() => {
          order.push(`save-end:${d.body}`);
          resolve();
        });
      });
    });
    const auto = createAutosaver(save, 100);
    auto.schedule({ ...base(), body: 'first' });
    await vi.advanceTimersByTimeAsync(100);
    expect(order).toEqual(['save-start:first']);

    const flush1 = auto.flush().then(() => order.push('flush1-resolved'));
    const flush2 = auto.flush().then(() => order.push('flush2-resolved'));

    // 'second' lands mid-flush; its debounce is still armed, so a flush that
    // returns here leaves the newest keystrokes unpersisted.
    auto.schedule({ ...base(), body: 'second' });

    finish.shift()!();
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toContain('save-start:second');
    expect(order).not.toContain('flush1-resolved');
    expect(order).not.toContain('flush2-resolved');

    finish.shift()!();
    await Promise.all([flush1, flush2]);
    expect(save.mock.calls.map((c) => c[0].body)).toEqual(['first', 'second']);
    expect(order.indexOf('flush1-resolved')).toBeGreaterThan(order.indexOf('save-end:second'));
    expect(order.indexOf('flush2-resolved')).toBeGreaterThan(order.indexOf('save-end:second'));
    vi.useRealTimers();
  });
});
