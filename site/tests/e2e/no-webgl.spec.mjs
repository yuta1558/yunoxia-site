// Run in the "no-webgl" project (Chromium launched with WebGL disabled).
import { test, expect } from '@playwright/test';

test('without WebGL the top page keeps the static illustration and never loads the scene or the bead', async ({ page }) => {
  const errors = [];
  const chunks = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => {
    if (/\/(scene|bead)\.[^/]*\.js$/.test(r.url())) chunks.push(r.url());
  });
  await page.goto('/');
  await page.waitForTimeout(800);
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 600);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1500);
  expect(chunks).toEqual([]);
  await expect(page.locator('canvas.yx-bead')).toHaveCount(0);
  await expect(page.locator('.top-scene__fallback')).toBeVisible();
  await expect(page.locator('[data-top-scene]')).not.toHaveClass(/is-live/);
  expect(errors).toEqual([]);
});
