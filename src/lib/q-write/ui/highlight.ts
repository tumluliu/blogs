// Syntax highlighting for the 预览 pane.
//
// The published post is highlighted at build time by Astro's shiki
// integration with `theme: 'github-dark-dimmed', wrap: true` (astro.config.mjs).
// A preview that shows fenced code as grey monospace is not previewing what
// gets published, so this runs the same highlighter, with the same theme, and
// reproduces the same <pre> attributes Astro's transformer emits — see
// @astrojs/markdown-remark/dist/shiki.js, mirrored in `astroParity` below.
//
// Everything here is loaded on demand: nothing in this module's import graph is
// static, so opening the editor costs nothing and the first 预览 pulls the
// shiki core, the one theme, and only the grammars the draft actually uses.
// The JavaScript regex engine is deliberate — the oniguruma engine needs a
// 456 KB .wasm sidecar that would have to be shipped and cached for offline
// use, and `shiki/core` (unlike `shiki/core-unwasm`) never reaches for it.

const THEME = 'github-dark-dimmed';

// Astro's fallback when a fence names a language shiki doesn't have. Special
// langs need no grammar at all, so this can never itself fail to load.
const PLAIN = 'plaintext';

type ShikiCore = typeof import('shiki/core');
type Highlighter = Awaited<ReturnType<ShikiCore['createHighlighterCore']>>;
type Shiki = { core: ShikiCore; highlighter: Highlighter };

let shiki: Promise<Shiki> | null = null;

function loadShiki(): Promise<Shiki> {
  if (!shiki) {
    shiki = (async () => {
      const [core, engine, theme] = await Promise.all([
        import('shiki/core'),
        import('shiki/engine/javascript'),
        import('shiki/themes/github-dark-dimmed.mjs'),
      ]);
      const highlighter = await core.createHighlighterCore({
        themes: [theme.default],
        langs: [],
        // forgiving: a grammar pattern the JS engine can't translate is
        // skipped instead of throwing, which costs a little colour on one
        // rule rather than the whole block.
        engine: engine.createJavaScriptRegexEngine({ forgiving: true }),
      });
      return { core, highlighter };
    })();
    // Offline on the first 预览, or a chunk that 404s mid-deploy: don't let one
    // rejected import turn highlighting off for the rest of the session.
    shiki.catch(() => {
      shiki = null;
    });
  }
  return shiki;
}

const grammars = new Map<string, Promise<boolean>>();

// Resolves to the language to render with: the requested one when its grammar
// is available, `plaintext` when it isn't. An unknown language, a grammar
// chunk that fails to download — both land on plaintext, which is what the
// published page does too (Astro warns and falls back the same way).
function resolveLang({ core, highlighter }: Shiki, lang: string): Promise<string> {
  if (core.isSpecialLang(lang) || highlighter.getLoadedLanguages().includes(lang)) {
    return Promise.resolve(lang);
  }
  let pending = grammars.get(lang);
  if (!pending) {
    pending = (async () => {
      // The bundle index is a map of id/alias -> dynamic import, so the build
      // splits every grammar into its own chunk and this pulls exactly one.
      const { bundledLanguages } = await import('shiki/langs');
      const loader = (bundledLanguages as Record<string, unknown>)[lang];
      if (!loader) return false;
      await highlighter.loadLanguage(loader as Parameters<Highlighter['loadLanguage']>[0]);
      return true;
    })().catch(() => {
      // A failed download is worth retrying on the next 预览; a language that
      // simply doesn't exist resolves false and stays cached.
      grammars.delete(lang);
      return false;
    });
    grammars.set(lang, pending);
  }
  return pending.then((ok) => (ok ? lang : PLAIN));
}

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

// Byte-for-byte what @astrojs/markdown-remark's shiki transformer does to the
// <pre> under `wrap: true`, so the preview markup matches the published page.
function astroParity(lang: string) {
  return [
    {
      pre(node: HastNode) {
        const props = (node.properties ??= {});
        props.class = String(props.class ?? '').replace(/shiki/g, 'astro-code');
        props['data-language'] = lang;
        props.style =
          String(props.style ?? '') + '; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;';
      },
    },
  ];
}

const ALIAS: Record<string, string> = { className: 'class', dataLanguage: 'data-language' };

// Builds DOM straight from shiki's hast. The block's text never goes through
// an HTML parser on the way back in — no innerHTML, no second parse — so the
// escaping guarantee doesn't rest on shiki's serialiser. The attribute filter
// is belt-and-braces: shiki only ever sets class/style/tabindex here, and this
// must not become a way to smuggle back something the sanitiser removed.
function toDom(node: HastNode, doc: Document): Node {
  if (node.type === 'text') return doc.createTextNode(String(node.value ?? ''));
  const el = doc.createElement(node.tagName ?? 'span');
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    const name = (ALIAS[key] ?? key).toLowerCase();
    if (name.startsWith('on') || !/^[a-z][a-z0-9-]*$/.test(name)) continue;
    el.setAttribute(name, Array.isArray(value) ? value.join(' ') : String(value));
  }
  for (const child of node.children ?? []) el.appendChild(toDom(child, doc));
  return el;
}

const LANG_CLASS = /(?:^|\s)language-([^\s]+)/;

// Runs over already-sanitised markup: the code that reaches shiki is the
// block's textContent, never markup, and what comes back is shiki's own tree.
// Never rejects — a preview with plain code beats no preview.
export function highlightCodeBlocks(container: HTMLElement): Promise<void> {
  const blocks = Array.from(container.querySelectorAll('pre > code'))
    .filter((code) => code.parentElement?.childElementCount === 1)
    .map((code) => ({
      pre: code.parentElement as HTMLElement,
      // marked labels a fence `language-<info>`; an unlabelled fence has no
      // class and is plaintext on the published page as well.
      lang: LANG_CLASS.exec(code.className)?.[1] ?? PLAIN,
      // Astro trims the single trailing newline before highlighting.
      code: (code.textContent ?? '').replace(/(?:\r\n|\r|\n)$/, ''),
    }));
  if (blocks.length === 0) return Promise.resolve();

  return (async () => {
    let loaded: Shiki;
    try {
      loaded = await loadShiki();
    } catch {
      // No highlighter at all (offline before the chunks were cached, a
      // failed deploy): marked's <pre><code> is already in the document and
      // the preview's own CSS styles it as a code block.
      return;
    }

    const wanted = [...new Set(blocks.map((b) => b.lang))];
    const resolved = new Map<string, string>();
    await Promise.all(
      wanted.map(async (lang) => {
        resolved.set(lang, await resolveLang(loaded, lang).catch(() => PLAIN));
      }),
    );

    for (const block of blocks) {
      // The pane can be re-rendered while a grammar is in flight; a block
      // that is no longer in the document must not be resurrected.
      if (!container.contains(block.pre)) continue;
      const lang = resolved.get(block.lang) ?? PLAIN;
      try {
        const root = loaded.highlighter.codeToHast(block.code, {
          theme: THEME,
          lang,
          transformers: astroParity(lang) as never,
        }) as unknown as HastNode;
        const pre = root.children?.[0];
        if (!pre) continue;
        block.pre.replaceWith(toDom(pre, block.pre.ownerDocument));
      } catch {
        // Tokenising blew up on this one block; leave marked's version.
        continue;
      }
    }
  })();
}
