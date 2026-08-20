import { describe, it, expect } from 'vitest';
import { matchShortcut, shouldDispatch } from './shortcuts.js';

function key(
  k: string,
  mods: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {},
) {
  return {
    key: k,
    metaKey: !!mods.meta,
    ctrlKey: !!mods.ctrl,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
  };
}

describe('matchShortcut', () => {
  it('Cmd+S saves', () => {
    expect(matchShortcut(key('s', { meta: true }))).toBe('save');
  });

  it('Ctrl+S saves', () => {
    expect(matchShortcut(key('s', { ctrl: true }))).toBe('save');
  });

  it('Cmd+B bolds', () => {
    expect(matchShortcut(key('b', { meta: true }))).toBe('bold');
  });

  it('Ctrl+B bolds', () => {
    expect(matchShortcut(key('b', { ctrl: true }))).toBe('bold');
  });

  it('Cmd+K inserts a link', () => {
    expect(matchShortcut(key('k', { meta: true }))).toBe('link');
  });

  it('Ctrl+K inserts a link', () => {
    expect(matchShortcut(key('k', { ctrl: true }))).toBe('link');
  });

  it('Cmd+Shift+P toggles preview', () => {
    expect(matchShortcut(key('p', { meta: true, shift: true }))).toBe('preview');
  });

  it('Ctrl+Shift+P toggles preview', () => {
    expect(matchShortcut(key('p', { ctrl: true, shift: true }))).toBe('preview');
  });

  it('a bare "s" with no modifier is not a shortcut', () => {
    expect(matchShortcut(key('s'))).toBeNull();
  });

  it('a bare "b" with no modifier is not a shortcut', () => {
    expect(matchShortcut(key('b'))).toBeNull();
  });

  it('a bare "k" with no modifier is not a shortcut', () => {
    expect(matchShortcut(key('k'))).toBeNull();
  });

  it('a bare "p" with no modifier is not a shortcut', () => {
    expect(matchShortcut(key('p'))).toBeNull();
  });

  it('Cmd+P without Shift is not confused with Cmd+Shift+P (leaves browser print alone)', () => {
    expect(matchShortcut(key('p', { meta: true }))).toBeNull();
  });

  it('Cmd+Shift+S is not a shortcut (Shift changes the combo, not just a modifier add-on)', () => {
    expect(matchShortcut(key('s', { meta: true, shift: true }))).toBeNull();
  });

  it('Cmd+Alt+S is not a shortcut', () => {
    expect(matchShortcut(key('s', { meta: true, alt: true }))).toBeNull();
  });

  it('Cmd+E (an unmapped letter) is not a shortcut', () => {
    expect(matchShortcut(key('e', { meta: true }))).toBeNull();
  });

  it('matches the save combo regardless of key-casing (e.g. Caps Lock on)', () => {
    expect(matchShortcut(key('S', { meta: true }))).toBe('save');
  });
});

describe('shouldDispatch', () => {
  it('blocks bold when the body textarea is not focused (e.g. caret is in the title)', () => {
    expect(shouldDispatch('bold', false)).toBe(false);
  });

  it('allows bold when the body textarea is focused', () => {
    expect(shouldDispatch('bold', true)).toBe(true);
  });

  it('blocks link when the body textarea is not focused', () => {
    expect(shouldDispatch('link', false)).toBe(false);
  });

  it('allows link when the body textarea is focused', () => {
    expect(shouldDispatch('link', true)).toBe(true);
  });

  it('allows save regardless of focus (title syncs live)', () => {
    expect(shouldDispatch('save', false)).toBe(true);
  });

  it('allows preview regardless of focus (it is a plain view toggle)', () => {
    expect(shouldDispatch('preview', false)).toBe(true);
  });

  it('never dispatches a null action, even if focus says yes', () => {
    expect(shouldDispatch(null, true)).toBe(false);
  });
});
