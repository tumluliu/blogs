import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

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
      link: `/thoughts/#${t.id}`,
      categories: t.data.tags,
    })),
  });
}
