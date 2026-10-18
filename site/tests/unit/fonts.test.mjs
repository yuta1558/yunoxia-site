// node --test tests/unit — the non-blocking full-font link for CMS post pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fontLinks } from '../../functions/_lib/fonts.js';

test('fontLinks loads the stylesheet without blocking and has a noscript fallback', () => {
  const html = fontLinks('/assets/fonts/zen-1.2.3/full.css');
  assert.match(html, /<link rel="stylesheet" href="\/assets\/fonts\/zen-1\.2\.3\/full\.css" media="print" onload="this\.media='all'">/);
  assert.match(html, /<noscript><link rel="stylesheet" href="\/assets\/fonts\/zen-1\.2\.3\/full\.css"><\/noscript>/);
});

test('fontLinks injects nothing without a path', () => {
  assert.equal(fontLinks(null), '');
});

test('fontLinks ignores anything but a versioned font path', () => {
  assert.equal(fontLinks(), '');
  assert.equal(fontLinks('https://evil.example/x.css'), '');
  assert.equal(fontLinks('/assets/fonts/zen-1.2.3/full.css" onload="x'), '');
});
