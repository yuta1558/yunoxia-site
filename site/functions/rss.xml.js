// GET /rss.xml — the static feed with published CMS posts added before the Markdown entries.

import { rssItems } from './_lib/feed.js';
import { listPublished } from './_lib/posts.js';

export async function onRequestGet(context) {
  const feed = await context.next();
  if (!context.env.DB || !feed.ok) return feed;

  let posts;
  try {
    posts = await listPublished(context.env.DB, 20, { withContent: true });
  } catch {
    return feed;
  }
  if (!posts.length) return feed;

  const origin = new URL(context.request.url).origin;
  const items = rssItems(posts, origin);
  if (!items) return feed;

  const text = await feed.text();
  const at = text.indexOf('<item>') >= 0 ? text.indexOf('<item>') : text.indexOf('</channel>');
  if (at < 0) return new Response(text, feed);

  const headers = new Headers(feed.headers);
  headers.delete('Content-Length');
  headers.delete('ETag');
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  return new Response(text.slice(0, at) + items + text.slice(at), { status: 200, headers });
}
