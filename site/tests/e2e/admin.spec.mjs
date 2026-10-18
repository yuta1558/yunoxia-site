// CMS admin UI: one <main> per view and the keyboard-operable write/preview tabs.
// The API is stubbed with page.route, so no login and no network beyond localhost.
import { test, expect } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function stubApi(page, { signedIn }) {
  await page.route('**/api/auth/verify', (route) => json(route, { ok: true }));
  await page.route('**/api/posts**', (route) =>
    json(route, { posts: [], pagination: { page: 1, hasNext: false } }),
  );
  await page.route('**/api/preview', (route) => json(route, { html: '<p>stub</p>' }));
  if (signedIn) {
    await page.addInitScript(() => sessionStorage.setItem('yunoxia_admin_token', 'stub'));
  }
}

function watchErrors(page) {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  return problems;
}

const visibleMains = (page) => page.locator('main:not([hidden])').filter({ visible: true });

test('admin: one main per view, and the tabs follow the keyboard pattern', async ({ page }) => {
  const problems = watchErrors(page);

  // Login view (no token)
  await stubApi(page, { signedIn: false });
  await page.goto('/admin/');
  await expect(page.locator('#login')).toBeVisible();
  await expect(visibleMains(page)).toHaveCount(1);
  await expect(page.locator('h1:visible')).toHaveCount(1);

  // Editor view (token present, stubbed API)
  await page.unrouteAll();
  await stubApi(page, { signedIn: true });
  await page.goto('/admin/');
  await page.locator('#new-post').click();
  await expect(page.locator('#view-editor')).toBeVisible();
  await expect(visibleMains(page)).toHaveCount(1);

  const write = page.locator('#tab-write');
  const preview = page.locator('#tab-preview');
  await expect(write).toHaveAttribute('aria-selected', 'true');
  await expect(write).toHaveAttribute('tabindex', '0');
  await expect(preview).toHaveAttribute('aria-selected', 'false');
  await expect(preview).toHaveAttribute('tabindex', '-1');

  const expectActive = async (active, other, pane) => {
    await expect(active).toHaveAttribute('aria-selected', 'true');
    await expect(active).toHaveAttribute('tabindex', '0');
    await expect(active).toBeFocused();
    await expect(other).toHaveAttribute('aria-selected', 'false');
    await expect(other).toHaveAttribute('tabindex', '-1');
    await expect(page.locator(pane)).toBeVisible();
  };

  await write.focus();
  await page.keyboard.press('ArrowRight');
  await expectActive(preview, write, '#pane-preview');
  await page.keyboard.press('ArrowRight'); // wraps
  await expectActive(write, preview, '#pane-write');
  await page.keyboard.press('End');
  await expectActive(preview, write, '#pane-preview');
  await page.keyboard.press('Home');
  await expectActive(write, preview, '#pane-write');
  await page.keyboard.press('ArrowLeft'); // wraps backwards
  await expectActive(preview, write, '#pane-preview');

  expect(problems).toEqual([]);
});
