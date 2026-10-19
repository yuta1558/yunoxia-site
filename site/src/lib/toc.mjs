// Article contents (the design system's Toc): the h2s of a post body, numbered 01, 02 …
// The numbers match the ones CSS puts before each h2 (.article-body h2::before).

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Give every top-level <h2> of rendered HTML an id (s1, s2 …) and list them.
 * The input is the CMS renderer's own output, so heading text is already escaped HTML.
 * @returns {{ html: string, toc: { id: string, html: string }[] }}
 */
export function numberHeadings(html) {
  const toc = [];
  const out = String(html).replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => {
    const id = `s${toc.length + 1}`;
    toc.push({ id, html: inner.replace(/<[^>]*>/g, '') });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}

/** Plain-text headings (Astro's render().headings) in the same shape */
export const tocFromText = (headings) => headings.map((h) => ({ id: h.slug, html: escape(h.text) }));

/** The Toc block, or '' when there are fewer than two sections */
export function tocMarkup(toc, label = '目次') {
  if (toc.length < 2) return '';
  const rows = toc
    .map((h, i) => `<a href="#${escape(h.id)}"><span>${String(i + 1).padStart(2, '0')}</span>${h.html}</a>`)
    .join('');
  return `<aside class="toc"><p class="meta">Contents</p><nav aria-label="${escape(label)}" data-toc>${rows}</nav></aside>`;
}
