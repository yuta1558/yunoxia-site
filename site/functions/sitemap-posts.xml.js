// GET /sitemap-posts.xml — published CMS posts (/log/p/<slug>/). The Markdown pages are in sitemap-index.xml.
// Without a D1 binding (or on a query error) it returns an empty, valid urlset.

import { SLUG_RE } from './_lib/posts.js';

const xml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  let rows = [];
  if (context.env.DB) {
    try {
      const { results } = await context.env.DB
        .prepare("SELECT slug, updated_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 1000")
        .all();
      rows = (results || []).filter((r) => SLUG_RE.test(r.slug));
    } catch {
      rows = [];
    }
  }

  const urls = rows
    .map((r) => {
      const lastmod = new Date(r.updated_at);
      return `<url><loc>${xml(`${origin}/log/p/${r.slug}/`)}</loc>` +
        (Number.isNaN(+lastmod) ? '' : `<lastmod>${lastmod.toISOString()}</lastmod>`) +
        '</url>';
    })
    .join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } },
  );
}
