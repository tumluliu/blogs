import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The page is an .astro file whose behaviour lives in an inline <script> that
// vitest's `node` environment cannot execute. What it *ships* can still be
// asserted: the approved mock was meant to be replaced wholesale by the
// implementation, and a mock article left in the markup is not a styling
// detail — it ships two unrelated diagram PNGs into production and shows a
// fabricated "自动存于 12:07" before any save has happened.
const page = readFileSync(new URL('../../pages/q-write/index.astro', import.meta.url), 'utf-8');

describe('q-write page markup', () => {
  it('ships no mock article in the preview pane', () => {
    expect(page).not.toContain('/diagrams/');
    expect(page).toContain('<div class="preview" id="preview"></div>');
  });

  it('starts the editor with an empty body, title, slug and tag line', () => {
    expect(page).toContain('<textarea class="body" id="body" spellcheck="false"></textarea>');
    expect(page).not.toContain('从 Obsidian 到 q-write：长文也该在手机上写');
    expect(page).not.toContain('cong-obsidian-dao-q-write-chang-wen-ye-gai-zai-shou-ji');
    expect(page).toContain('<span class="v" id="slug-value"></span>');
    expect(page).toContain('<span class="tags" id="tags-value"></span>');
    expect(page).not.toContain('1,240 字');
  });

  it('never hardcodes a save timestamp into the editor status', () => {
    expect(page).not.toContain('自动存于 12:07');
    // the status line exists and starts empty; openDraft fills it in
    expect(page).toContain('<span class="status"></span>');
    expect(page).toContain('setStatus(...draftStatus(current));');
  });

  it('carries no leftover mock chrome in the stylesheet', () => {
    expect(page).not.toContain('#mockbar');
    // the 28px allowance existed only for the removed mock bar
    expect(page).not.toContain('calc(100dvh - 28px)');
  });

  it('confirms a rename before it deletes the old repo file', () => {
    expect(page).toContain('if (isRename && !confirm(rename.message))');
  });

  it('does not tell the user a slug change saves a copy', () => {
    expect(page).not.toContain('另存为新文件');
  });
});
