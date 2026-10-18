// GET /log/p/<slug> — a published CMS post, rendered inside the static /log/ page's shell.

import { postDescription } from '../../_lib/feed.js';
import { escapeHtml } from '../../_lib/http.js';
import { renderMarkdown } from '../../_lib/markdown.js';
import { sizeFromKey } from '../../_lib/imagesize.js';
import { getPublishedBySlug } from '../../_lib/posts.js';
import { fontLinks } from '../../_lib/fonts.js';
import { fetchAsset, formatDate, withHtmlHeaders } from '../../_lib/shell.js';
import { withFullStop } from '../../../src/lib/headline.mjs';
import { blogPosting, jsonLdString } from '../../../src/lib/jsonld.mjs';

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
  const description = postDescription(post) || post.title;
  const tags = post.tags.length ? ` · ${post.tags.map(escapeHtml).join(' / ')}` : '';
  const size = post.featured_image ? sizeFromKey(post.featured_image) : null;
  const dims = size ? ` width="${size.width}" height="${size.height}"` : '';
  const image = post.featured_image
    ? `<p><img src="${escapeHtml(post.featured_image)}" alt=""${dims} loading="lazy" decoding="async"></p>`
    : '';
  // Same page head as the static reading pages: label, light title, mono meta, prose (global.css)
  const article = `
    <article class="wrap page">
      <p class="eyebrow"><a href="/log/">Log</a></p>
      <h1 class="page-title">${escapeHtml(withFullStop(post.title, 'ja'))}</h1>
      <p class="meta"><time datetime="${escapeHtml(post.published_at || '')}">${formatDate(post.published_at)}</time>${tags}</p>
      <div class="prose">${image}${renderMarkdown(post.content)}</div>
    </article>`;

  const ogImage = post.featured_image ? new URL(post.featured_image, context.request.url).href : undefined;
  const structured = jsonLdString(
    blogPosting({
      title: post.title,
      date: post.published_at,
      modified: post.updated_at,
      image: ogImage,
      url: canonical,
      description: postDescription(post),
    }),
  );

  const setAttr = (attr, value) => ({ element: (el) => el.setAttribute(attr, value) });

  const rewritten = new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', setAttr('content', description))
    .on('meta[property="og:title"]', setAttr('content', title))
    .on('meta[property="og:description"]', setAttr('content', description))
    .on('meta[property="og:url"]', setAttr('content', canonical))
    .on('meta[property="og:type"]', setAttr('content', 'article'))
    .on('link[rel="canonical"]', setAttr('href', canonical))
    .on('meta[property="og:image"]', ogImage ? setAttr('content', ogImage) : {})
    // The shell's width/height describe its own image: use the featured image's size, or drop them
    .on('meta[property="og:image:width"]', post.featured_image ? (size ? setAttr('content', String(size.width)) : { element: (el) => el.remove() }) : {})
    .on('meta[property="og:image:height"]', post.featured_image ? (size ? setAttr('content', String(size.height)) : { element: (el) => el.remove() }) : {})
    // The Log shell has no hreflang alternates for posts; drop any it carries
    .on('link[rel="alternate"][hreflang]', { element: (el) => el.remove() })
    .on('head', { element: (el) => el.append(`<script type="application/ld+json">${structured}</script>`, { html: true }) })
    // The shell's font marker becomes the full-coverage stylesheet (CMS text is not in the subset)
    .on('template[data-cms-font]', { element: (el) => el.replace(fontLinks(el.getAttribute('data-cms-font')), { html: true }) })
    .on('main', { element: (el) => el.setInnerContent(article, { html: true }) })
    .transform(shell);

  return new Response(rewritten.body, { status: 200, headers: withHtmlHeaders(shell) });
}
