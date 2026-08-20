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

// marked passes raw HTML through untouched and does not sanitise, so anything
// pasted into a draft — or sitting in a repo post pulled down for editing —
// would execute on 预览, inside a page whose localStorage holds a
// `Contents: Write` PAT for the live site. Strip the executable surface
// before the markup ever reaches the document.
const BLOCKED_TAGS = new Set(['script', 'iframe', 'object', 'embed']);
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'data']);

function isDangerousUrl(value: string): boolean {
  // Browsers ignore leading control characters and whitespace inside a
  // scheme, so `java\tscript:alert(1)` still runs — strip them before the test.
  const v = value.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  return v.startsWith('javascript:') || v.startsWith('vbscript:') || v.startsWith('data:text/html');
}

function sanitize(root: ParentNode): void {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (BLOCKED_TAGS.has(el.localName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if (URL_ATTRS.has(name) && isDangerousUrl(attr.value)) el.removeAttribute(attr.name);
    }
  }
}

// Parses the rendered markdown in an inert document, strips what can execute,
// and adopts the survivors. Adopting the nodes rather than re-serialising them
// into innerHTML avoids the second parse that mutation-XSS payloads rely on.
export function setSanitizedHtml(container: HTMLElement, html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  sanitize(parsed.body);
  const doc = container.ownerDocument;
  container.replaceChildren(...Array.from(parsed.body.childNodes, (n) => doc.importNode(n, true)));
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
  setSanitizedHtml(container, marked.parse(md, { async: false }) as string);
}
