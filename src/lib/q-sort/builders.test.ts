import { describe, it, expect } from 'vitest';
import { buildFilename } from './builders.js';

describe('buildFilename', () => {
  it('formats a date as YYYY-MM-DD-HHmm.md in local time', () => {
    // 2026-05-07 09:07 local
    const d = new Date(2026, 4, 7, 9, 7, 33);
    expect(buildFilename(d)).toBe('2026-05-07-0907.md');
  });

  it('zero-pads single-digit month, day, hour, minute', () => {
    const d = new Date(2026, 0, 1, 0, 0, 0);
    expect(buildFilename(d)).toBe('2026-01-01-0000.md');
  });
});
