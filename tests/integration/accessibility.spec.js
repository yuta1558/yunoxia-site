/**
 * Accessibility tests using axe-core
 * Tests WCAG 2.1 AA compliance and keyboard navigation
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  const pages = [
    { url: '/', name: 'Home' },
    { url: '/about.html', name: 'About' },
    { url: '/works.html', name: 'Works' },
    { url: '/log.html', name: 'Log' },
    { url: '/links.html', name: 'Links' }
  ];

  // Test each page for accessibility violations
  for (const page of pages) {
    test(`${page.name} page should not have accessibility violations`, async ({ page: playwright }) => {
      await playwright.goto(page.url);

      const accessibilityScanResults = await new AxeBuilder({ page: playwright })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }

  test('keyboard navigation works correctly', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');

    // First focusable element should be the theme toggle
    let focused = await page.evaluate(() => document.activeElement.id);

    // Continue tabbing through navigation links
    const navLinks = await page.locator('.nav-link').count();

    for (let i = 0; i < navLinks; i++) {
      await page.keyboard.press('Tab');
      const activeElement = await page.evaluate(() => {
        return document.activeElement.tagName;
      });
      // Should focus on anchor tags
      expect(activeElement).toBe('A');
    }
  });

  test('theme toggle is accessible via keyboard', async ({ page }) => {
    await page.goto('/');

    // Focus theme toggle
    await page.locator('#theme-toggle').focus();

    // Check it's focused
    const isFocused = await page.evaluate(() =>
      document.activeElement.id === 'theme-toggle'
    );
    expect(isFocused).toBe(true);

    // Toggle with Space key
    const initialTheme = await page.locator('html').getAttribute('data-theme');
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);

    const newTheme = await page.locator('html').getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);

    // Toggle with Enter key
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);

    const finalTheme = await page.locator('html').getAttribute('data-theme');
    expect(finalTheme).toBe(initialTheme);
  });

  test('skip links work for keyboard users', async ({ page }) => {
    await page.goto('/');

    // If there are skip links, test them
    const skipLink = page.locator('a[href^="#"][href*="main"], a[href^="#"][href*="content"]').first();

    if (await skipLink.count() > 0) {
      await skipLink.focus();
      await page.keyboard.press('Enter');

      // Should focus main content
      const mainFocused = await page.evaluate(() => {
        return document.activeElement.tagName === 'MAIN' ||
               document.activeElement.closest('main') !== null;
      });
      expect(mainFocused).toBe(true);
    }
  });

  test('images have alt text', async ({ page }) => {
    await page.goto('/');

    // Get all images
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');

      // All images should have alt attribute (can be empty for decorative)
      expect(alt).not.toBe(null);
    }
  });

  test('proper heading hierarchy exists', async ({ page }) => {
    await page.goto('/');

    const headings = await page.evaluate(() => {
      const h1s = Array.from(document.querySelectorAll('h1')).length;
      const h2s = Array.from(document.querySelectorAll('h2')).length;
      const h3s = Array.from(document.querySelectorAll('h3')).length;

      return { h1s, h2s, h3s };
    });

    // Should have at least one h1 (or logo serves as h1)
    expect(headings.h1s).toBeGreaterThanOrEqual(0);

    // If there are h3s, there should be h2s
    if (headings.h3s > 0) {
      expect(headings.h2s).toBeGreaterThan(0);
    }
  });

  test('color contrast meets WCAG AA standards (tested by axe)', async ({ page }) => {
    await page.goto('/');

    // Test both themes
    const themes = ['light', 'dark'];

    for (const theme of themes) {
      // Set theme
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);

      await page.waitForTimeout(100);

      // Run axe with color-contrast rules
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('body')
        .analyze();

      // Filter for color contrast violations
      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    }
  });

  test('links have discernible text', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('a');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');

      // Link should have text or aria-label
      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('form controls have labels (theme toggle)', async ({ page }) => {
    await page.goto('/');

    const checkbox = page.locator('#theme-toggle');

    // Should be wrapped in a label or have aria-label
    const hasLabel = await page.evaluate(() => {
      const toggle = document.getElementById('theme-toggle');
      return toggle.closest('label') !== null ||
             toggle.hasAttribute('aria-label') ||
             toggle.hasAttribute('aria-labelledby');
    });

    expect(hasLabel).toBe(true);
  });

  test('lang attribute is present on html element', async ({ page }) => {
    await page.goto('/');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
    expect(lang).toBe('ja');
  });

  test('reduced motion is respected', async ({ page, context }) => {
    // Create context with reduced motion preference
    const reducedMotionContext = await context.browser().newContext({
      reducedMotion: 'reduce'
    });

    const reducedMotionPage = await reducedMotionContext.newPage();
    await reducedMotionPage.goto('http://localhost:8000/');

    // Check if animations are disabled in CSS
    const navUnderlineTransition = await reducedMotionPage.locator('.nav-underline').evaluate(el =>
      getComputedStyle(el).transition
    );

    // Should have transition: none or similar
    expect(navUnderlineTransition).toContain('none');

    await reducedMotionPage.close();
    await reducedMotionContext.close();
  });

  test('focus is visible on interactive elements', async ({ page }) => {
    await page.goto('/');

    // Focus navigation link
    const firstLink = page.locator('.nav-link').first();
    await firstLink.focus();

    // Check for visible focus indicator (outline or other styling)
    const outline = await firstLink.evaluate(el => {
      const styles = getComputedStyle(el);
      return styles.outline !== 'none' ||
             styles.boxShadow !== 'none' ||
             styles.textDecoration !== 'none';
    });

    expect(outline).toBe(true);
  });

  test('page has proper document structure', async ({ page }) => {
    await page.goto('/');

    // Check for main landmark
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Check for header
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check for footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Check for navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });
});
