/**
 * Unit tests for path normalization logic
 * Tests the critical routing functionality
 */

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { createDOM, cleanupDOM } from '../setup.js';

// Extract normalizePath function from app.js
// This is the same logic as in assets/js/app.js:11-18
const normalizePath = (url) => {
  const { pathname } = new URL(url, 'http://localhost:8000/');
  if (pathname === "/" || pathname === "") {
    return `${pathname === "" ? "/" : pathname}index.html`;
  }
  if (pathname.endsWith("/")) return `${pathname}index.html`;
  return pathname;
};

test.before(() => {
  createDOM();
});

test.after(() => {
  cleanupDOM();
});

// Root path tests
test('root path "/" normalizes to "/index.html"', () => {
  const result = normalizePath('http://localhost:8000/');
  assert.is(result, '/index.html');
});

test('empty path normalizes to "/index.html"', () => {
  const result = normalizePath('http://localhost:8000');
  assert.is(result, '/index.html');
});

// Trailing slash tests
test('path with trailing slash converts to index.html', () => {
  const result = normalizePath('http://localhost:8000/about/');
  assert.is(result, '/about/index.html');
});

test('nested path with trailing slash converts correctly', () => {
  const result = normalizePath('http://localhost:8000/blog/posts/');
  assert.is(result, '/blog/posts/index.html');
});

// Already normalized paths
test('HTML file path passes through unchanged', () => {
  const result = normalizePath('http://localhost:8000/works.html');
  assert.is(result, '/works.html');
});

test('nested HTML file path passes through unchanged', () => {
  const result = normalizePath('http://localhost:8000/blog/post.html');
  assert.is(result, '/blog/post.html');
});

// Edge cases
test('path without trailing slash or extension passes through', () => {
  const result = normalizePath('http://localhost:8000/about');
  assert.is(result, '/about');
});

test('handles query strings correctly', () => {
  const result = normalizePath('http://localhost:8000/about.html?foo=bar');
  assert.is(result, '/about.html');
});

test('handles hash fragments correctly', () => {
  const result = normalizePath('http://localhost:8000/about.html#section');
  assert.is(result, '/about.html');
});

test('handles query strings with trailing slash', () => {
  const result = normalizePath('http://localhost:8000/about/?foo=bar');
  assert.is(result, '/about/index.html');
});

// Path comparison tests (common use case)
test('two different representations of same page match after normalization', () => {
  const path1 = normalizePath('http://localhost:8000/about/');
  const path2 = normalizePath('http://localhost:8000/about/index.html');
  assert.is(path1, path2);
});

test('root representations match after normalization', () => {
  const path1 = normalizePath('http://localhost:8000/');
  const path2 = normalizePath('http://localhost:8000/index.html');
  assert.is(path1, path2);
});

test.run();
