// Guard the invariant Task 16 exists to establish: every item in
// dist/thoughts/rss.xml carries exactly one stable, non-permalink guid.
//
// `@astrojs/rss` has no public per-item guid field — src/pages/thoughts/rss.xml.ts
// achieves a stable guid by passing `customData` containing a `<guid
// isPermaLink="false">...</guid>` tag, which relies on an *undocumented*
// implementation detail: the library first derives `item.guid` from `link`
// (isPermaLink="true"), then Object.assign()s the parsed customData over the
// same item object, overwriting that key. That ordering isn't a published
// contract. If a future @astrojs/rss upgrade changes it, the feed silently
// reverts to permalink guids keyed off the thought's `id` — which is exactly
// the "every subscriber's feed reappears as unread" failure this task exists
// to prevent — with a green build and no other check noticing (check-dead-assets
// doesn't look at <guid>, and nothing else inspects dist/thoughts/rss.xml).
//
// Fails if, in dist/thoughts/rss.xml:
//   - the number of <item> elements doesn't equal the number of <guid> elements
//     (exactly one guid per item),
//   - any <guid> lacks isPermaLink="false",
//   - any two <guid> values are identical,
//   - any <guid> value is empty.
//
// Exit 0 if clean, 1 if any violation is found, 2 if dist/thoughts/rss.xml is
// missing (run `pnpm build` first).

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FEED = resolve('dist/thoughts/rss.xml');

async function main() {
  if (!existsSync(FEED)) {
    console.error(`check-thoughts-guid: ${FEED} not found. Run \`pnpm build\` first.`);
    process.exit(2);
  }

  const xml = await readFile(FEED, 'utf-8');

  const itemCount = (xml.match(/<item>/g) ?? []).length;

  const guids: { raw: string; isPermaLinkFalse: boolean; value: string }[] = [];
  for (const m of xml.matchAll(/<guid([^>]*)>([^<]*)<\/guid>/g)) {
    const attrs = m[1];
    guids.push({
      raw: m[0],
      isPermaLinkFalse: /\bisPermaLink="false"/.test(attrs),
      value: m[2].trim(),
    });
  }

  const problems: string[] = [];

  if (itemCount !== guids.length) {
    problems.push(
      `item count (${itemCount}) does not equal guid count (${guids.length}) — expected exactly one <guid> per <item>.`,
    );
  }

  const notFalse = guids.filter((g) => !g.isPermaLinkFalse);
  if (notFalse.length > 0) {
    problems.push(`${notFalse.length} guid(s) missing isPermaLink="false":`);
    for (const g of notFalse) problems.push(`  ${g.raw}`);
  }

  const empty = guids.filter((g) => g.value.length === 0);
  if (empty.length > 0) {
    problems.push(`${empty.length} guid(s) are empty.`);
  }

  const seen = new Map<string, number>();
  for (const g of guids) seen.set(g.value, (seen.get(g.value) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, n]) => n > 1);
  if (dupes.length > 0) {
    problems.push(`${dupes.length} duplicate guid value(s):`);
    for (const [value, n] of dupes) problems.push(`  "${value}" appears ${n} times`);
  }

  if (problems.length === 0) {
    console.log(`check-thoughts-guid: ok (${itemCount} items, ${guids.length} unique stable guids)`);
    return;
  }

  console.error(`check-thoughts-guid: ${problems.length} problem(s) in dist/thoughts/rss.xml:`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  console.error(
    'Hint: every thoughts feed item must carry exactly one <guid isPermaLink="false"> derived ' +
      'from the thought\'s date (see src/lib/thought-guid.ts and src/pages/thoughts/rss.xml.ts).',
  );
  process.exit(1);
}

void main();
