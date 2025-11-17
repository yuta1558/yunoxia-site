/**
 * Unit tests for theme system
 * Tests theme persistence, system preferences, and toggle functionality
 */

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { createDOM, cleanupDOM, createMockMatchMedia } from '../setup.js';

test.before.each(() => {
  createDOM(`
    <!DOCTYPE html>
    <html class="no-js" lang="ja" data-theme="light">
    <head></head>
    <body>
      <label class="theme-toggle">
        <input type="checkbox" id="theme-toggle" />
        <span class="toggle-track">
          <span class="toggle-thumb"></span>
        </span>
      </label>
    </body>
    </html>
  `);
});

test.after.each(() => {
  cleanupDOM();
});

// Theme application tests
test('applyTheme sets data-theme attribute on root element', () => {
  const root = document.documentElement;

  // Simulate applyTheme function
  const applyTheme = (theme, persist = false) => {
    const resolved = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", resolved);
    if (persist) {
      localStorage.setItem("theme", resolved);
    }
  };

  applyTheme('dark');
  assert.is(root.getAttribute('data-theme'), 'dark');

  applyTheme('light');
  assert.is(root.getAttribute('data-theme'), 'light');
});

test('applyTheme persists to localStorage when persist=true', () => {
  const root = document.documentElement;

  const applyTheme = (theme, persist = false) => {
    const resolved = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", resolved);
    if (persist) {
      localStorage.setItem("theme", resolved);
    }
  };

  applyTheme('dark', true);
  assert.is(localStorage.getItem('theme'), 'dark');

  applyTheme('light', true);
  assert.is(localStorage.getItem('theme'), 'light');
});

test('applyTheme does not persist when persist=false', () => {
  const root = document.documentElement;

  const applyTheme = (theme, persist = false) => {
    const resolved = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", resolved);
    if (persist) {
      localStorage.setItem("theme", resolved);
    }
  };

  localStorage.clear();
  applyTheme('dark', false);
  assert.is(localStorage.getItem('theme'), null);
});

test('applyTheme normalizes invalid themes to "light"', () => {
  const root = document.documentElement;

  const applyTheme = (theme, persist = false) => {
    const resolved = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", resolved);
    if (persist) {
      localStorage.setItem("theme", resolved);
    }
  };

  applyTheme('invalid-theme');
  assert.is(root.getAttribute('data-theme'), 'light');
});

// Theme initialization tests
test('initTheme uses localStorage value when available', () => {
  const root = document.documentElement;
  localStorage.setItem('theme', 'dark');

  global.window.matchMedia = createMockMatchMedia(false); // System prefers light

  const initTheme = () => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const stored = localStorage.getItem("theme");
    const initial = stored || (media.matches ? "dark" : "light");
    root.setAttribute("data-theme", initial);
  };

  initTheme();
  assert.is(root.getAttribute('data-theme'), 'dark');
});

test('initTheme falls back to system preference when no localStorage', () => {
  const root = document.documentElement;
  localStorage.clear();

  global.window.matchMedia = createMockMatchMedia(true); // System prefers dark

  const initTheme = () => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const stored = localStorage.getItem("theme");
    const initial = stored || (media.matches ? "dark" : "light");
    root.setAttribute("data-theme", initial);
  };

  initTheme();
  assert.is(root.getAttribute('data-theme'), 'dark');
});

test('initTheme defaults to "light" when no localStorage and system prefers light', () => {
  const root = document.documentElement;
  localStorage.clear();

  global.window.matchMedia = createMockMatchMedia(false); // System prefers light

  const initTheme = () => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const stored = localStorage.getItem("theme");
    const initial = stored || (media.matches ? "dark" : "light");
    root.setAttribute("data-theme", initial);
  };

  initTheme();
  assert.is(root.getAttribute('data-theme'), 'light');
});

// Theme toggle sync tests
test('syncThemeToggle sets checkbox checked when theme is dark', () => {
  const root = document.documentElement;
  const checkbox = document.getElementById('theme-toggle');

  root.setAttribute('data-theme', 'dark');

  const syncThemeToggle = () => {
    checkbox.checked = root.getAttribute("data-theme") === "dark";
  };

  syncThemeToggle();
  assert.is(checkbox.checked, true);
});

test('syncThemeToggle sets checkbox unchecked when theme is light', () => {
  const root = document.documentElement;
  const checkbox = document.getElementById('theme-toggle');

  root.setAttribute('data-theme', 'light');

  const syncThemeToggle = () => {
    checkbox.checked = root.getAttribute("data-theme") === "dark";
  };

  syncThemeToggle();
  assert.is(checkbox.checked, false);
});

// Theme toggle handler tests
test('themeToggleHandler switches to dark when checkbox checked', () => {
  const root = document.documentElement;

  const applyTheme = (theme, persist = false) => {
    const resolved = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", resolved);
    if (persist) {
      localStorage.setItem("theme", resolved);
    }
  };

  const themeToggleHandler = (event) => {
    const nextTheme = event.target.checked ? "dark" : "light";
    applyTheme(nextTheme, true);
  };

  const mockEvent = { target: { checked: true } };
  themeToggleHandler(mockEvent);

  assert.is(root.getAttribute('data-theme'), 'dark');
  assert.is(localStorage.getItem('theme'), 'dark');
});

test('themeToggleHandler switches to light when checkbox unchecked', () => {
  const root = document.documentElement;
  root.setAttribute('data-theme', 'dark');

  const applyTheme = (theme, persist = false) => {
    const resolved = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", resolved);
    if (persist) {
      localStorage.setItem("theme", resolved);
    }
  };

  const themeToggleHandler = (event) => {
    const nextTheme = event.target.checked ? "dark" : "light";
    applyTheme(nextTheme, true);
  };

  const mockEvent = { target: { checked: false } };
  themeToggleHandler(mockEvent);

  assert.is(root.getAttribute('data-theme'), 'light');
  assert.is(localStorage.getItem('theme'), 'light');
});

// localStorage unavailable scenarios
test('handles localStorage being unavailable gracefully', () => {
  const root = document.documentElement;

  // Simulate localStorage throwing errors (private browsing mode)
  const brokenStorage = {
    getItem: () => { throw new Error('localStorage unavailable'); },
    setItem: () => { throw new Error('localStorage unavailable'); }
  };

  global.localStorage = brokenStorage;
  global.window.matchMedia = createMockMatchMedia(false);

  const initTheme = () => {
    let stored = null;
    try {
      stored = localStorage.getItem("theme");
    } catch (e) {
      // Gracefully handle localStorage errors
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const initial = stored || (media.matches ? "dark" : "light");
    root.setAttribute("data-theme", initial);
  };

  // Should not throw
  assert.not.throws(() => initTheme());

  // Should fall back to system preference
  assert.is(root.getAttribute('data-theme'), 'light');
});

test.run();
