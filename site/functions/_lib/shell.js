// Helpers for serving CMS content inside the statically built Astro pages.
// The static page is fetched from the asset store and rewritten with HTMLRewriter, so CMS
// pages share the site's header, footer, fonts and hashed CSS without touching the build.

export function fetchAsset(context, path) {
  return context.env.ASSETS.fetch(new URL(path, context.request.url));
}

// Astro scopes component styles with a data-astro-cid-* attribute. Copy it from an existing
// element so injected markup picks up the same scoped styles.
export function scopeAttrs(element) {
  const attrs = [];
  for (const [name] of element.attributes) {
    if (name.startsWith('data-astro-cid-')) attrs.push(name);
  }
  return attrs.map((name) => ` ${name}`).join('');
}

export function formatDate(iso) {
  return (iso || '').slice(0, 10).replaceAll('-', '.');
}

export function withHtmlHeaders(response, extra = {}) {
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  // CMS-backed pages change without a deploy, so browsers must revalidate.
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.delete('ETag');
  headers.delete('Content-Length');
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return headers;
}
