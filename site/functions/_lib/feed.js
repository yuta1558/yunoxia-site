// Pure pieces of the Log pages and the RSS feed, kept apart from HTMLRewriter and D1 for tests.

import { excerpt } from '../../src/lib/excerpt.mjs';

const xml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// The written excerpt, else the first paragraph: the same text the static Log pages use.
export const postDescription = (post) => post.excerpt || excerpt(post.content);

// RSS <item>s for CMS posts. A row without a valid published_at is left out.
export function rssItems(posts, origin) {
  return posts
    .filter((p) => p.published_at != null && !Number.isNaN(+new Date(p.published_at)))
    .map((p) => {
      const link = `${origin}/log/p/${p.slug}/`;
      const description = postDescription(p);
      return `<item><title>${xml(p.title)}</title><link>${xml(link)}</link><guid isPermaLink="true">${xml(link)}</guid>` +
        `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` +
        (description ? `<description>${xml(description)}</description>` : '') +
        '</item>';
    })
    .join('');
}
