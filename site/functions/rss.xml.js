// GET /rss.xml — the static feed with published CMS posts added before the Markdown entries.

import { listPublished } from './_lib/posts.js';

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function onRequestGet(context) {
  const feed = await context.next();
  if (!context.env.DB || !feed.ok) return feed;

  let posts;
  try {
    posts = await listPublished(context.env.DB, 20);
  } catch {
    return feed;
  }
  if (!posts.length) return feed;

  const origin = new URL(context.request.url).origin;
  const items = posts
    .map((p) => {
      const link = `${origin}/log/p/${p.slug}/`;
      return `<item><title>${xml(p.title)}</title><link>${xml(link)}</link><guid isPermaLink="true">${xml(link)}</guid>` +
        `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` +
        (p.excerpt ? `<description>${xml(p.excerpt)}</description>` : '') +
        '</item>';
    })
    .join('');

  const text = await feed.text();
  const at = text.indexOf('<item>') >= 0 ? text.indexOf('<item>') : text.indexOf('</channel>');
  if (at < 0) return new Response(text, feed);

  const headers = new Headers(feed.headers);
  headers.delete('Content-Length');
  headers.delete('ETag');
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  return new Response(text.slice(0, at) + items + text.slice(at), { status: 200, headers });
}
