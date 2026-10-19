// Breadcrumb (design system v4): mono labels split by "/", the last item is the current page.
// Shared by the Astro pages and the CMS post Function, so it returns an HTML string.

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @param {{ label: string, href?: string, hreflang?: string }[]} items  ancestors first; the last one is the current page
 * @param {string} label  accessible name of the nav
 */
export function breadcrumbMarkup(items, label = 'パンくず') {
  const sep = '<span aria-hidden="true">/</span>';
  const parts = items.map((item, i) =>
    i === items.length - 1
      ? `<span aria-current="page">${escape(item.label)}</span>`
      : `<a href="${escape(item.href)}"${item.hreflang ? ` hreflang="${escape(item.hreflang)}"` : ''}>${escape(item.label)}</a>`,
  );
  return `<nav class="breadcrumb" aria-label="${escape(label)}">${parts.join(sep)}</nav>`;
}
