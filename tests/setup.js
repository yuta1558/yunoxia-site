/**
 * Test setup utilities for yunoxia-site
 * Provides DOM environment and helper functions for testing
 */

import { JSDOM } from 'jsdom';

/**
 * Create a mock DOM environment for testing
 */
export function createDOM(html = '<!DOCTYPE html><html><body></body></html>') {
  const dom = new JSDOM(html, {
    url: 'http://localhost:8000/',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.localStorage = createMockLocalStorage();
  global.location = dom.window.location;
  global.history = dom.window.history;
  global.IntersectionObserver = createMockIntersectionObserver();
  global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
  global.cancelAnimationFrame = clearTimeout;

  return dom;
}

/**
 * Mock localStorage for testing
 */
export function createMockLocalStorage() {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
}

/**
 * Mock IntersectionObserver for testing
 */
export function createMockIntersectionObserver() {
  return class MockIntersectionObserver {
    constructor(callback) {
      this.callback = callback;
      this.elements = [];
    }
    observe(element) {
      this.elements.push(element);
    }
    unobserve(element) {
      this.elements = this.elements.filter(el => el !== element);
    }
    disconnect() {
      this.elements = [];
    }
    trigger(entries) {
      this.callback(entries);
    }
  };
}

/**
 * Mock matchMedia for testing
 */
export function createMockMatchMedia(matches = false) {
  return (query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true
  });
}

/**
 * Clean up global state after tests
 */
export function cleanupDOM() {
  delete global.window;
  delete global.document;
  delete global.navigator;
  delete global.localStorage;
  delete global.location;
  delete global.history;
  delete global.IntersectionObserver;
  delete global.requestAnimationFrame;
  delete global.cancelAnimationFrame;
}

/**
 * Wait for async operations
 */
export function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
