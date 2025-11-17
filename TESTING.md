# Testing Guide - yunoxia.one

This document describes the testing infrastructure for the yunoxia.one website.

## Overview

The testing strategy follows the project's **zero-build philosophy** while providing comprehensive coverage:

- **Unit Tests**: Fast, isolated tests for core logic (path normalization, theme system)
- **Integration Tests**: Browser-based tests for user flows (navigation, theme persistence)
- **Accessibility Tests**: WCAG 2.1 AA compliance validation

## Test Stack

| Type | Framework | Purpose |
|------|-----------|---------|
| **Unit** | [uvu](https://github.com/lukeed/uvu) + jsdom | Lightweight, no-build unit testing |
| **Integration** | [Playwright](https://playwright.dev/) | Cross-browser E2E testing |
| **Accessibility** | [axe-core](https://github.com/dequelabs/axe-core) | WCAG compliance validation |

## Installation

```bash
# Install dependencies (dev only - not required for production)
npm install
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Accessibility Audit
```bash
# Start dev server first
npm run serve

# In another terminal
npm run test:a11y
```

### Watch Mode (Unit Tests)
```bash
npm run test:watch
```

## Test Structure

```
tests/
├── setup.js                      # Test utilities and DOM mocking
├── unit/                         # Unit tests
│   ├── normalizePath.test.js     # Path normalization logic
│   └── themeSystem.test.js       # Theme system logic
├── integration/                  # Integration tests
│   ├── pjax-navigation.spec.js   # PJAX navigation flows
│   ├── theme-system.spec.js      # Theme persistence & toggle
│   └── accessibility.spec.js     # Accessibility compliance
└── accessibility/                # Standalone accessibility tools
    └── a11y-audit.js             # Automated accessibility audit
```

## What's Tested

### ✅ Unit Tests

#### Path Normalization (`normalizePath.test.js`)
- Root path handling (`/` → `/index.html`)
- Trailing slash conversion (`/about/` → `/about/index.html`)
- Already-normalized paths pass through
- Query string and hash handling
- Path comparison edge cases

#### Theme System (`themeSystem.test.js`)
- Theme application to `data-theme` attribute
- localStorage persistence
- System preference detection (`prefers-color-scheme`)
- Theme toggle checkbox sync
- localStorage unavailable scenarios (private browsing)
- Three-tier fallback (stored → system → default)

### ✅ Integration Tests

#### PJAX Navigation (`pjax-navigation.spec.js`)
- Content updates without full page reload
- Active navigation link updates
- Browser back/forward button support
- Route progress bar animation
- Script reinitialization after navigation
- Theme persistence across navigation
- Fade-in animations trigger
- Links with `target` attribute excluded
- Hash-only links excluded
- Card tilt effect reinitialized

#### Theme System (`theme-system.spec.js`)
- Toggle switches between light/dark
- Theme persists across page reloads
- Theme persists across PJAX navigation
- Keyboard accessibility (Tab, Space, Enter)
- No FOUC (Flash of Unstyled Content)
- CSS variables update correctly
- Toggle icon animation
- System preference respected on first visit
- localStorage override precedence
- Focus styles on toggle

#### Accessibility (`accessibility.spec.js`)
- WCAG 2.1 AA compliance (all pages)
- Keyboard navigation works
- Theme toggle keyboard accessible
- Images have alt text
- Proper heading hierarchy
- Color contrast meets standards (both themes)
- Links have discernible text
- Form controls have labels
- `lang` attribute present
- Reduced motion respected
- Focus visible on interactive elements
- Proper document structure (landmarks)

## Test Coverage Summary

| Component | Coverage | Critical Tests |
|-----------|----------|----------------|
| **Path Normalization** | 100% | 13 test cases |
| **Theme System** | 95% | 16 unit + 11 integration tests |
| **PJAX Navigation** | 90% | 11 test cases |
| **Accessibility** | 85% | 15 test cases + axe audit |
| **Partials Loading** | 60% | Covered in integration tests |
| **Animations** | 50% | Basic coverage, visual testing recommended |

## Browser Coverage

Integration tests run on:
- ✅ Chrome/Chromium (Desktop)
- ✅ Firefox (Desktop)
- ✅ Safari/WebKit (Desktop)
- ✅ Chrome Mobile (Pixel 5)
- ✅ Safari Mobile (iPhone 12)

## Writing New Tests

### Unit Test Example

```javascript
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { createDOM, cleanupDOM } from '../setup.js';

test.before(() => {
  createDOM();
});

test.after(() => {
  cleanupDOM();
});

test('my feature works correctly', () => {
  // Arrange
  const input = 'test';

  // Act
  const result = myFunction(input);

  // Assert
  assert.is(result, 'expected');
});

test.run();
```

### Integration Test Example

```javascript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should work as expected', async ({ page }) => {
    await page.goto('/');

    await page.click('button');

    await expect(page.locator('.result')).toBeVisible();
  });
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Run accessibility audit
        run: npm run test:a11y

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: playwright-report/
```

## Common Issues & Solutions

### Tests Fail with "Server not running"

**Problem**: Integration tests require local server
**Solution**: Run `npm run serve` in a separate terminal before running tests

### localStorage Tests Failing

**Problem**: jsdom localStorage mock not working
**Solution**: Check `tests/setup.js` for proper mock implementation

### Accessibility Tests Too Strict

**Problem**: axe-core flags non-critical issues
**Solution**: Use `.exclude()` or adjust rules in test files

### Playwright Browsers Not Installed

**Problem**: Integration tests fail with browser errors
**Solution**: Run `npx playwright install`

## Performance Benchmarks

Tests should complete within:
- **Unit tests**: < 1 second
- **Integration tests**: < 30 seconds (all browsers)
- **Accessibility audit**: < 10 seconds

If tests are slower, check for:
- Missing `await` statements causing timeouts
- Unnecessary `waitForTimeout` calls
- Network throttling enabled

## Testing Philosophy

The test suite follows these principles:

1. **Tests are optional** - Production deployment requires no build or tests
2. **Fast feedback** - Unit tests run in < 1s for rapid iteration
3. **Real browsers** - Integration tests use Playwright for accurate validation
4. **Accessibility first** - Every page tested for WCAG compliance
5. **Maintenance friendly** - Tests mirror project structure for clarity

## Future Test Coverage

Areas for improvement:

### Medium Priority
- ✅ Event handler cleanup tests
- ✅ Cross-browser compatibility matrix
- ✅ Partials loading error handling
- ⬜ Visual regression tests (Playwright screenshots)
- ⬜ Performance budgets (Lighthouse CI)

### Low Priority
- ⬜ Animation timing validation
- ⬜ Card tilt mathematical accuracy
- ⬜ Navigation underline position calculation
- ⬜ E2E user journey tests

## Manual Testing Checklist

For environments without automated testing infrastructure, use this comprehensive manual testing checklist:

### Quick Smoke Test (< 5 minutes)

- [ ] All pages load without errors
- [ ] Navigation works (click all links)
- [ ] Theme toggle switches between light/dark
- [ ] No console errors
- [ ] Mobile view looks correct

### Full Manual Test Suite (< 30 minutes)

#### Navigation & PJAX
- [ ] All navigation links work
- [ ] Browser back/forward buttons work
- [ ] Active link highlights correctly
- [ ] Route progress bar animates
- [ ] Underline follows hover and returns to active

#### Theme System
- [ ] Toggle switches themes
- [ ] Theme persists after reload
- [ ] System preference respected on first visit
- [ ] No FOUC (flash of unstyled content)
- [ ] All colors update correctly

#### Accessibility
- [ ] Tab through all interactive elements
- [ ] Enter key activates links
- [ ] Skip link appears on Tab
- [ ] Focus states visible
- [ ] Color contrast sufficient (use browser DevTools)

#### Responsive Design
- [ ] Desktop (> 1440px): Max width constraint works
- [ ] Tablet (768px): Layout adjusts properly
- [ ] Mobile (480px): No horizontal scroll, readable text
- [ ] Test on real iOS/Android device if possible

#### Performance
- [ ] Page loads in < 3 seconds (Network tab)
- [ ] Animations are smooth (60fps)
- [ ] Run Lighthouse (target 90+ in all categories)

#### Service Worker (if implemented)
- [ ] SW registers successfully (Console)
- [ ] Offline mode works (DevTools → Application → Offline)
- [ ] Cache updates on version change

### Browser Testing Matrix

| Browser | Desktop | Mobile | Status |
|---------|---------|--------|--------|
| Chrome | ✓ | ✓ | |
| Firefox | ✓ | - | |
| Safari | ✓ | ✓ | |
| Edge | ✓ | - | |

### Tools for Manual Testing

- **Lighthouse**: Chrome DevTools → Lighthouse
- **Accessibility**: [WAVE](https://wave.webaim.org/) browser extension
- **Contrast**: Chrome DevTools → Color Picker → Contrast Ratio
- **Mobile**: Chrome DevTools → Device Toolbar (Cmd+Shift+M)

## Resources

- [uvu Documentation](https://github.com/lukeed/uvu)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Vitals](https://web.dev/vitals/)

## Questions?

For issues or questions about testing:
1. Check this documentation first
2. Review test file comments
3. Examine similar existing tests
4. Check git commit history for context

---

**Last Updated**: 2025-11-17
**Test Coverage**: ~85% of critical paths
**Total Test Files**: 7
**Total Test Cases**: 50+
