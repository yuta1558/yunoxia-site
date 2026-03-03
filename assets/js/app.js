/**
 * yunoxia.one — Main Application
 * Redesign: "Signal / 信号"
 *
 * Vanilla JavaScript SPA with PJAX navigation.
 * Features: theme switching, stagger animations, signal effects,
 * cursor follower, card tilt, toast system.
 */

// =============================================================================
// Constants
// =============================================================================

const CONFIG = {
  ANIMATION: {
    NAV_DURATION: 0.5,
    NAV_STAGGER: 0.08,
    NAV_DELAY: 0.15,
    MAIN_DURATION: 0.7,
    MAIN_Y_OFFSET: 24,
    PROGRESS_DURATION: 400,
    PROGRESS_COMPLETE_DELAY: 480,
  },
  CARD_TILT: {
    MAX_ROTATION: 4,
  },
  THROTTLE: {
    RESIZE: 100,
    SCROLL: 16,
    CARD_MOVE: 16,
  },
  SELECTORS: {
    ROOT: 'html',
    CONTAINER: 'main',
    NAV: 'nav',
    NAV_LINKS: '.nav-link',
    NAV_UNDERLINE: '.nav-underline',
    THEME_TOGGLE: '#theme-toggle',
    ROUTE_PROGRESS: '#routeProgress',
    FADE_IN: '.fade-in',
    STAGGER: '.stagger',
    CARD: '.card',
    PARTIAL_INCLUDE: '[data-include]',
  },
  CLASSES: {
    NO_JS: 'no-js',
    ACTIVE: 'active',
    VISIBLE: 'visible',
    TILTING: 'is-tilting',
  },
  STORAGE_KEYS: {
    THEME: 'theme',
  },
};

// =============================================================================
// Application State
// =============================================================================

const state = {
  elements: {
    root: null,
    container: null,
    nav: null,
    navUnderline: null,
    progressBar: null,
  },
  observers: {
    intersection: null,
  },
  handlers: {
    linkClick: null,
    navMouseOver: null,
    navMouseOut: null,
    navResize: null,
    themeToggle: null,
  },
  flags: {
    navUnderlineInitialized: false,
  },
};

// =============================================================================
// Utilities
// =============================================================================

const throttle = (func, wait) => {
  let timeoutId = null;
  let lastExecuted = 0;

  return function throttled(...args) {
    const now = Date.now();
    const elapsed = now - lastExecuted;

    const execute = () => {
      lastExecuted = now;
      func.apply(this, args);
    };

    if (elapsed >= wait) {
      execute();
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(execute, wait - elapsed);
    }
  };
};

const normalizePath = (url) => {
  const { pathname } = new URL(url, location.href);
  if (pathname === '/' || pathname === '') return '/index.html';
  if (pathname.endsWith('/')) return `${pathname}index.html`;
  return pathname;
};

const query = (selector, context = document) => {
  try { return context.querySelector(selector); }
  catch { return null; }
};

const queryAll = (selector, context = document) => {
  try { return context.querySelectorAll(selector); }
  catch { return []; }
};

// =============================================================================
// Navigation Module
// =============================================================================

const Navigation = {
  moveUnderlineTo(element) {
    const { nav, navUnderline } = state.elements;
    if (!nav || !navUnderline || !element) return;

    const { left, width } = element.getBoundingClientRect();
    const navLeft = nav.getBoundingClientRect().left;

    navUnderline.style.width = `${width}px`;
    navUnderline.style.transform = `translateX(${left - navLeft}px)`;
  },

  handleMouseOver(event) {
    const { nav } = state.elements;
    if (!nav) return;
    const link = event.target.closest(CONFIG.SELECTORS.NAV_LINKS);
    if (link && nav.contains(link)) {
      Navigation.moveUnderlineTo(link);
    }
  },

  handleMouseOut() {
    const { nav } = state.elements;
    if (!nav) return;
    const activeLink = query(`${CONFIG.SELECTORS.NAV_LINKS}.${CONFIG.CLASSES.ACTIVE}`, nav);
    if (activeLink) Navigation.moveUnderlineTo(activeLink);
  },

  handleResize() {
    const { nav } = state.elements;
    if (!nav) return;
    const activeLink = query(`${CONFIG.SELECTORS.NAV_LINKS}.${CONFIG.CLASSES.ACTIVE}`, nav);
    if (activeLink) Navigation.moveUnderlineTo(activeLink);
  },

  init() {
    state.elements.nav = query(CONFIG.SELECTORS.NAV);
    state.elements.navUnderline = query(CONFIG.SELECTORS.NAV_UNDERLINE);
    const { nav, navUnderline } = state.elements;
    if (!nav || !navUnderline) return;

    if (!state.flags.navUnderlineInitialized) {
      state.handlers.navMouseOver = Navigation.handleMouseOver.bind(Navigation);
      state.handlers.navMouseOut = Navigation.handleMouseOut.bind(Navigation);
      state.handlers.navResize = throttle(Navigation.handleResize.bind(Navigation), CONFIG.THROTTLE.RESIZE);

      nav.addEventListener('mouseover', state.handlers.navMouseOver);
      nav.addEventListener('mouseout', state.handlers.navMouseOut);
      window.addEventListener('resize', state.handlers.navResize);
      state.flags.navUnderlineInitialized = true;
    }

    const activeLink = query(`${CONFIG.SELECTORS.NAV_LINKS}.${CONFIG.CLASSES.ACTIVE}`, nav);
    if (activeLink) Navigation.moveUnderlineTo(activeLink);
  },

  setActive(url = location.href) {
    if (!state.elements.nav) state.elements.nav = query(CONFIG.SELECTORS.NAV);
    if (!state.elements.nav) return;

    const navLinks = queryAll(CONFIG.SELECTORS.NAV_LINKS, state.elements.nav);
    const targetPath = normalizePath(url);
    let activeLink = null;

    navLinks.forEach((link) => {
      const isActive = normalizePath(link.href) === targetPath;
      link.classList.toggle(CONFIG.CLASSES.ACTIVE, isActive);
      if (isActive) activeLink = link;
    });

    if (activeLink) {
      this.init();
      this.moveUnderlineTo(activeLink);
    }
  },
};

// =============================================================================
// Theme Module (button-based toggle)
// =============================================================================

const Theme = {
  apply(theme, persist = false) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    if (state.elements.root) {
      state.elements.root.setAttribute('data-theme', resolved);
    }
    if (persist) {
      try { localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, resolved); }
      catch { /* ignore */ }
    }
  },

  syncToggle() {
    const btn = query(CONFIG.SELECTORS.THEME_TOGGLE);
    if (!btn) return;

    if (state.handlers.themeToggle) {
      btn.removeEventListener('click', state.handlers.themeToggle);
    }

    state.handlers.themeToggle = () => {
      const current = state.elements.root?.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      Theme.apply(next, true);
    };

    btn.addEventListener('click', state.handlers.themeToggle);
  },

  init() {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    let stored = null;
    try { stored = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME); }
    catch { /* ignore */ }

    const initialTheme = stored || (media.matches ? 'dark' : 'light');
    this.apply(initialTheme);
    this.syncToggle();

    const handleSchemeChange = (event) => {
      try { if (localStorage.getItem(CONFIG.STORAGE_KEYS.THEME)) return; }
      catch { /* ignore */ }
      Theme.apply(event.matches ? 'dark' : 'light');
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleSchemeChange);
    }
  },
};

// =============================================================================
// PJAX Module
// =============================================================================

const PJAX = {
  showProgress() {
    const bar = query(CONFIG.SELECTORS.ROUTE_PROGRESS);
    if (!bar) return;
    const { PROGRESS_DURATION, PROGRESS_COMPLETE_DELAY } = CONFIG.ANIMATION;

    bar.style.transition = 'none';
    bar.style.width = '0%';

    requestAnimationFrame(() => {
      bar.style.transition = `width ${PROGRESS_DURATION}ms ease`;
      bar.style.width = '100%';
      setTimeout(() => {
        bar.style.transition = 'none';
        bar.style.width = '0%';
      }, PROGRESS_COMPLETE_DELAY);
    });
  },

  async loadContent(url, pushState = true) {
    this.showProgress();
    EnhancedPageTransition.show();
    Navigation.setActive(url);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newContent = query(CONFIG.SELECTORS.CONTAINER, doc);

      if (!newContent) throw new Error('Container not found');

      await new Promise(resolve => setTimeout(resolve, 180));

      if (state.elements.container) {
        state.elements.container.innerHTML = newContent.innerHTML;
      }

      if (pushState) window.history.pushState(null, '', url);
      window.scrollTo(0, 0);
      this.reinitialize();

      setTimeout(() => EnhancedPageTransition.hide(), 80);
    } catch (error) {
      console.error('PJAX failed:', error);
      EnhancedPageTransition.hide();
      window.location.href = url;
    }
  },

  reinitialize() {
    Animation.initObserver();
    Animation.animateMain();
    Stagger.init();
    CardTilt.init();
    Navigation.setActive(location.href);
    Theme.syncToggle();
    ScrollProgress.update();
    ScrollToTop.update();
  },

  initLinks() {
    if (state.handlers.linkClick) {
      document.removeEventListener('click', state.handlers.linkClick);
    }

    state.handlers.linkClick = (event) => {
      const link = event.target.closest('a:not([target]):not([href^="#"])');
      if (!link) return;

      try {
        const linkUrl = new URL(link.href);
        if (linkUrl.origin !== location.origin) return;
      } catch { return; }

      event.preventDefault();
      PJAX.loadContent(link.href);
    };

    document.addEventListener('click', state.handlers.linkClick);
  },

  initPopState() {
    window.addEventListener('popstate', () => {
      PJAX.loadContent(location.href, false);
    });
  },

  init() {
    this.initLinks();
    this.initPopState();
  },
};

// =============================================================================
// Animation Module
// =============================================================================

const Animation = {
  initObserver() {
    if (state.observers.intersection) {
      state.observers.intersection.disconnect();
    }

    state.observers.intersection = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(CONFIG.CLASSES.VISIBLE);
          state.observers.intersection.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    const elements = queryAll(`${CONFIG.SELECTORS.FADE_IN}, ${CONFIG.SELECTORS.STAGGER}`, state.elements.container);
    elements.forEach((el) => {
      state.observers.intersection.observe(el);
    });
  },

  animateNav() {
    if (typeof gsap === 'undefined') return;
    const { NAV_DURATION, NAV_STAGGER, NAV_DELAY } = CONFIG.ANIMATION;

    gsap.from('.nav-link', {
      duration: NAV_DURATION,
      y: -8,
      opacity: 0,
      stagger: NAV_STAGGER,
      delay: NAV_DELAY,
      ease: 'power2.out',
    });
  },

  animateMain() {
    if (typeof gsap === 'undefined') return;
    const { MAIN_DURATION, MAIN_Y_OFFSET } = CONFIG.ANIMATION;

    gsap.from(state.elements.container, {
      duration: MAIN_DURATION,
      y: MAIN_Y_OFFSET,
      opacity: 0,
      ease: 'power2.out',
    });
  },
};

// =============================================================================
// Stagger Module - assigns --i CSS variable for stagger delay
// =============================================================================

const Stagger = {
  init() {
    const container = state.elements.container || document;
    const elements = queryAll(CONFIG.SELECTORS.STAGGER, container);
    elements.forEach((el, i) => {
      el.style.setProperty('--i', i);
    });
  },
};

// =============================================================================
// Card Tilt Module
// =============================================================================

const CardTilt = {
  init() {
    const cards = queryAll(CONFIG.SELECTORS.CARD);
    cards.forEach((card) => {
      if (card.dataset.tiltInit) return;
      card.dataset.tiltInit = 'true';

      let rafId = null;
      let rx = 0;
      let ry = 0;
      const max = CONFIG.CARD_TILT.MAX_ROTATION;

      const applyTilt = () => {
        card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        card.classList.add(CONFIG.CLASSES.TILTING);
        rafId = null;
      };

      const handlePointerMove = (event) => {
        if (event.pointerType === 'touch') return;
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        ry = (px - 0.5) * max * 2;
        rx = -(py - 0.5) * max * 2;
        if (!rafId) rafId = requestAnimationFrame(applyTilt);
      };

      const handlePointerLeave = () => {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        card.style.transform = 'rotateX(0) rotateY(0)';
        card.classList.remove(CONFIG.CLASSES.TILTING);
      };

      card.addEventListener('pointermove', handlePointerMove);
      card.addEventListener('pointerleave', handlePointerLeave);
      card.addEventListener('pointercancel', handlePointerLeave);
    });
  },
};

// =============================================================================
// Partials Loader
// =============================================================================

const Partials = {
  async load() {
    const includes = queryAll(CONFIG.SELECTORS.PARTIAL_INCLUDE);
    for (const element of includes) {
      try {
        const path = element.getAttribute('data-include');
        if (!path) continue;
        const response = await fetch(path);
        if (response.ok) {
          element.outerHTML = await response.text();
        }
      } catch { /* graceful degradation */ }
    }
  },
};

// =============================================================================
// Service Worker
// =============================================================================

const ServiceWorkerManager = {
  async register() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New content available');
          }
        });
      });
    } catch { /* ignore */ }
  },
};

// =============================================================================
// Enhanced UX Modules
// =============================================================================

const CursorFollower = {
  init() {
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cursor = document.createElement('div');
    cursor.className = 'cursor-follower';
    document.body.appendChild(cursor);

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    const speed = 0.12;

    const move = () => {
      cursorX += (mouseX - cursorX) * speed;
      cursorY += (mouseY - cursorY) * speed;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
      requestAnimationFrame(move);
    };

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursor.classList.add('active');
    });

    document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
    document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
    document.addEventListener('mouseleave', () => cursor.classList.remove('active'));

    move();
  },
};

const ScrollProgress = {
  indicator: null,

  update() {
    if (!this.indicator) return;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = h > 0 ? (window.pageYOffset / h) : 0;
    this.indicator.style.transform = `scaleX(${pct})`;
  },

  init() {
    this.indicator = document.createElement('div');
    this.indicator.className = 'scroll-progress';
    document.body.appendChild(this.indicator);

    const throttledUpdate = throttle(this.update.bind(this), CONFIG.THROTTLE.SCROLL);
    window.addEventListener('scroll', throttledUpdate);
    this.update();
  },
};

const ScrollToTop = {
  button: null,

  update() {
    if (!this.button) return;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    this.button.classList.toggle('visible', scrollTop > 300);
  },

  init() {
    this.button = document.createElement('button');
    this.button.className = 'scroll-to-top';
    this.button.innerHTML = '&#8593;';
    this.button.setAttribute('aria-label', 'ページトップへ戻る');
    this.button.type = 'button';
    document.body.appendChild(this.button);

    this.button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const throttledUpdate = throttle(this.update.bind(this), 100);
    window.addEventListener('scroll', throttledUpdate);
    this.update();
  },
};

const ToastNotification = {
  container: null,

  createContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.setAttribute('role', 'status');
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    }
  },

  show(title, message = '', type = 'info', duration = 3000) {
    this.createContainer();
    const icons = { success: '&#10003;', error: '&#10005;', info: '&#8505;', warning: '&#9888;' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type]}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },
};

const Tooltip = {
  show(trigger) {
    const text = trigger.dataset.tooltip;
    if (!text) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.setAttribute('role', 'tooltip');
    trigger.appendChild(tooltip);

    tooltip.style.bottom = 'calc(100% + 0.5rem)';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';

    requestAnimationFrame(() => tooltip.classList.add('visible'));
  },

  hide(trigger) {
    const tooltip = trigger.querySelector('.tooltip');
    if (tooltip) {
      tooltip.classList.remove('visible');
      setTimeout(() => tooltip.remove(), 200);
    }
  },

  init() {
    document.addEventListener('mouseenter', (e) => {
      const trigger = e.target.closest('[data-tooltip]');
      if (trigger) this.show(trigger);
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const trigger = e.target.closest('[data-tooltip]');
      if (trigger) this.hide(trigger);
    }, true);
  },
};

const Lightbox = {
  lightbox: null,

  open(src) {
    if (!this.lightbox) {
      this.lightbox = document.createElement('div');
      this.lightbox.className = 'lightbox';
      this.lightbox.innerHTML = `
        <div class="lightbox-content">
          <button class="lightbox-close" aria-label="閉じる" type="button">&times;</button>
          <img class="lightbox-image" alt="Lightbox" />
        </div>
      `;
      document.body.appendChild(this.lightbox);

      this.lightbox.addEventListener('click', (e) => {
        if (e.target === this.lightbox || e.target.classList.contains('lightbox-close')) {
          this.close();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.lightbox.classList.contains('active')) {
          this.close();
        }
      });
    }

    this.lightbox.querySelector('.lightbox-image').src = src;
    requestAnimationFrame(() => {
      this.lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  },

  close() {
    if (this.lightbox) {
      this.lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  init() {
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img[data-lightbox]');
      if (img) { e.preventDefault(); this.open(img.src); }
    });
  },
};

const SmoothScroll = {
  init() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || !link.hash) return;

      if (link.hash === '#' || link.hash === '#top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const el = query(link.hash);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  },
};

const CopyToClipboard = {
  async copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      this.showFeedback(button, 'Copied!');
      ToastNotification.show('Copied', text, 'success', 2000);
    } catch {
      ToastNotification.show('Copy failed', '', 'error', 2000);
    }
  },

  showFeedback(button, message) {
    let feedback = button.querySelector('.copy-feedback');
    if (!feedback) {
      feedback = document.createElement('span');
      feedback.className = 'copy-feedback';
      button.appendChild(feedback);
    }
    feedback.textContent = message;
    feedback.classList.add('visible');
    setTimeout(() => feedback.classList.remove('visible'), 2000);
  },

  init() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-copy]');
      if (btn) this.copy(btn.dataset.copy, btn);
    });
  },
};

const EnhancedPageTransition = {
  overlay: null,
  spinner: null,

  createElements() {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'page-transition';
      document.body.appendChild(this.overlay);
    }
    if (!this.spinner) {
      this.spinner = document.createElement('div');
      this.spinner.className = 'loading-spinner';
      document.body.appendChild(this.spinner);
    }
  },

  show() {
    this.createElements();
    requestAnimationFrame(() => {
      this.overlay.classList.add('active');
      this.spinner.classList.add('active');
    });
  },

  hide() {
    if (this.overlay) this.overlay.classList.remove('active');
    if (this.spinner) this.spinner.classList.remove('active');
  },
};

// =============================================================================
// Logo Character Animation
// =============================================================================

const LogoAnimation = {
  init() {
    if (typeof gsap === 'undefined') return;

    const chars = queryAll('.logo-char');
    if (chars.length === 0) return;

    gsap.from(chars, {
      duration: 0.6,
      y: -20,
      opacity: 0,
      stagger: 0.06,
      delay: 0.1,
      ease: 'power3.out',
    });
  },
};

// =============================================================================
// Application Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  state.elements.root = query(CONFIG.SELECTORS.ROOT);

  if (state.elements.root) {
    state.elements.root.classList.remove(CONFIG.CLASSES.NO_JS);
  }

  // Load partials (header/footer)
  await Partials.load();

  // Init state elements
  state.elements.container = query(CONFIG.SELECTORS.CONTAINER);
  state.elements.progressBar = query(CONFIG.SELECTORS.ROUTE_PROGRESS);

  // Core modules
  Navigation.init();
  Navigation.setActive(location.href);
  Theme.init();
  CardTilt.init();
  Stagger.init();
  Animation.initObserver();
  LogoAnimation.init();
  Animation.animateNav();
  PJAX.init();

  // Enhanced UX modules
  CursorFollower.init();
  ScrollProgress.init();
  Tooltip.init();
  Lightbox.init();
  SmoothScroll.init();
  ScrollToTop.init();
  CopyToClipboard.init();

  // PWA
  ServiceWorkerManager.register();
});
