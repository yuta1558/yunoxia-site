import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { excerpt } from '../lib/excerpt.mjs';

export async function GET(context) {
  const logs = (await getCollection('log')).sort((a, b) => +b.data.date - +a.data.date);
  return rss({
    title: 'yunoxia Log',
    description: '分解して、理解して、作り替える。制作と研究の進み具合の記録。',
    // The channel links to the Log; item links are absolute paths, so they resolve the same
    site: new URL('/log/', context.site).href,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items: logs.map((l) => ({
      title: l.data.title,
      pubDate: l.data.date,
      link: `/log/${l.id}/`,
      description: excerpt(l.body) || undefined,
    })),
    customData: `<language>ja</language><atom:link href="${new URL('/rss.xml', context.site).href}" rel="self" type="application/rss+xml"/>`,
  });
}
