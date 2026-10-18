// Puts published CMS posts into the statically built Log lists (/log/ and the top pages).
// Both lists use the same row markup: <li><a href><time class="meta">…</time><span>title</span></a></li>.

import { escapeHtml } from './http.js';
import { listPublished } from './posts.js';
import { formatDate, scopeAttrs, withHtmlHeaders } from './shell.js';

const row = (p, scope, hreflang) =>
  `<li${scope}><a${scope} href="/log/p/${escapeHtml(p.slug)}/"${hreflang ? ` hreflang="${hreflang}"` : ''}>` +
  `<time class="meta"${scope} datetime="${escapeHtml(p.published_at)}">${formatDate(p.published_at)}</time>` +
  `<span${scope} lang="ja">${escapeHtml(p.title)}</span></a></li>`;

/**
 * Prepends CMS posts to `selector` on the page served by context.next().
 * With `max`, the list is cut back to that many rows (the top page shows the newest few).
 * Any problem (no DB, query error, non-HTML) serves the static page unchanged.
 */
export async function withCmsPosts(context, { selector, max, hreflang } = {}) {
  const page = await context.next();
  if (!context.env.DB || !page.ok || !(page.headers.get('Content-Type') || '').includes('text/html')) return page;

  let posts;
  try {
    // /log/ has no pagination, so it takes every published post; the top page only needs `max`
    posts = await listPublished(context.env.DB, max ?? 10000);
  } catch {
    return page;
  }
  if (!posts.length) return page;

  let kept = posts.length;
  const rewriter = new HTMLRewriter().on(selector, {
    element(el) {
      const scope = scopeAttrs(el);
      el.prepend(posts.map((p) => row(p, scope, hreflang)).join(''), { html: true });
    },
  });
  if (max) {
    // Static rows after the CMS posts: drop the ones that no longer fit
    rewriter.on(`${selector} > li`, {
      element(el) {
        if (++kept > max) el.remove();
      },
    });
  }
  return new Response(rewriter.transform(page).body, { status: 200, headers: withHtmlHeaders(page) });
}
