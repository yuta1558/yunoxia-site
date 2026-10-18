// GET /log/p/<slug> — a published CMS post, rendered inside the static /log/ page's shell.

import { escapeHtml } from '../../_lib/http.js';
import { renderMarkdown } from '../../_lib/markdown.js';
import { getPublishedBySlug } from '../../_lib/posts.js';
import { fetchAsset, formatDate, withHtmlHeaders } from '../../_lib/shell.js';

async function notFound(context) {
  const page = await fetchAsset(context, '/404.html');
  return new Response(page.body, { status: 404, headers: withHtmlHeaders(page) });
}

export async function onRequestGet(context) {
  const { env, params } = context;
  if (!env.DB) return notFound(context);

  let post;
  try {
    post = await getPublishedBySlug(env.DB, String(params.slug));
  } catch {
    post = null;
  }
  if (!post) return notFound(context);

  const shell = await fetchAsset(context, '/log/');
  if (!shell.ok) return notFound(context);

  const canonical = new URL(`/log/p/${post.slug}/`, context.request.url).href;
  const title = `${post.title} — yunoxia`;
  const description = post.excerpt || post.title;
  const tags = post.tags.length ? ` · ${post.tags.map(escapeHtml).join(' / ')}` : '';
  const image = post.featured_image
    ? `<p><img src="${escapeHtml(post.featured_image)}" alt="" loading="lazy" decoding="async" style="max-width:100%;height:auto"></p>`
    : '';

  const article = `
    <article class="wrap" style="padding-block:3rem">
      <p class="eyebrow"><a href="/log/" style="text-decoration:none">Log</a></p>
      <h1 style="font-size:var(--step-2);margin-block:0.5rem 0.75rem">${escapeHtml(post.title)}</h1>
      <p class="meta"><time datetime="${escapeHtml(post.published_at || '')}">${formatDate(post.published_at)}</time>${tags}</p>
      <div class="prose" style="margin-top:2rem">${image}${renderMarkdown(post.content)}</div>
    </article>`;

  const setAttr = (attr, value) => ({ element: (el) => el.setAttribute(attr, value) });

  const rewritten = new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', setAttr('content', description))
    .on('meta[property="og:title"]', setAttr('content', title))
    .on('meta[property="og:description"]', setAttr('content', description))
    .on('meta[property="og:url"]', setAttr('content', canonical))
    .on('meta[property="og:type"]', setAttr('content', 'article'))
    .on('link[rel="canonical"]', setAttr('href', canonical))
    .on('main', { element: (el) => el.setInnerContent(article, { html: true }) })
    .transform(shell);

  return new Response(rewritten.body, { status: 200, headers: withHtmlHeaders(shell) });
}
