import { marked } from 'marked';

export function insertAtCursor(el: HTMLTextAreaElement, text: string): void {
  const { selectionStart: s, selectionEnd: e, value } = el;
  el.value = value.slice(0, s) + text + value.slice(e);
  const caret = s + text.length;
  el.selectionStart = el.selectionEnd = caret;
}

export function wrapSelection(el: HTMLTextAreaElement, before: string, after: string): void {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const selected = value.slice(s, e);
  el.value = value.slice(0, s) + before + selected + after + value.slice(e);
  if (selected) {
    el.selectionStart = s + before.length;
    el.selectionEnd = s + before.length + selected.length;
  } else {
    el.selectionStart = el.selectionEnd = s + before.length;
  }
}

export function prefixLine(el: HTMLTextAreaElement, prefix: string): void {
  const { selectionStart: s, value } = el;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  const lineEnd = value.indexOf('\n', s);
  const line = value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  if (line.startsWith(prefix)) return;
  el.value = value.slice(0, lineStart) + prefix + value.slice(lineStart);
  el.selectionStart = el.selectionEnd = s + prefix.length;
}

// Freshly uploaded images are not deployed yet, so /media/... 404s. Swap in
// the in-memory blob URL for anything still local.
export function renderPreview(
  container: HTMLElement,
  markdown: string,
  blobMap: Map<string, string>,
): void {
  let md = markdown;
  for (const [path, blobUrl] of blobMap) {
    md = md.split(path).join(blobUrl);
  }
  md = md.replace(/!\[([^\]]*)\]\(uploading:[^)]*\)/g, '_[图片上传中…]_');
  container.innerHTML = marked.parse(md, { async: false }) as string;
}
