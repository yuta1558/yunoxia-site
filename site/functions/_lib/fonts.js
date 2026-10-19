// Full-coverage Zen Kaku Gothic New for CMS posts, whose characters the build never sees.
// The static /log/ shell carries the stylesheet's versioned path in <template data-cms-font>
// (src/pages/log/index.astro); the post Function swaps that marker for these links.

// Non-blocking: media=print loads the sheet without holding the first paint, onload switches it on.
export function fontLinks(href) {
  if (!href || !/^\/assets\/fonts\/zen-[0-9a-f]{10}\/full\.css$/.test(href)) return '';
  return `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${href}"></noscript>`;
}
