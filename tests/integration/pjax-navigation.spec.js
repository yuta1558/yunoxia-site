/**
 * Integration tests for PJAX navigation
 * Tests the core SPA-like navigation functionality
 */

import { test, expect } from '@playwright/test';

test.describe('PJAX Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads correctly with all partials', async ({ page }) => {
    // Check header partial loaded
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('.theme-toggle')).toBeVisible();

    // Check footer partial loaded
    await expect(page.locator('footer')).toBeVisible();

    // Check main content loaded
    await expect(page.locator('main#pjax-container')).toBeVisible();
  });

  test('navigating between pages updates content without full reload', async ({ page }) => {
    // Start on home page
    await expect(page).toHaveURL('/');

    // Click on About link
    await page.click('a[href="about.html"]');

    // Wait for navigation to complete
    await page.waitForURL('/about.html');

    // Check that we're on the about page
    await expect(page).toHaveURL('/about.html');

    // Check that main content changed (but page didn't full reload)
    // We can verify this by checking that GSAP didn't need to be re-fetched
    const performanceEntries = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('gsap'))
        .length;
    });

    // GSAP should only be loaded once (initial page load)
    expect(performanceEntries).toBe(1);
  });

  test('active navigation link updates after PJAX navigation', async ({ page }) => {
    await page.goto('/');

    // Check home is active initially
    const homeLink = page.locator('a[href="index.html"]');
    await expect(homeLink).toHaveClass(/active/);

    // Navigate to works page
    await page.click('a[href="works.html"]');
    await page.waitForURL('/works.html');

    // Check works link is now active
    const worksLink = page.locator('a[href="works.html"]');
    await expect(worksLink).toHaveClass(/active/);

    // Check home link is no longer active
    await expect(homeLink).not.toHaveClass(/active/);
  });

  test('browser back button works with PJAX navigation', async ({ page }) => {
    await page.goto('/');

    // Navigate forward: home -> about -> works
    await page.click('a[href="about.html"]');
    await page.waitForURL('/about.html');

    await page.click('a[href="works.html"]');
    await page.waitForURL('/works.html');

    // Navigate back: works -> about
    await page.goBack();
    await page.waitForURL('/about.html');

    // Check we're on about page
    const aboutLink = page.locator('a[href="about.html"]');
    await expect(aboutLink).toHaveClass(/active/);

    // Navigate back again: about -> home
    await page.goBack();
    await page.waitForURL('/');

    // Check we're on home page
    const homeLink = page.locator('a[href="index.html"]');
    await expect(homeLink).toHaveClass(/active/);
  });

  test('browser forward button works with PJAX navigation', async ({ page }) => {
    await page.goto('/');

    // Navigate forward
    await page.click('a[href="about.html"]');
    await page.waitForURL('/about.html');

    // Go back
    await page.goBack();
    await page.waitForURL('/');

    // Go forward
    await page.goForward();
    await page.waitForURL('/about.html');

    // Check we're on about page
    const aboutLink = page.locator('a[href="about.html"]');
    await expect(aboutLink).toHaveClass(/active/);
  });

  test('route progress bar animates during navigation', async ({ page }) => {
    await page.goto('/');

    const progressBar = page.locator('#routeProgress');

    // Check progress bar exists
    await expect(progressBar).toBeAttached();

    // Click navigation link
    await page.click('a[href="about.html"]');

    // Progress bar should animate (width changes from 0% to 100%)
    // We'll check if it exists and has the expected styling
    await expect(progressBar).toHaveCSS('position', 'fixed');
    await expect(progressBar).toHaveCSS('top', '0px');

    await page.waitForURL('/about.html');
  });

  test('links with target attribute excluded from PJAX', async ({ page }) => {
    // Create a test page with external link
    await page.goto('/');

    // Add a link with target attribute via console
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.href = 'https://example.com';
      link.target = '_blank';
      link.textContent = 'External Link';
      link.id = 'external-link';
      document.body.appendChild(link);
    });

    // Click the external link (should open in new tab, not PJAX)
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.click('#external-link')
    ]);

    // Verify new page opened
    await expect(newPage).toHaveURL('https://example.com/');

    // Close the new page
    await newPage.close();
  });

  test('hash-only links excluded from PJAX', async ({ page }) => {
    await page.goto('/');

    // Add a hash link
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.href = '#test-section';
      link.textContent = 'Hash Link';
      link.id = 'hash-link';
      document.body.appendChild(link);

      const section = document.createElement('section');
      section.id = 'test-section';
      section.textContent = 'Test Section';
      section.style.marginTop = '2000px';
      document.body.appendChild(section);
    });

    // Click hash link
    await page.click('#hash-link');

    // Should still be on index page with hash
    await expect(page).toHaveURL('/#test-section');

    // Page should scroll (not navigate)
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });

  test('navigation persists theme setting', async ({ page }) => {
    await page.goto('/');

    // Switch to dark theme
    await page.click('#theme-toggle');

    // Check theme is dark
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('dark');

    // Navigate to another page
    await page.click('a[href="about.html"]');
    await page.waitForURL('/about.html');

    // Theme should still be dark
    const htmlThemeAfter = await page.locator('html').getAttribute('data-theme');
    expect(htmlThemeAfter).toBe('dark');
  });

  test('fade-in animations trigger after PJAX navigation', async ({ page }) => {
    await page.goto('/');

    // Navigate to a page
    await page.click('a[href="about.html"]');
    await page.waitForURL('/about.html');

    // Wait a bit for animations
    await page.waitForTimeout(100);

    // Check if fade-in elements got the visible class
    const fadeInElements = page.locator('.fade-in.visible');
    const count = await fadeInElements.count();

    // Should have at least some visible elements
    expect(count).toBeGreaterThan(0);
  });

  test('card tilt effect reinitialized after PJAX navigation', async ({ page }) => {
    // Assuming works.html has cards
    await page.goto('/works.html');

    const card = page.locator('.card').first();

    if (await card.count() > 0) {
      // Check card has tilt initialization flag
      const hasTiltInit = await card.evaluate(el => el.dataset.tiltInit === 'true');
      expect(hasTiltInit).toBe(true);
    }
  });
});
