import { describe, it, expect } from 'vitest';
import { filterEntries } from './list.js';

describe('filterEntries', () => {
  const names = ['kong-jian-ji-yi.md', 'kong-jian-shu-ju.md', 'attention-x-ready-action.md'];

  it('returns everything for an empty query', () => {
    expect(filterEntries(names, '')).toEqual(names);
  });

  it('is a case-insensitive substring match', () => {
    expect(filterEntries(names, 'KONG-JIAN')).toEqual(['kong-jian-ji-yi.md', 'kong-jian-shu-ju.md']);
  });

  it('matches on any segment, not just the prefix', () => {
    expect(filterEntries(names, 'ready')).toEqual(['attention-x-ready-action.md']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterEntries(names, 'zzz')).toEqual([]);
  });
});
