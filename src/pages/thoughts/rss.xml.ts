import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { stableThoughtGuid } from '../../lib/thought-guid';

export async function GET(context: APIContext) {
  const thoughts = (await getCollection('thoughts'))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: 'luliu.me — thoughts',
    description: 'Lu Liu — short thoughts',
    site: context.site!,
    items: thoughts.map((t) => ({
      title: t.data.date.toISOString().slice(0, 16).replace('T', ' '),
      pubDate: t.data.date,
      description: t.body?.slice(0, 500) ?? '',
      // `link` stays a working URL to the thought (its id is only a page
      // anchor, not a permalink, and can change if the id computation
      // changes). The guid is derived from the thought's date instead — the
      // one part of a thought's identity that never changes — so it stays
      // stable across id changes. `customData` overrides the `link`-derived
      // `<guid isPermaLink="true">` that `@astrojs/rss` emits by default;
      // see dist/thoughts/rss.xml verification for confirmation there is
      // still exactly one <guid> per item.
      link: `/thoughts/#${t.id}`,
      categories: t.data.tags,
      customData: `<guid isPermaLink="false">${stableThoughtGuid(t.data.date)}</guid>`,
    })),
  });
}
