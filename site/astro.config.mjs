// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://yunoxia.one',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Japanese at the root, English under /en/; the sitemap emits hreflang alternates for pages that exist in both
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'ja',
        locales: { ja: 'ja-JP', en: 'en-US' },
      },
    }),
  ],
});
