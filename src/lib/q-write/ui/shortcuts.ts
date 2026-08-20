// Pure keyboard-shortcut decision for the editor screen. Kept free of the
// DOM so it can run under vitest's default `node` environment — the page
// script owns dispatch (calling the same functions the toolbar/action
// buttons already call), this module only decides *what* a keydown means.

export type ShortcutAction = 'save' | 'bold' | 'link' | 'preview' | null;

export interface ShortcutLikeEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

// Cmd (mac) and Ctrl (win/linux) are treated as the same modifier so one
// table serves both platforms. Alt is never part of a defined combo, so any
// Alt-held chord falls through to null rather than partially matching.
export function matchShortcut(e: ShortcutLikeEvent): ShortcutAction {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod || e.altKey) return null;

  // Normalize case: Shift already has its own explicit branch below, so a
  // single-character key is compared case-insensitively (protects against
  // Caps Lock, and against browsers that report an uppercase `key` for a
  // Shift-held combo).
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (!e.shiftKey) {
    if (key === 's') return 'save';
    if (key === 'b') return 'bold';
    if (key === 'k') return 'link';
    return null;
  }

  if (key === 'p') return 'preview';
  return null;
}

// Whether a matched action should actually be dispatched. Kept separate
// from matchShortcut (and just as DOM-free) because this decision depends
// on *where the caret is*, not on the keydown itself: bold/link reach into
// the body textarea's selection, so firing them while some other field
// (title-input, in practice — slug/tags go through a blocking prompt()
// and are naturally immune) has focus would silently edit the body and
// yank focus away from what the user is actually typing into. Save syncs
// the title on every keystroke and preview is a plain view toggle, so
// neither needs the body to be focused.
export function shouldDispatch(action: ShortcutAction, bodyHasFocus: boolean): boolean {
  if (!action) return false;
  if (action === 'bold' || action === 'link') return bodyHasFocus;
  return true;
}
