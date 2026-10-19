// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';

// lastmod for Works and Log entries: URL path → front matter `updated` (Works) or `date` (Log)
const lastmod = new Map();
for (const [dir, base, key] of [
  ['src/content/works', '/works/', 'updated'],
  ['src/content/en/works', '/en/works/', 'updated'],
  ['src/content/ko/works', '/ko/works/', 'updated'],
  ['src/content/log', '/log/', 'date'],
]) {
  for (const file of readdirSync(new URL(dir, import.meta.url)).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(new URL(`${dir}/${file}`, import.meta.url), 'utf8');
    const date = text.match(new RegExp(`^${key}:\\s*['"]?(\\d{4}-\\d{2}-\\d{2})`, 'm'))?.[1];
    if (date) lastmod.set(`${base}${file.replace(/\.md$/, '')}/`, date);
  }
}

const site = 'https://yunoxia.one';

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Japanese at the root, English under /en/, Korean under /ko/; the sitemap emits hreflang alternates for pages that exist in more than one
  integrations: [
    sitemap({
      // Design lab pages are for review only
      filter: (page) => !page.includes('/lab/'),
      // CMS posts are served by a Function; list them in the index so crawlers find them without robots.txt
      customSitemaps: [new URL('/sitemap-posts.xml', site).href],
      i18n: {
        defaultLocale: 'ja',
        // Same codes as <html lang> and the hreflang links in Base.astro
        locales: { ja: 'ja', en: 'en', ko: 'ko' },
      },
      serialize(item) {
        const date = lastmod.get(new URL(item.url).pathname);
        return date ? { ...item, lastmod: date } : item;
      },
    }),
  ],
});
