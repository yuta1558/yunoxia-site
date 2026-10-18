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

test('unknown paths show the 404 page', async ({ page }) => {
  const res = await page.goto('/no-such-page/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('このページは見つかりませんでした。');
});

for (const path of ['/', '/works/', '/research/', '/about/']) {
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
