# CLAUDE.md - AI Assistant Guide for yunoxia-site

## Project Overview

**yunoxia.one** is a personal website built with vanilla HTML, CSS, and JavaScript. There is no framework and no build step: the repository root is deployed as-is.

### Key Characteristics
- **Type**: Static personal website (PWA-enabled)
- **Framework**: None (vanilla JavaScript, ES2020+)
- **Build Tool**: None
- **Runtime Dependencies**: GSAP 3 (jsDelivr CDN), web-vitals 3 (jsDelivr CDN), Google Fonts
- **Dev Dependencies**: `package.json` exists only for tests (uvu, jsdom, Playwright, axe-core). Nothing from `node_modules` is shipped.
- **Pages**: 5 content pages (index, about, works, log, links) + `404.html`
- **Hosting**: Cloudflare Pages, auto-deployed from `main`. Every PR gets a preview deployment (`*.yunoxia-site.pages.dev`).

## Directory Structure

```
yunoxia-site/
├── index.html / about.html / works.html / log.html / links.html
├── 404.html                 # Custom 404 (uses <base href="/">, noindex)
├── partials/
│   ├── header.html          # Skip link, theme toggle, route progress, logo, nav
│   └── footer.html
├── assets/
│   ├── css/style.css        # All styles (~1500 lines)
│   ├── js/app.js            # Application logic (~1650 lines)
│   ├── js/web-vitals.js     # Core Web Vitals reporting
│   ├── svg/                 # sun.svg / moon.svg
│   ├── favicon.svg, logo.svg
│   ├── icon-192.png, icon-512.png, apple-touch-icon.png
│   └── ogp-v2.png           # OGP image (1200x630)
├── favicon.ico
├── manifest.json            # PWA manifest
├── sw.js                    # Service Worker (network-first, caches only response.ok)
├── robots.txt, sitemap.xml
├── _headers, _redirects     # Cloudflare Pages config (the one actually used)
├── netlify.toml, vercel.json# Kept in sync for portability; not used in production
├── tests/                   # unit (uvu + jsdom), integration (Playwright), accessibility
├── header.html, style.css   # Legacy files at the root; not referenced by any page
└── package.json, playwright.config.js
```

## Architecture

### app.js structure
`app.js` is a single classic script (loaded with `defer`) organised into object-literal modules:

- `CONFIG` - animation timings, selectors, class names, storage keys
- `state` - cached elements, observers, event handlers, flags
- Utilities: `throttle`, `normalizePath`, `query`, `queryAll`
- Core modules: `Partials`, `Navigation` (underline + active state), `MagneticNav`, `Theme`, `PJAX`, `Animation`, `CardTilt`, `ServiceWorkerManager`
- UX modules: `CursorFollower`, `RippleEffect`, `ScrollProgress`, `ParallaxEffect`, `TextAnimation`, `ToastNotification`, `Tooltip`, `Lightbox`, `SmoothScroll`, `ScrollToTop`, `GradientMesh`, `CopyToClipboard`, `ParticleBackground`, `LogoAnimation`, `StaggerIndexer`, `SectionDivider`, `EnhancedPageTransition`

All initialisation happens in one `DOMContentLoaded` listener at the bottom of the file:
1. Remove `no-js` from `<html>`
2. `await Partials.load()` (header/footer via `data-include`) - must finish first
3. Init core modules, then UX modules
4. `ServiceWorkerManager.register()`

### PJAX navigation (`PJAX` module)
- Intercepts same-origin `<a>` clicks, except links with `target` or hash-only `href`
- Runs the exit animation and `fetch` in parallel, parses the response, swaps `<main>` content
- Syncs `document.title` from the fetched page, then `history.pushState`
- Calls `PJAX.reinitialize()`
- On any error, falls back to a full page load (`location.href = url`)

`PJAX.reinitialize()` re-runs everything that depends on `<main>` content: `Animation.initObserver/animateMain`, `CardTilt.init`, `Navigation.setActive`, `Theme.syncToggle`, `TextAnimation.init`, `ParallaxEffect/ScrollProgress/ScrollToTop.update`, `StaggerIndexer.init`, `SectionDivider.init`. **Any new module that touches `<main>` content must be added here.**

### Theme system
- Inline script in every page `<head>` sets `data-theme` on `<html>` before render (prevents FOUC): `localStorage.theme` → `prefers-color-scheme` → `light`
- `Theme` module persists to `localStorage` on toggle and re-syncs the toggle after PJAX
- CSS variables are defined under `[data-theme="light"]` and `[data-theme="dark"]` in `style.css`

### Typography
Google Fonts: **Sora** (Latin, headings and body) + **Noto Sans JP** (Japanese).

## Caching and Deployment (Important)

`_headers` controls caching on Cloudflare Pages:

| Path | Cache-Control |
|------|---------------|
| `/*.html`, `/sw.js` | `public, max-age=0, must-revalidate` |
| `/assets/js/*`, `/assets/css/*` | `public, max-age=0, must-revalidate` (overrides `/assets/*` with `! Cache-Control`) |
| other `/assets/*` (images) | `public, max-age=31536000, immutable` |

Rules that follow from this:
- **Changing an image under `/assets/`: use a new filename** (e.g. `ogp-v2.png` → `ogp-v3.png`) and update all references. Overwriting in place leaves visitors on the old file for a year.
- JS/CSS can be edited in place; browsers revalidate on every load. The `?v=2` query on `app.js` / `style.css` was a one-time eviction of old immutable copies and does not need bumping.
- The Cloudflare zone's Browser Cache TTL is set to "Respect Existing Headers" so these values reach browsers unchanged.
- When changing the precache list in `sw.js`, also bump `CACHE_VERSION`.
- If you change caching or redirects, keep `netlify.toml` and `vercel.json` consistent, using non-overlapping patterns.
- Do not add a catch-all `/* /index.html 200` rewrite: it turns every missing URL into a soft 404.

## Code Conventions

### JavaScript
- Add features as a new object-literal module with an `init()` method; call it from the `DOMContentLoaded` block, and from `PJAX.reinitialize()` if it depends on `<main>` content
- Guard against double initialisation with a `data-*` flag (e.g. `card.dataset.tiltInit`)
- Remove old listeners before re-adding them (handlers are kept in `state.handlers`)
- Always check `typeof gsap !== 'undefined'` before using GSAP
- Use `requestAnimationFrame` / `throttle` for continuous or high-frequency handlers
- Comments may be bilingual (English / Japanese), matching existing section headers

### CSS
- Use CSS variables for colours; define each new variable for both themes
- Every new animation must be disabled under `@media (prefers-reduced-motion: reduce)`
- No vendor prefixes

### HTML
- Every page keeps: the inline theme script in `<head>`, `<header data-include="partials/header.html">`, `<main id="pjax-container">`, `<footer data-include="partials/footer.html">`, GSAP CDN script, `assets/js/app.js?v=2` with `defer`
- Add `.fade-in` (or `.fade-in-left/right/scale`) for scroll-in animation and `.card` for tilt

### Things not to do
- Do not add a build step, bundler, or runtime npm dependency
- Do not remove the inline theme script, `data-include` partials, or `nav-underline`
- Do not change element IDs used by JS (`theme-toggle`, `routeProgress`, `pjax-container`)
- Do not change the PJAX flow without updating `reinitialize()`

## Adding a New Page

1. Copy an existing page (e.g. `about.html`) and change `<title>`, description, canonical, OGP/Twitter tags, and `<main>` content
2. Add the nav link in `partials/header.html`
3. Add the URL to `sitemap.xml`
4. Optionally add it to `PRECACHE_ASSETS` in `sw.js` (and bump `CACHE_VERSION`)
5. Check: direct load, PJAX navigation in and out, title update, active nav state, theme persistence

## Development and Testing

```bash
python3 -m http.server 8000   # serve locally (no build)
npm install                   # dev dependencies for tests only
npm run test:unit             # uvu + jsdom (fast)
npm run test:integration      # Playwright; needs network access to jsDelivr and Google Fonts
npm run test:a11y             # axe-core audit
```

- Unit tests duplicate small pieces of logic (`normalizePath`, theme) rather than importing `app.js`; keep them in sync when changing that logic.
- `python3 -m http.server` does not emulate Cloudflare's `_headers` / `_redirects` / 404 handling. For those, check the PR's Pages preview with `curl -I`.

## Git Workflow
- Feature branches: `claude/<description>` or `codex/<description>`
- PR-based; Cloudflare Pages posts a preview URL on each PR, and Codex reviews PRs automatically
- Commit messages: English or Japanese, describing what changed and why

---

**Last Updated**: 2026-10-18
**Maintained By**: yuta1558 / yunoxia.one
