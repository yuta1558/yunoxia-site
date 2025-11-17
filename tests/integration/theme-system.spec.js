/**
 * Integration tests for theme system
 * Tests theme toggle, persistence, and system preference detection
 */

import { test, expect } from '@playwright/test';

test.describe('Theme System', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    await page.goto('/');

    // Check initial theme (should be light by default)
    let theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('light');

    // Click toggle to switch to dark
    await page.click('#theme-toggle');

    // Wait for theme to change
    await page.waitForTimeout(100);

    // Check theme is now dark
    theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');

    // Click toggle again to switch back to light
    await page.click('#theme-toggle');
    await page.waitForTimeout(100);

    // Check theme is light again
    theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('light');
  });

  test('theme preference persists across page reloads', async ({ page }) => {
    await page.goto('/');

    // Switch to dark theme
    await page.click('#theme-toggle');
    await page.waitForTimeout(100);

    // Verify dark theme is set
    let theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');

    // Reload the page
    await page.reload();

    // Theme should still be dark after reload
    theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');

    // Check localStorage has the theme
    const storedTheme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(storedTheme).toBe('dark');
  });

  test('theme preference persists across PJAX navigation', async ({ page }) => {
    await page.goto('/');

    // Switch to dark theme
    await page.click('#theme-toggle');
    await page.waitForTimeout(100);

    // Navigate to another page
    await page.click('a[href="about.html"]');
    await page.waitForURL('/about.html');

    // Theme should still be dark
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');

    // Toggle should be in correct state
    const isChecked = await page.locator('#theme-toggle').isChecked();
    expect(isChecked).toBe(true);
  });

  test('theme toggle is keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Focus the theme toggle using keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // May need multiple tabs depending on page structure

    // Find and focus the toggle directly
    await page.locator('#theme-toggle').focus();

    // Press Space to toggle
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);

    // Check theme changed to dark
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('no FOUC (flash of unstyled content) on page load', async ({ page }) => {
    // Set dark theme
    await page.goto('/');
    await page.click('#theme-toggle');
    await page.waitForTimeout(100);

    // Reload and check that theme is applied before first paint
    await page.reload();

    // Get the theme immediately on load
    const themeOnLoad = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    // Should be dark immediately (no flash to light first)
    expect(themeOnLoad).toBe('dark');
  });

  test('CSS variables change with theme', async ({ page }) => {
    await page.goto('/');

    // Get background color in light theme
    const lightBg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });

    // Switch to dark theme
    await page.click('#theme-toggle');
    await page.waitForTimeout(100);

    // Get background color in dark theme
    const darkBg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });

    // Colors should be different
    expect(lightBg).not.toBe(darkBg);
  });

  test('theme toggle icon animates', async ({ page }) => {
    await page.goto('/');

    const sunIcon = page.locator('[data-icon="sun"]');
    const moonIcon = page.locator('[data-icon="moon"]');

    // Initially, sun should be more visible (light theme)
    const sunOpacityLight = await sunIcon.evaluate(el =>
      parseFloat(getComputedStyle(el).opacity)
    );
    const moonOpacityLight = await moonIcon.evaluate(el =>
      parseFloat(getComputedStyle(el).opacity)
    );

    expect(sunOpacityLight).toBeGreaterThan(moonOpacityLight);

    // Switch to dark theme
    await page.click('#theme-toggle');
    await page.waitForTimeout(400); // Wait for transition

    // Now moon should be more visible
    const sunOpacityDark = await sunIcon.evaluate(el =>
      parseFloat(getComputedStyle(el).opacity)
    );
    const moonOpacityDark = await moonIcon.evaluate(el =>
      parseFloat(getComputedStyle(el).opacity)
    );

    expect(moonOpacityDark).toBeGreaterThan(sunOpacityDark);
  });

  test('theme respects system color scheme on first visit', async ({ page, context }) => {
    // Create a new context with dark color scheme preference
    const darkContext = await context.browser().newContext({
      colorScheme: 'dark'
    });

    const darkPage = await darkContext.newPage();
    await darkPage.goto('http://localhost:8000/');

    // Should default to dark theme based on system preference
    const theme = await darkPage.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');

    await darkPage.close();
    await darkContext.close();
  });

  test('localStorage override takes precedence over system preference', async ({ page, context }) => {
    // Set localStorage to light
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
    });

    // Create context with dark system preference
    const darkContext = await context.browser().newContext({
      colorScheme: 'dark'
    });

    const darkPage = await darkContext.newPage();

    // Set localStorage in new page
    await darkPage.goto('http://localhost:8000/');
    await darkPage.evaluate(() => {
      localStorage.setItem('theme', 'light');
    });
    await darkPage.reload();

    // Should use localStorage value (light) not system preference (dark)
    const theme = await darkPage.locator('html').getAttribute('data-theme');
    expect(theme).toBe('light');

    await darkPage.close();
    await darkContext.close();
  });

  test('theme toggle has proper focus styles', async ({ page }) => {
    await page.goto('/');

    // Focus the toggle
    await page.locator('#theme-toggle').focus();

    // Check for focus-visible styling (box-shadow should be applied)
    const toggleTrack = page.locator('.toggle-track');
    const boxShadow = await toggleTrack.evaluate(el =>
      getComputedStyle(el).boxShadow
    );

    // Should have some box-shadow for focus indication
    expect(boxShadow).not.toBe('none');
  });
});
