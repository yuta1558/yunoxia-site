import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const logs = (await getCollection('log')).sort((a, b) => +b.data.date - +a.data.date);
  return rss({
    title: 'yunoxia Log',
    description: '分解して、理解して、作り替える。制作と研究の進み具合の記録。',
    site: context.site,
    items: logs.map((l) => ({
      title: l.data.title,
      pubDate: l.data.date,
      link: `/log/${l.id}/`,
    })),
    customData: '<language>ja</language>',
  });
}
