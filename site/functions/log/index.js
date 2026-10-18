// GET /log/ — the static Log list with published CMS posts prepended.
// Assumes CMS posts are newer than the Markdown entries in src/content/log (the Markdown
// log is the archive from before the CMS). Falls back to the static page on any problem.

import { escapeHtml } from '../_lib/http.js';
import { listPublished } from '../_lib/posts.js';
import { formatDate, scopeAttrs, withHtmlHeaders } from '../_lib/shell.js';

export async function onRequestGet(context) {
  const page = await context.next();
  if (!context.env.DB || !page.ok || !(page.headers.get('Content-Type') || '').includes('text/html')) return page;

  let posts;
  try {
    // Every published post: /log/ has no pagination, and the static entries only cover the pre-CMS archive
    posts = await listPublished(context.env.DB, 10000);
  } catch {
    return page;
  }
  if (!posts.length) return page;

  const rewritten = new HTMLRewriter()
    .on('ol.logs', {
      element(el) {
        const scope = scopeAttrs(el);
        const items = posts
          .map((p) => `<li${scope}><time class="meta"${scope} datetime="${escapeHtml(p.published_at)}">${formatDate(p.published_at)}</time><a${scope} href="/log/p/${escapeHtml(p.slug)}/">${escapeHtml(p.title)}</a></li>`)
          .join('');
        el.prepend(items, { html: true });
      },
    })
    .transform(page);

  return new Response(rewritten.body, { status: 200, headers: withHtmlHeaders(page) });
}
