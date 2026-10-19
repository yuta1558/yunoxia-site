// Structure, privacy, fallbacks and progressive loading of the built site (dist/).
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { FORBIDDEN } from '../../scripts/forbidden.mjs';

// Every page listed in the built sitemap(s)
const routes = readdirSync('dist')
  .filter((f) => /^sitemap-\d+\.xml$/.test(f))
  .flatMap((f) => [...readFileSync(`dist/${f}`, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname));

test('sitemap lists the expected sections', () => {
  for (const path of ['/', '/works/', '/research/', '/log/', '/about/']) expect(routes).toContain(path);
});

for (const path of routes) {
  test(`page ${path}: loads cleanly with title, one h1 and lang`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/yunoxia/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', path.startsWith('/en/') ? 'en' : 'ja');
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });
}

test('no page contains the owner’s real name, employer or location', async ({ request }) => {
  for (const path of [...routes, '/rss.xml', '/updates.json']) {
    const body = await (await request.get(path)).text();
    for (const word of FORBIDDEN) expect(body.includes(word), `${path} must not contain a forbidden string`).toBe(false);
  }
});

// Local targets of public/_redirects must be served (astro preview does not apply the redirects themselves)
test('redirect targets exist', async ({ request }) => {
  const targets = readFileSync('public/_redirects', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/)[1])
    .filter((t) => t.startsWith('/'));
  expect(targets.length).toBeGreaterThan(0);
  for (const t of new Set(targets)) expect((await request.get(t)).status(), t).toBe(200);
});

test('sitemap-index.xml references the CMS posts sitemap', () => {
  expect(readFileSync('dist/sitemap-index.xml', 'utf8')).toContain('<loc>https://yunoxia.one/sitemap-posts.xml</loc>');
});

test('footer links are at least 24px tall at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const links = page.locator('.site-footer a');
  expect(await links.count()).toBeGreaterThan(0);
  for (const box of await links.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(24);
  }
});

test('unknown paths show the 404 page', async ({ page }) => {
  const res = await page.goto('/no-such-page/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('この層は、まだ積まれていない。');
});

test('/en/ unknown paths show the 404 page', async ({ page }) => {
  const res = await page.goto('/en/no-such-page/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveCount(1);
});

// Head metadata of every sitemap page. Canonical and hreflang URLs carry the production origin, so paths are compared.
const pathOf = (href) => new URL(href).pathname;
const alternatesCache = new Map();
async function alternatesOf(request, path) {
  if (!alternatesCache.has(path)) {
    const html = await (await request.get(path)).text();
    const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((l) => /rel="alternate"/.test(l) && /hreflang=/.test(l));
    alternatesCache.set(path, Object.fromEntries(links.map((l) => [l.match(/hreflang="([^"]+)"/)[1], pathOf(l.match(/href="([^"]+)"/)[1])])));
  }
  return alternatesCache.get(path);
}

for (const path of routes) {
  test(`head metadata: ${path}`, async ({ page, request }) => {
    await page.goto(path);
    const canon = await page.locator('link[rel="canonical"]').evaluateAll((els) => els.map((e) => e.href));
    expect(canon).toHaveLength(1);
    expect(pathOf(canon[0])).toBe(path);

    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toMatch(/^https?:\/\//);

    for (const json of await page.locator('script[type="application/ld+json"]').allTextContents()) {
      expect(() => JSON.parse(json)).not.toThrow();
    }

    const alts = await alternatesOf(request, path);
    if (path.startsWith('/log/')) {
      expect(alts).toEqual({});
    } else if (Object.keys(alts).length) {
      expect(alts['x-default']).toBeTruthy();
      for (const lang of ['ja', 'en']) {
        const target = alts[lang];
        expect(target, `${lang} alternate`).toBeTruthy();
        // Reciprocal: the page we point at points back with the same pair
        expect((await alternatesOf(request, target))[path.startsWith('/en/') ? 'en' : 'ja'], `${target} lists ${path}`).toBe(path);
      }
    }
  });
}

for (const path of routes) {
  test(`no horizontal overflow at 390px: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('top page keeps the static illustration and never loads the scene or the bead', async ({ page }) => {
    const chunks = [];
    page.on('request', (r) => {
      if (/\/(scene|bead)\.[^/]*\.js$/.test(r.url())) chunks.push(r.url());
    });
    await page.goto('/');
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(1500);
    expect(chunks).toEqual([]);
    await expect(page.locator('.top-scene__fallback')).toBeVisible();
    await expect(page.locator('canvas.yx-bead')).toHaveCount(0);
  });
});

test('first engagement loads the scene and replaces the illustration', async ({ page }) => {
  const scene = page.waitForRequest(/\/scene\.[^/]*\.js$/);
  await page.goto('/');
  await page.waitForTimeout(800);
  await expect(page.locator('[data-top-scene]')).not.toHaveClass(/is-live/);
  await page.mouse.wheel(0, 400);
  await scene;
  await expect(page.locator('[data-top-scene]')).toHaveClass(/is-live/, { timeout: 15_000 });
});

test('items updated since the last visit are marked', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('yx-test-seeded')) {
      localStorage.setItem('yx:lastVisit', '2000-01-01T00:00:00.000Z');
      sessionStorage.setItem('yx-test-seeded', '1');
    }
  });
  await page.goto('/works/');
  await expect(page.locator('a[data-updated="true"]').first()).toBeVisible({ timeout: 10_000 });
});

test('the bead follows the pointer, also after the page was hidden and shown again', async ({ page }) => {
  await page.goto('/about/');
  await page.waitForSelector('canvas.yx-bead', { timeout: 10_000 });
  const transform = () => page.$eval('canvas.yx-bead', (c) => c.style.transform);
  const sweep = async (x0) => {
    for (let i = 0; i < 15; i++) {
      await page.mouse.move(x0 + i * 12, 400);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(400);
  };
  await sweep(200);
  const before = await transform();
  expect(before).toMatch(/^translate3d\(/);

  // A window switch makes Chrome report the page hidden, then visible again
  for (const hidden of [true, false]) {
    await page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    await page.waitForTimeout(100);
  }
  await sweep(700);
  const after = await transform();
  expect(after).toMatch(/^translate3d\(/);
  expect(after).not.toContain('NaN');
  expect(after).not.toBe(before);
});

test('dark theme changes the paper and keeps body text readable', async ({ page }) => {
  const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
  const lum = (c) => {
    const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // The theme script in Base.astro reads localStorage 'theme' and sets html[data-theme]
  const read = async (theme) => {
    await page.goto('/about/');
    await page.evaluate((t) => localStorage.setItem('theme', t), theme);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const cs = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, fg: getComputedStyle(document.body).color }));
    const [bg, fg] = [rgb(cs.bg), rgb(cs.fg)];
    const [hi, lo] = [lum(bg), lum(fg)].sort((x, y) => y - x);
    return { bg, ratio: (hi + 0.05) / (lo + 0.05) };
  };
  const light = await read('light');
  const dark = await read('dark');
  expect(dark.bg).not.toEqual(light.bg);
  expect(dark.ratio).toBeGreaterThanOrEqual(4.5);
  expect(light.ratio).toBeGreaterThanOrEqual(4.5);
});

test('rss.xml is a valid feed and updates.json holds ISO dates', async ({ request }) => {
  const xml = await (await request.get('/rss.xml')).text();
  expect(xml).toContain('<channel>');
  expect(xml).toMatch(/<atom:link [^>]*rel="self"/);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    expect(item).toMatch(/<link>https?:\/\/[^<]+<\/link>/);
    const pub = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
    expect(Number.isNaN(Date.parse(pub))).toBe(false);
  }

  const updates = await (await request.get('/updates.json')).json();
  expect(Object.keys(updates).length).toBeGreaterThan(0);
  for (const [path, value] of Object.entries(updates)) {
    expect(path).toMatch(/^\//);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  }
});

test('full Zen Kaku Gothic New stylesheet for CMS posts: every url() is a copied woff2', async ({ request }) => {
  // The /log/ shell names it for the post Function (functions/log/p/[slug].js)
  const shell = await (await request.get('/log/')).text();
  const href = /<template data-cms-font="([^"]+)"/.exec(shell)?.[1];
  expect(href).toMatch(/^\/assets\/fonts\/zen-[0-9a-f]{10}\/full\.css$/);
  const res = await request.get(href);
  expect(res.ok()).toBe(true);
  const css = await res.text();
  for (const w of [300, 400, 500]) expect(css).toContain(`font-weight: ${w}`);
  const urls = [...css.matchAll(/url\(\.\/(files\/[^)]+)\)/g)].map((m) => m[1]);
  expect(urls.length).toBeGreaterThan(100);
  expect(css).not.toMatch(/\.woff\)/);
  const base = href.replace(/full\.css$/, '');
  for (const u of new Set(urls)) expect((await request.head(base + u)).ok(), u).toBe(true);
});

test('footer theme switch: PAPER / BLUEPRINT are stored, AUTO clears the choice', async ({ page }) => {
  await page.goto('/about/');
  const group = page.locator('[data-theme-switch]');
  await group.getByRole('button', { name: 'BLUEPRINT' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(group.getByRole('button', { name: 'BLUEPRINT' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await group.getByRole('button', { name: 'PAPER' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await group.getByRole('button', { name: 'AUTO' }).click();
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
  await expect(group.getByRole('button', { name: 'AUTO' })).toHaveAttribute('aria-pressed', 'true');
});

test('blocks below the first screen stack in once they are scrolled to', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/works/hevort-lite/');
  const cards = page.locator('.cards > li');
  await expect(cards.first()).toHaveAttribute('data-reveal', 'pending');
  await cards.first().scrollIntoViewIfNeeded();
  await expect(cards.first()).toHaveAttribute('data-reveal', 'in');
  await expect.poll(() => cards.first().evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  // The spec numeral counts up and ends on its written value
  await page.locator('.specs').scrollIntoViewIfNeeded();
  await expect(page.locator('.specs .num').first()).toHaveText('180');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('nothing is hidden for the reveal', async ({ page }) => {
    await page.goto('/works/hevort-lite/');
    await page.waitForLoadState('load');
    expect(await page.locator('[data-reveal]').count()).toBe(0);
  });
});

test('lab components: tabs follow the arrow keys, media loads only when pressed', async ({ page }) => {
  await page.goto('/lab/components/');
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: '設定値' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: '概要' })).toBeHidden();
  await page.keyboard.press('End');
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');

  await expect(page.locator('.media iframe')).toHaveCount(0);
  await page.getByRole('button', { name: '押して読み込む' }).click();
  const frame = page.locator('.media iframe');
  await expect(frame).toHaveAttribute('title', 'デザイン案 D');
  await expect(frame).toHaveAttribute('src', '/lab/d/');
});
