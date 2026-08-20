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
const BLOCKED_TAGS = new Set([
  // runs script outright
  'script',
  'iframe',
  'object',
  'embed',
  // SMIL. `<animate attributeName="href" values="javascript:...">` rewrites an
  // attribute of its parent *after* the sanitiser has vetted it, so auditing
  // attribute values alone can never catch this — Chrome and Safari run the
  // animation and the parent <a> becomes a javascript: link on click. These
  // four elements are the complete set that can retarget an attribute, so
  // denying the elements is both narrower and stricter than trying to
  // enumerate the attribute names they may point at.
  'animate',
  'animatemotion',
  'animatetransform',
  'set',
  // navigates or re-points the document the preview is living in
  'meta',
  'base',
  'form',
  // no script, but loads remote CSS and can restyle the surrounding app
  // (hide the real 发布 button, paint a fake one) — UI redress next to a PAT
  'link',
  'style',
]);
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'data']);

function isDangerousUrl(value: string): boolean {
  // Browsers ignore leading control characters and whitespace inside a
  // scheme, so `java\tscript:alert(1)` still runs — strip them before the test.
  const v = value.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  return v.startsWith('javascript:') || v.startsWith('vbscript:') || v.startsWith('data:text/html');
}

function sanitize(root: ParentNode): void {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    // localName, not tagName: an SVG `<animateTransform>` keeps its camel case
    // and lives in the SVG namespace, so match on the lowercased local name.
    const tag = el.localName.toLowerCase();
    if (BLOCKED_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if (URL_ATTRS.has(name) && isDangerousUrl(attr.value)) el.removeAttribute(attr.name);
    }
    // A <template>'s children hang off a separate document fragment that
    // querySelectorAll does not descend into, so a <script> parked there
    // survives the walk and rides along with importNode. Nothing clones the
    // fragment today, but the payload should not be sitting in the DOM at all.
    const content = (el as HTMLTemplateElement).content;
    if (tag === 'template' && content) sanitize(content);
  }
}

// Parses the rendered markdown in an inert document, strips what can execute,
// and adopts the survivors. Adopting the nodes rather than re-serialising them
// into innerHTML avoids the second parse that mutation-XSS payloads rely on.
export function setSanitizedHtml(container: HTMLElement, html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  // Walk the whole document, not just the body: the parser hoists a leading
  // <meta>/<base>/<link>/<style> into <head>, where only the fact that we
  // adopt body children keeps it out of the page. Position in the tree is the
  // parser's business, so the rule must not depend on it.
  sanitize(parsed);
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
