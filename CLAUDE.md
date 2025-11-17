# CLAUDE.md - AI Assistant Guide for yunoxia-site

## Project Overview

**yunoxia.one** is a lightweight personal website built with vanilla HTML, CSS, and JavaScript. It is intentionally framework-free and requires no build step, emphasizing simplicity, performance, and maintainability.

### Key Characteristics
- **Type**: Static personal website/portfolio
- **Framework**: None (vanilla JavaScript)
- **Build Tool**: None required
- **Languages**: HTML5, ES6+ JavaScript, CSS3
- **External Dependencies**: GSAP 3 (via CDN), Google Fonts
- **Total Codebase**: ~525 lines (271 JS + 254 CSS)
- **Pages**: 5 static pages (index, about, works, log, links)

## Architecture & Tech Stack

### Frontend Stack
| Layer | Technology |
|-------|-----------|
| **Markup** | HTML5 with semantic elements |
| **Styling** | CSS3 with custom properties (CSS variables) |
| **Scripting** | Vanilla JavaScript (ES6+) |
| **Animation** | GSAP 3 + CSS transitions |
| **Typography** | Google Fonts (Noto Sans JP, Outfit) |
| **State Management** | localStorage + DOM attributes |
| **Routing** | Custom PJAX implementation |
| **Build Process** | None (static files) |

### Browser APIs Used
- **Fetch API** - For PJAX navigation and partial loading
- **History API** - For SPA-style navigation (`pushState`, `popstate`)
- **IntersectionObserver** - For scroll-triggered fade-in animations
- **matchMedia** - For system color scheme detection
- **localStorage** - For theme persistence
- **requestAnimationFrame** - For smooth tilt animations

## Directory Structure

```
yunoxia-site/
├── README.md                    # User-facing documentation
├── CLAUDE.md                    # This file (AI assistant guide)
├── index.html                   # Home page
├── about.html                   # About/profile page
├── works.html                   # Portfolio page
├── log.html                     # Blog/log page
├── links.html                   # External links page
├── partials/                    # Reusable HTML components
│   ├── header.html              # Navigation, theme toggle, logo
│   └── footer.html              # Copyright footer
└── assets/                      # Static assets
    ├── css/
    │   └── style.css            # Main stylesheet (254 lines)
    ├── js/
    │   └── app.js               # Application logic (271 lines)
    ├── svg/
    │   ├── sun.svg              # Light mode icon
    │   └── moon.svg             # Dark mode icon
    ├── favicon.svg              # Site favicon
    ├── logo.svg                 # Yunoxia logo
    └── ogp.png                  # Open Graph image
```

## Key Files Explained

### `/assets/js/app.js` (271 lines)
**Purpose**: Core application logic
**Key Functions**:
- `loadPartials()` - Fetches and injects HTML partials (header/footer)
- `initTheme()` - Initializes theme system with localStorage + system preferences
- `initNavUnderline()` - Animated navigation underline that follows mouse
- `setActiveNav()` - Updates active navigation state
- `loadContent()` - PJAX navigation handler
- `initCardTilt()` - 3D card tilt effect on mouse movement
- `initObserver()` - Sets up IntersectionObserver for fade-in animations
- `animateNav()` / `animateMain()` - GSAP animation triggers

**Important**: All initialization happens in a single `DOMContentLoaded` event listener.

### `/assets/css/style.css` (254 lines)
**Purpose**: All styling and theme definitions
**Key Sections**:
- `:root` - Base transition timing
- `[data-theme="light"]` - Light mode color scheme (lines 6-18)
- `[data-theme="dark"]` - Dark mode color scheme (lines 20-32)
- `.theme-toggle` - Toggle switch component (lines 109-191)
- `.nav-underline` - Animated navigation indicator (lines 209-219)
- `#routeProgress` - Page transition progress bar (lines 221-228)
- `.card` - 3D tilt effect (lines 230-246)
- `@media (prefers-reduced-motion)` - Accessibility (lines 248-254)

### `/partials/header.html`
**Purpose**: Shared header across all pages
**Contents**:
- Theme toggle component
- Route progress bar
- Yunoxia logo
- Navigation menu (5 links)
- Navigation underline element

### `/partials/footer.html`
**Purpose**: Shared footer
**Contents**: Copyright notice with Japanese text

### `/*.html` (5 page files)
**Structure**: Each page follows identical template:
```html
<!DOCTYPE html>
<html class="no-js" lang="ja" data-theme="light">
<head>
  <!-- Inline theme detection script (prevents FOUC) -->
  <!-- Google Fonts -->
  <!-- style.css -->
</head>
<body>
  <header data-include="partials/header.html"></header>
  <main id="pjax-container">
    <!-- Page-specific content -->
  </main>
  <footer data-include="partials/footer.html"></footer>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script src="assets/js/app.js" defer></script>
</body>
</html>
```

## Development Workflows

### Local Development
```bash
# Serve locally (no build step needed)
python3 -m http.server

# Opens at http://localhost:8000/
```

### Git Workflow
- **Repository**: http://local_proxy@127.0.0.1:29300/git/yuta1558/yunoxia-site
- **Main Branch**: Not specified in current context
- **Feature Branches**: Use format `codex/[feature-description]` or `claude/[feature-description]`
- **Development**: PR-based workflow
- **Commit Style**: Mix of English and Japanese, descriptive of changes

### Deployment
1. Upload all files to static hosting provider
2. No build or compilation step required
3. Compatible with: GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.

## Code Conventions & Patterns

### JavaScript Patterns

#### 1. Module Pattern with Single Entry Point
All code runs inside one `DOMContentLoaded` listener:
```javascript
document.addEventListener("DOMContentLoaded", async () => {
  // Variable declarations
  // Helper functions
  // Initialization sequence
});
```

#### 2. Path Normalization
All URLs are normalized to handle trailing slashes:
```javascript
const normalizePath = (url) => {
  // Ensures consistent path comparison
  // / or "" → /index.html
  // /path/ → /path/index.html
}
```

#### 3. Dynamic Partials Loading
Uses `data-include` attribute pattern:
```javascript
// In HTML: <header data-include="partials/header.html"></header>
const loadPartials = async () => {
  for (const el of document.querySelectorAll("[data-include]")) {
    const html = await fetch(el.getAttribute("data-include"));
    el.outerHTML = await html.text();
  }
}
```

#### 4. PJAX Navigation
- Prevents default link clicks
- Fetches new page HTML
- Extracts `<main>` content
- Updates DOM and history
- Re-initializes interactive components
- Falls back to full page load on error

**Critical**: After PJAX navigation, must call `reinitScripts()` which runs:
- `initObserver()` - Re-observe fade-in elements
- `animateMain()` - Trigger entry animation
- `initCardTilt()` - Re-attach card event listeners
- `setActiveNav()` - Update active link state
- `syncThemeToggle()` - Re-attach toggle listener

#### 5. Theme System (Three-tier Fallback)
```javascript
// 1. Check localStorage
const stored = localStorage.getItem("theme");

// 2. Check system preference
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

// 3. Use stored, or system, or default to "light"
const theme = stored || (prefersDark ? "dark" : "light");
```

**Theme Application**:
- Sets `data-theme` attribute on `<html>` element
- CSS variables automatically switch based on `[data-theme]` selector
- Persists to localStorage when user toggles

#### 6. Event Handler Management
```javascript
// Pattern: Remove old listener before adding new one
if (linkHandler) document.removeEventListener("click", linkHandler);
linkHandler = (e) => { /* ... */ };
document.addEventListener("click", linkHandler);
```

#### 7. Initialization Guards
```javascript
// Prevent double-initialization
if (card.dataset.tiltInit) return;
card.dataset.tiltInit = "true";
```

### CSS Patterns

#### 1. CSS Custom Properties (Variables)
Theme colors defined at `[data-theme]` level:
```css
[data-theme="light"] {
  --primary: #111322;
  --secondary: #f7f8fc;
  /* ... */
}
```

Used throughout:
```css
body {
  background: var(--secondary);
  color: var(--primary);
}
```

#### 2. Utility Classes
- `.sr-only` - Screen reader only content
- `.fade-in` - Elements that fade in on scroll
- `.no-js` - Applied to `<html>`, removed by JS

#### 3. Progressive Enhancement
```css
.no-js .fade-in {
  opacity: 1;  /* Show immediately if JS disabled */
  transform: none;
}
```

#### 4. Hardware Acceleration Hints
```css
.nav-underline {
  will-change: transform, width;
}

.card {
  transform-style: preserve-3d;
  perspective: 800px;
}
```

#### 5. Accessibility-first Animations
```css
@media (prefers-reduced-motion: reduce) {
  .nav-underline, #routeProgress, .card, .card::after {
    transition: none !important;
    animation: none !important;
  }
}
```

### HTML Patterns

#### 1. Progressive Enhancement Class
```html
<html class="no-js" lang="ja" data-theme="light">
```
- `.no-js` removed by JavaScript on load
- `data-theme` controls color scheme
- `lang="ja"` indicates Japanese primary language

#### 2. FOUC Prevention Script
Every page has inline script in `<head>`:
```html
<script>
  // Immediately set theme before page renders
  const theme = localStorage.getItem('theme') ||
                (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
</script>
```

#### 3. Data Attributes for Behavior
- `data-include="path"` - Partial injection
- `data-icon="sun|moon"` - Icon type identification
- `data-tilt-init="true"` - Initialization flag

## Critical Areas for AI Assistants

### ⚠️ Things to NEVER Change

1. **Do not add build tools** - This project's philosophy is zero-build
2. **Do not add npm/package.json** - No dependencies except CDN-loaded GSAP
3. **Do not change the PJAX implementation** without understanding the full reinit flow
4. **Do not remove FOUC prevention script** from HTML `<head>`
5. **Do not hardcode theme** - Always respect user preference + system preference

### ⚠️ Areas Requiring Special Care

#### Theme System
- Theme must be set on `<html>` element, not `<body>`
- Must work without JavaScript (inline script in head)
- Must persist to localStorage on toggle
- Must respect system color scheme changes
- Must sync toggle state after PJAX navigation

#### PJAX Navigation
When modifying navigation logic:
1. Always call `reinitScripts()` after DOM update
2. Handle fetch errors (fallback to full page load)
3. Update `history.pushState` correctly
4. Normalize paths before comparison
5. Re-attach event listeners for dynamic content

#### Partials System
- Partials loaded asynchronously on page load
- Must complete before other initializations
- Uses `await loadPartials()` at top of DOMContentLoaded
- Failures silently ignored (graceful degradation)

#### Animation Performance
- GSAP is loaded via CDN - always check `typeof gsap !== "undefined"`
- Use `requestAnimationFrame` for continuous animations
- Clean up RAF IDs on element leave
- Respect `prefers-reduced-motion`

### Common Pitfalls

1. **Adding card tilt to dynamically loaded content**
   Must call `initCardTilt()` after PJAX navigation (already done in `reinitScripts`)

2. **Navigation underline position incorrect**
   Ensure `initNavUnderline()` called after header partial loads

3. **Theme toggle not working after navigation**
   Must call `syncThemeToggle()` in `reinitScripts()` (already done)

4. **Fade-in animations not working on new page**
   IntersectionObserver must be reinitialized (already done in `reinitScripts`)

5. **Links opening in new tab or navigating away**
   PJAX excludes links with `target` attribute or hash-only hrefs

## Common Tasks

### Adding a New Page

1. **Create HTML file** in root (e.g., `contact.html`)
   ```html
   <!DOCTYPE html>
   <html class="no-js" lang="ja" data-theme="light">
   <head>
     <!-- Copy head from index.html -->
     <title>Contact - yunoxia.one</title>
   </head>
   <body>
     <header data-include="partials/header.html"></header>
     <main id="pjax-container">
       <section class="page fade-in">
         <h2>Contact</h2>
         <p>Your content here</p>
       </section>
     </main>
     <footer data-include="partials/footer.html"></footer>
     <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
     <script src="assets/js/app.js" defer></script>
   </body>
   </html>
   ```

2. **Add link to navigation** in `partials/header.html`
   ```html
   <a href="contact.html" class="nav-link">Contact</a>
   ```

3. **Test**:
   - Direct navigation works
   - PJAX navigation works
   - Active state highlights correctly
   - Theme persists across navigation

### Adding a New Theme Color

1. **Update CSS variables** in `assets/css/style.css`:
   ```css
   [data-theme="light"] {
     --new-color: #value;
   }

   [data-theme="dark"] {
     --new-color: #value;
   }
   ```

2. **Use in styles**:
   ```css
   .element {
     color: var(--new-color);
   }
   ```

### Adding Interactive Component

1. **Create initialization function** in `assets/js/app.js`:
   ```javascript
   const initMyComponent = () => {
     document.querySelectorAll(".my-component").forEach(el => {
       if (el.dataset.myInit) return;  // Guard against double-init
       el.dataset.myInit = "true";

       // Attach event listeners
       el.addEventListener("click", () => { /* ... */ });
     });
   };
   ```

2. **Call in initial load**:
   ```javascript
   await loadPartials();
   // ... existing inits
   initMyComponent();  // Add here
   ```

3. **Call after PJAX navigation** in `reinitScripts()`:
   ```javascript
   const reinitScripts = () => {
     // ... existing reinits
     initMyComponent();  // Add here
   };
   ```

### Modifying Animations

**Using GSAP**:
```javascript
const animateElement = () => {
  if (typeof gsap === "undefined") return;  // Always check!
  gsap.from(".element", {
    duration: 0.8,
    opacity: 0,
    y: 20,
    ease: "power2.out"
  });
};
```

**Using IntersectionObserver**:
1. Add `.fade-in` class to HTML element
2. Observer automatically picks it up via `initObserver()`
3. Triggers when element enters viewport
4. One-time animation (element unobserved after visible)

## Testing Checklist

### Manual Testing
- [ ] All pages load correctly via direct URL
- [ ] PJAX navigation works between all pages
- [ ] Navigation active state updates correctly
- [ ] Navigation underline animates smoothly
- [ ] Theme toggle switches between light/dark
- [ ] Theme preference persists after refresh
- [ ] Theme respects system preference on first visit
- [ ] Card tilt effect works on all card elements
- [ ] Fade-in animations trigger on scroll
- [ ] Route progress bar animates on navigation
- [ ] Browser back/forward buttons work with PJAX
- [ ] No FOUC (flash of unstyled content) on page load
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Keyboard navigation works (tab, enter)
- [ ] Focus states visible for accessibility

### Browser Testing
- Chrome/Edge (Chromium)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Android)

### Network Conditions
- Test PJAX navigation with slow 3G
- Verify graceful fallback on fetch errors

## File Modification Guidelines

### When Editing `app.js`
- ✅ Add new feature functions
- ✅ Enhance existing animations
- ✅ Improve performance optimizations
- ✅ Fix bugs in navigation or theme logic
- ❌ Do not remove `loadPartials()` await
- ❌ Do not change initialization order without careful testing
- ❌ Do not assume GSAP is loaded (always check `typeof gsap`)

### When Editing `style.css`
- ✅ Add new components with theme-aware variables
- ✅ Improve responsive design
- ✅ Enhance accessibility
- ✅ Add animations (with reduced-motion media query)
- ❌ Do not hardcode colors (use CSS variables)
- ❌ Do not remove `prefers-reduced-motion` query
- ❌ Do not add vendor prefixes (unnecessary for modern browsers)

### When Editing HTML Pages
- ✅ Update content in `<main>` section
- ✅ Add `.fade-in` class to elements that should animate
- ✅ Add `.card` class for tilt effect
- ❌ Do not remove `data-include` partials
- ❌ Do not remove inline theme script from `<head>`
- ❌ Do not change GSAP CDN URL without verifying compatibility

### When Editing Partials
- ✅ Update navigation links
- ✅ Modify theme toggle appearance
- ✅ Update footer content
- ❌ Do not change element IDs (JS depends on them)
- ❌ Do not remove `nav-underline` element
- ❌ Do not change theme toggle structure (CSS tightly coupled)

## Performance Considerations

### Current Metrics
- **Total Asset Size**: ~33KB (excluding GSAP CDN)
- **JavaScript**: 271 lines, unminified
- **CSS**: 254 lines, unminified
- **No Build Step**: Zero compilation time
- **External Requests**: 2 (Google Fonts, GSAP CDN)

### Optimization Guidelines
1. **Keep assets small** - No frameworks, minimal dependencies
2. **Lazy load images** if adding media content
3. **Use modern CSS** instead of JS where possible
4. **Debounce/throttle** resize/scroll handlers if adding more
5. **Avoid layout thrashing** in animation loops
6. **Use CSS containment** for isolated components if needed

## Accessibility Notes

### Current Accessibility Features
- Semantic HTML (`<header>`, `<nav>`, `<main>`, `<footer>`)
- `.sr-only` class for screen reader content
- `aria-hidden="true"` for decorative elements
- `lang="ja"` attribute for language declaration
- `prefers-reduced-motion` respected
- Keyboard navigation support
- Focus-visible states for interactive elements

### When Adding Features
- Always provide text alternatives for icons/images
- Ensure keyboard accessibility for interactive elements
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Maintain color contrast ratios (WCAG AA minimum)
- Provide skip links if adding more complex navigation

## Debugging Tips

### Theme Not Applying
1. Check browser console for localStorage errors
2. Verify `data-theme` attribute on `<html>` element
3. Confirm CSS custom properties defined for both themes
4. Check if inline script in `<head>` executed correctly

### PJAX Navigation Broken
1. Check console for fetch errors
2. Verify target page has `<main id="pjax-container">` element
3. Confirm `reinitScripts()` is called after content update
4. Test with network throttling (may fail silently and fall back)

### Animations Not Working
1. Check if GSAP loaded (open console, type `gsap`)
2. Verify elements have correct classes (`.fade-in`, `.card`)
3. Check if `IntersectionObserver` supported (IE11 not supported)
4. Ensure `prefers-reduced-motion` not blocking animations

### Navigation Underline Misaligned
1. Confirm header partial loaded before `initNavUnderline()` called
2. Check if active link exists (underline follows active link)
3. Verify resize handler registered
4. Test after window resize event

## Version Control & Collaboration

### Branch Naming
- Feature branches: `codex/[feature-name]` or `claude/[feature-name]`
- Use descriptive names: `codex/add-contact-form`

### Commit Messages
- Mix of English and Japanese acceptable (project style)
- Be descriptive about what changed and why
- Reference issue/PR numbers if applicable

### Pull Request Workflow
1. Create feature branch from main
2. Make changes and commit with clear messages
3. Test locally before pushing
4. Create PR with description of changes
5. Merge after review

## Dependencies & External Resources

### CDN Dependencies
- **GSAP 3**: `https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js`
  - Used for: Navigation animation, main content fade-in
  - Loaded on every page
  - Gracefully degraded if unavailable

### Google Fonts
- **Noto Sans JP**: Japanese text rendering
- **Outfit**: English headings and body text
- Loaded via Google Fonts API with `display=swap`

### Updating Dependencies
**GSAP**: Change CDN URL in all HTML files (5 locations)
**Fonts**: Update `<link>` tag in all HTML files

**⚠️ Warning**: Changing GSAP version may break animations. Test thoroughly.

## Project Philosophy

Understanding the project's design philosophy helps make appropriate decisions:

1. **Simplicity over features** - Avoid adding unnecessary complexity
2. **Performance over convenience** - No build step means instant iteration
3. **Vanilla over frameworks** - Educational value, full control, tiny footprint
4. **Progressive enhancement** - Works without JavaScript (partially)
5. **Modern APIs** - Use new browser features, no IE11 support needed
6. **Accessibility first** - Semantic HTML, ARIA, keyboard support, reduced motion
7. **Bilingual support** - Japanese and English content coexist naturally

## Helpful Resources

- **GSAP Documentation**: https://greensock.com/docs/
- **MDN Web Docs**: https://developer.mozilla.org/
- **Intersection Observer**: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
- **History API**: https://developer.mozilla.org/en-US/docs/Web/API/History_API
- **CSS Custom Properties**: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties

## Questions & Support

For questions about this codebase:
1. Read this CLAUDE.md thoroughly
2. Examine the referenced source files
3. Check git commit history for context on changes
4. Test changes locally before committing

---

**Last Updated**: 2025-11-17
**Maintained By**: yuta1558 / yunoxia.one
**Purpose**: Guide AI assistants in maintaining and enhancing this codebase
