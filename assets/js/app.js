/**
 * yunoxia.one - Main Application
 * Vanilla JavaScript SPA with PJAX navigation
 *
 * Features:
 * - PJAX (pushState + AJAX) navigation
 * - Theme switching (light/dark)
 * - Smooth animations with GSAP
 * - Scroll-triggered fade-in effects
 * - 3D card tilt on hover
 * - Progressive enhancement
 */

// =============================================================================
// Constants / 定数
// =============================================================================

const CONFIG = {
  ANIMATION: {
    NAV_DURATION: 0.5,
    NAV_STAGGER: 0.1,
    NAV_DELAY: 0.2,
    MAIN_DURATION: 0.8,
    MAIN_Y_OFFSET: 30,
    PROGRESS_DURATION: 400,
    PROGRESS_COMPLETE_DELAY: 480,
  },
  CARD_TILT: {
    MAX_ROTATION: 4,
  },
  THROTTLE: {
    RESIZE: 100,
    CARD_MOVE: 16, // ~60fps
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
// Application State / アプリケーション状態
// =============================================================================

const state = {
  elements: {
    root: null,
    container: null,
    nav: null,
    navUnderline: null,
    themeToggle: null,
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
// Utility Functions / ユーティリティ関数
// =============================================================================

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in ms
 * @returns {Function} Throttled function
 */
const throttle = (func, wait) => {
  let timeoutId = null;
  let lastExecuted = 0;

  return function throttled(...args) {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted;

    const execute = () => {
      lastExecuted = now;
      func.apply(this, args);
    };

    if (timeSinceLastExecution >= wait) {
      execute();
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(execute, wait - timeSinceLastExecution);
    }
  };
};

/**
 * Normalize URL path for comparison
 * Handles trailing slashes and index.html
 * @param {string} url - URL to normalize
 * @returns {string} Normalized path
 */
const normalizePath = (url) => {
  const { pathname } = new URL(url, location.href);

  if (pathname === '/' || pathname === '') {
    return `${pathname === '' ? '/' : pathname}index.html`;
  }

  if (pathname.endsWith('/')) {
    return `${pathname}index.html`;
  }

  return pathname;
};

/**
 * Safely query a single element
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {Element|null}
 */
const query = (selector, context = document) => {
  try {
    return context.querySelector(selector);
  } catch (error) {
    console.warn(`Invalid selector: ${selector}`, error);
    return null;
  }
};

/**
 * Safely query multiple elements
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {NodeList}
 */
const queryAll = (selector, context = document) => {
  try {
    return context.querySelectorAll(selector);
  } catch (error) {
    console.warn(`Invalid selector: ${selector}`, error);
    return [];
  }
};

// =============================================================================
// Navigation Module / ナビゲーション
// =============================================================================

const Navigation = {
  /**
   * Move underline to specified element
   * @param {Element} element - Target navigation link
   */
  moveUnderlineTo(element) {
    const { nav, navUnderline } = state.elements;

    if (!nav || !navUnderline || !element) return;

    const { left, width } = element.getBoundingClientRect();
    const navLeft = nav.getBoundingClientRect().left;

    navUnderline.style.width = `${width}px`;
    navUnderline.style.transform = `translateX(${left - navLeft}px)`;
  },

  /**
   * Handle navigation mouse over
   * @param {MouseEvent} event
   */
  handleMouseOver(event) {
    const { nav } = state.elements;
    if (!nav) return;

    const link = event.target.closest(CONFIG.SELECTORS.NAV_LINKS);
    if (link && nav.contains(link)) {
      Navigation.moveUnderlineTo(link);
    }
  },

  /**
   * Handle navigation mouse out
   * Reset underline to active link
   */
  handleMouseOut() {
    const { nav } = state.elements;
    if (!nav) return;

    const activeLink = query(
      `${CONFIG.SELECTORS.NAV_LINKS}.${CONFIG.CLASSES.ACTIVE}`,
      nav
    );

    if (activeLink) {
      Navigation.moveUnderlineTo(activeLink);
    }
  },

  /**
   * Handle window resize
   * Reposition underline to active link
   */
  handleResize() {
    const { nav } = state.elements;
    if (!nav) return;

    const activeLink = query(
      `${CONFIG.SELECTORS.NAV_LINKS}.${CONFIG.CLASSES.ACTIVE}`,
      nav
    );

    if (activeLink) {
      Navigation.moveUnderlineTo(activeLink);
    }
  },

  /**
   * Initialize navigation underline
   */
  init() {
    state.elements.nav = query(CONFIG.SELECTORS.NAV);
    state.elements.navUnderline = query(CONFIG.SELECTORS.NAV_UNDERLINE);

    const { nav, navUnderline } = state.elements;

    if (!nav || !navUnderline) return;

    // Attach event listeners only once
    if (!state.flags.navUnderlineInitialized) {
      state.handlers.navMouseOver = Navigation.handleMouseOver.bind(Navigation);
      state.handlers.navMouseOut = Navigation.handleMouseOut.bind(Navigation);
      state.handlers.navResize = throttle(
        Navigation.handleResize.bind(Navigation),
        CONFIG.THROTTLE.RESIZE
      );

      nav.addEventListener('mouseover', state.handlers.navMouseOver);
      nav.addEventListener('mouseout', state.handlers.navMouseOut);
      window.addEventListener('resize', state.handlers.navResize);

      state.flags.navUnderlineInitialized = true;
    }

    // Position underline to active link
    const activeLink = query(
      `${CONFIG.SELECTORS.NAV_LINKS}.${CONFIG.CLASSES.ACTIVE}`,
      nav
    );

    if (activeLink) {
      Navigation.moveUnderlineTo(activeLink);
    }
  },

  /**
   * Set active navigation link
   * @param {string} url - Current page URL
   */
  setActive(url = location.href) {
    const { nav } = state.elements;
    if (!nav) {
      state.elements.nav = query(CONFIG.SELECTORS.NAV);
    }

    if (!state.elements.nav) return;

    const navLinks = queryAll(CONFIG.SELECTORS.NAV_LINKS, state.elements.nav);
    const targetPath = normalizePath(url);
    let activeLink = null;

    navLinks.forEach((link) => {
      const isActive = normalizePath(link.href) === targetPath;
      link.classList.toggle(CONFIG.CLASSES.ACTIVE, isActive);

      if (isActive) {
        activeLink = link;
      }
    });

    if (activeLink) {
      this.init();
      this.moveUnderlineTo(activeLink);
    }
  },
};

// =============================================================================
// Theme Module / テーマ管理
// =============================================================================

const Theme = {
  /**
   * Apply theme to document
   * @param {string} theme - 'light' or 'dark'
   * @param {boolean} persist - Save to localStorage
   */
  apply(theme, persist = false) {
    const resolved = theme === 'dark' ? 'dark' : 'light';

    if (state.elements.root) {
      state.elements.root.setAttribute('data-theme', resolved);
    }

    if (persist) {
      try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, resolved);
      } catch (error) {
        console.warn('Failed to save theme preference:', error);
      }
    }
  },

  /**
   * Sync theme toggle checkbox with current theme
   */
  syncToggle() {
    const checkbox = query(CONFIG.SELECTORS.THEME_TOGGLE);
    if (!checkbox) return;

    const currentTheme = state.elements.root?.getAttribute('data-theme');
    checkbox.checked = currentTheme === 'dark';

    // Remove old listener and add new one
    if (state.handlers.themeToggle) {
      checkbox.removeEventListener('change', state.handlers.themeToggle);
    }

    state.handlers.themeToggle = (event) => {
      const nextTheme = event.target.checked ? 'dark' : 'light';
      Theme.apply(nextTheme, true);
    };

    checkbox.addEventListener('change', state.handlers.themeToggle);
  },

  /**
   * Initialize theme system
   */
  init() {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    let stored = null;
    try {
      stored = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME);
    } catch (error) {
      console.warn('Failed to read theme preference:', error);
    }

    const initialTheme = stored || (media.matches ? 'dark' : 'light');
    this.apply(initialTheme);
    this.syncToggle();

    // Listen for system theme changes
    const handleSchemeChange = (event) => {
      // Only apply system theme if user hasn't set a preference
      try {
        if (localStorage.getItem(CONFIG.STORAGE_KEYS.THEME)) return;
      } catch {
        // If localStorage is not available, ignore
      }

      Theme.apply(event.matches ? 'dark' : 'light');
      Theme.syncToggle();
    };

    // Support both modern and legacy API
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleSchemeChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(handleSchemeChange);
    }
  },
};

// =============================================================================
// PJAX Module / PJAX ナビゲーション
// =============================================================================

const PJAX = {
  /**
   * Show route progress bar
   */
  showProgress() {
    const progressBar = query(CONFIG.SELECTORS.ROUTE_PROGRESS);
    if (!progressBar) return;

    const { PROGRESS_DURATION, PROGRESS_COMPLETE_DELAY } = CONFIG.ANIMATION;

    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';

    requestAnimationFrame(() => {
      progressBar.style.transition = `width ${PROGRESS_DURATION}ms ease`;
      progressBar.style.width = '100%';

      setTimeout(() => {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
      }, PROGRESS_COMPLETE_DELAY);
    });
  },

  /**
   * Load content via AJAX
   * @param {string} url - Page URL to load
   * @param {boolean} pushState - Whether to update browser history
   */
  async loadContent(url, pushState = true) {
    this.showProgress();
    EnhancedPageTransition.show();
    Navigation.setActive(url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newContent = query(CONFIG.SELECTORS.CONTAINER, doc);

      if (!newContent) {
        throw new Error('Main content container not found in response');
      }

      // Delay for transition effect
      await new Promise(resolve => setTimeout(resolve, 200));

      if (state.elements.container) {
        state.elements.container.innerHTML = newContent.innerHTML;
      }

      if (pushState) {
        window.history.pushState(null, '', url);
      }

      // Scroll to top
      window.scrollTo(0, 0);

      // Reinitialize dynamic features
      this.reinitialize();

      // Hide transition
      setTimeout(() => {
        EnhancedPageTransition.hide();
      }, 100);
    } catch (error) {
      console.error('PJAX navigation failed:', error);
      EnhancedPageTransition.hide();
      // Fallback to full page load
      window.location.href = url;
    }
  },

  /**
   * Reinitialize scripts after content load
   */
  reinitialize() {
    Animation.initObserver();
    Animation.animateMain();
    CardTilt.init();
    Navigation.setActive(location.href);
    Theme.syncToggle();
    TextAnimation.init();
    ParallaxEffect.update();
    ScrollProgress.update();
    ScrollToTop.update();
  },

  /**
   * Initialize PJAX link interception
   */
  initLinks() {
    // Remove old listener
    if (state.handlers.linkClick) {
      document.removeEventListener('click', state.handlers.linkClick);
    }

    state.handlers.linkClick = (event) => {
      // Find closest link, excluding external links and hash-only links
      const link = event.target.closest('a:not([target]):not([href^="#"])');

      if (!link) return;

      // Only intercept same-origin links
      try {
        const linkUrl = new URL(link.href);
        if (linkUrl.origin !== location.origin) return;
      } catch {
        return;
      }

      event.preventDefault();
      PJAX.loadContent(link.href);
    };

    document.addEventListener('click', state.handlers.linkClick);
  },

  /**
   * Initialize popstate handler for browser back/forward
   */
  initPopState() {
    window.addEventListener('popstate', () => {
      PJAX.loadContent(location.href, false);
    });
  },

  /**
   * Initialize PJAX system
   */
  init() {
    this.initLinks();
    this.initPopState();
  },
};

// =============================================================================
// Animation Module / アニメーション
// =============================================================================

const Animation = {
  /**
   * Initialize Intersection Observer for fade-in effects
   */
  initObserver() {
    // Disconnect previous observer
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
    });

    const fadeElements = queryAll(CONFIG.SELECTORS.FADE_IN, state.elements.container);
    fadeElements.forEach((element) => {
      state.observers.intersection.observe(element);
    });
  },

  /**
   * Animate navigation links (initial page load)
   */
  animateNav() {
    if (typeof gsap === 'undefined') {
      console.warn('GSAP not loaded, skipping navigation animation');
      return;
    }

    const { NAV_DURATION, NAV_STAGGER, NAV_DELAY } = CONFIG.ANIMATION;

    gsap.from('nav a', {
      duration: NAV_DURATION,
      y: -10,
      opacity: 0,
      stagger: NAV_STAGGER,
      delay: NAV_DELAY,
      ease: 'power2.out',
    });
  },

  /**
   * Animate main content
   */
  animateMain() {
    if (typeof gsap === 'undefined') {
      console.warn('GSAP not loaded, skipping main animation');
      return;
    }

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
// Card Tilt Module / カードチルト効果
// =============================================================================

const CardTilt = {
  /**
   * Initialize 3D tilt effect for cards
   */
  init() {
    const cards = queryAll(CONFIG.SELECTORS.CARD);

    cards.forEach((card) => {
      // Prevent double initialization
      if (card.dataset.tiltInit) return;
      card.dataset.tiltInit = 'true';

      let rafId = null;
      let rx = 0;
      let ry = 0;
      const maxRotation = CONFIG.CARD_TILT.MAX_ROTATION;

      const applyTilt = () => {
        card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        card.classList.add(CONFIG.CLASSES.TILTING);
        rafId = null;
      };

      const throttledApply = throttle(applyTilt, CONFIG.THROTTLE.CARD_MOVE);

      const handlePointerMove = (event) => {
        // Skip touch events
        if (event.pointerType === 'touch') return;

        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const dx = px - 0.5;
        const dy = py - 0.5;

        ry = dx * maxRotation * 2;
        rx = -dy * maxRotation * 2;

        if (!rafId) {
          rafId = requestAnimationFrame(applyTilt);
        }
      };

      const handlePointerLeave = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }

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
// Partials Loader / パーシャル読み込み
// =============================================================================

const Partials = {
  /**
   * Load and inject HTML partials
   */
  async load() {
    const includes = queryAll(CONFIG.SELECTORS.PARTIAL_INCLUDE);

    for (const element of includes) {
      try {
        const path = element.getAttribute('data-include');
        if (!path) continue;

        const response = await fetch(path);

        if (response.ok) {
          const html = await response.text();
          element.outerHTML = html;
        } else {
          console.warn(`Failed to load partial: ${path}`, response.status);
        }
      } catch (error) {
        console.warn('Failed to load partial:', error);
        // Silently fail - partials are enhancement
      }
    }
  },
};

// =============================================================================
// Service Worker / サービスワーカー (PWA)
// =============================================================================

const ServiceWorkerManager = {
  /**
   * Register Service Worker for PWA capabilities
   */
  async register() {
    // Check if Service Worker is supported
    if (!('serviceWorker' in navigator)) {
      console.info('Service Worker not supported in this browser');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[PWA] Service Worker registered successfully:', registration.scope);

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New content available, please refresh');
            // Optionally: Show update notification to user
          }
        });
      });
    } catch (error) {
      console.warn('[PWA] Service Worker registration failed:', error);
    }
  },

  /**
   * Unregister Service Worker (for debugging)
   */
  async unregister() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('[PWA] Service Worker unregistered');
      }
    } catch (error) {
      console.warn('[PWA] Failed to unregister Service Worker:', error);
    }
  },
};

// =============================================================================
// Enhanced UX/UI Modules / 強化されたUX/UIモジュール
// =============================================================================

const CursorFollower = {
  /**
   * Initialize cursor follower effect
   */
  init() {
    // Skip on touch devices
    if (window.matchMedia('(hover: none)').matches) return;

    const cursor = document.createElement('div');
    cursor.className = 'cursor-follower';
    document.body.appendChild(cursor);

    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    const speed = 0.15;

    const moveCursor = () => {
      const dx = mouseX - cursorX;
      const dy = mouseY - cursorY;

      cursorX += dx * speed;
      cursorY += dy * speed;

      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;

      requestAnimationFrame(moveCursor);
    };

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursor.classList.add('active');
    });

    document.addEventListener('mousedown', () => {
      cursor.classList.add('clicking');
    });

    document.addEventListener('mouseup', () => {
      cursor.classList.remove('clicking');
    });

    document.addEventListener('mouseleave', () => {
      cursor.classList.remove('active');
    });

    moveCursor();
  },
};

const RippleEffect = {
  /**
   * Create ripple effect on click
   * @param {MouseEvent} event
   */
  createRipple(event) {
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    container.appendChild(ripple);

    ripple.addEventListener('animationend', () => {
      ripple.remove();
    });
  },

  /**
   * Initialize ripple effect on elements
   */
  init() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.ripple-container');
      if (target) {
        this.createRipple(e);
      }
    });
  },
};

const ScrollProgress = {
  /**
   * Update scroll progress indicator
   */
  update() {
    const indicator = query('.scroll-progress');
    if (!indicator) return;

    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const maxScroll = documentHeight - windowHeight;
    const scrollPercent = (scrollTop / maxScroll) * 100;

    indicator.style.transform = `scaleX(${scrollPercent / 100})`;
  },

  /**
   * Initialize scroll progress indicator
   */
  init() {
    const indicator = document.createElement('div');
    indicator.className = 'scroll-progress';
    document.body.appendChild(indicator);

    const throttledUpdate = throttle(this.update.bind(this), 16);
    window.addEventListener('scroll', throttledUpdate);
    this.update();
  },
};

const ParallaxEffect = {
  /**
   * Update parallax elements
   */
  update() {
    const elements = queryAll('.parallax');
    const scrollY = window.pageYOffset;

    elements.forEach((el) => {
      const speed = parseFloat(el.dataset.parallaxSpeed || '0.5');
      const offset = scrollY * speed;
      el.style.transform = `translateY(${offset}px)`;
    });
  },

  /**
   * Initialize parallax effect
   */
  init() {
    const throttledUpdate = throttle(this.update.bind(this), 16);
    window.addEventListener('scroll', throttledUpdate);
    this.update();
  },
};

const TextAnimation = {
  /**
   * Create typing effect
   * @param {Element} element
   */
  typeText(element) {
    const text = element.dataset.typeText || element.textContent;
    element.textContent = '';
    element.style.display = 'inline-block';

    let index = 0;
    const speed = parseInt(element.dataset.typeSpeed || '50');

    const type = () => {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        setTimeout(type, speed);
      } else {
        element.style.borderRight = 'none';
      }
    };

    type();
  },

  /**
   * Fade in characters one by one
   * @param {Element} element
   */
  fadeInChars(element) {
    const text = element.textContent;
    element.textContent = '';

    Array.from(text).forEach((char, index) => {
      const span = document.createElement('span');
      span.className = 'text-fade-in-char';
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.style.animationDelay = `${index * 0.05}s`;
      element.appendChild(span);
    });
  },

  /**
   * Initialize text animations
   */
  init() {
    queryAll('[data-text-animation="typing"]').forEach((el) => {
      this.typeText(el);
    });

    queryAll('[data-text-animation="fade-chars"]').forEach((el) => {
      this.fadeInChars(el);
    });
  },
};

const ToastNotification = {
  container: null,

  /**
   * Create toast container
   */
  createContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.setAttribute('role', 'status');
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    }
  },

  /**
   * Show toast notification
   * @param {string} title
   * @param {string} message
   * @param {string} type - success, error, info, warning
   * @param {number} duration
   */
  show(title, message = '', type = 'info', duration = 3000) {
    this.createContainer();

    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠',
    };

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
  /**
   * Show tooltip
   * @param {Element} trigger
   */
  show(trigger) {
    const text = trigger.dataset.tooltip;
    if (!text) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.setAttribute('role', 'tooltip');

    trigger.appendChild(tooltip);

    // Position tooltip
    const rect = trigger.getBoundingClientRect();
    tooltip.style.bottom = 'calc(100% + 0.5rem)';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';

    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });
  },

  /**
   * Hide tooltip
   * @param {Element} trigger
   */
  hide(trigger) {
    const tooltip = trigger.querySelector('.tooltip');
    if (tooltip) {
      tooltip.classList.remove('visible');
      setTimeout(() => tooltip.remove(), 200);
    }
  },

  /**
   * Initialize tooltip system
   */
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

  /**
   * Open lightbox
   * @param {string} src - Image source
   */
  open(src) {
    if (!this.lightbox) {
      this.lightbox = document.createElement('div');
      this.lightbox.className = 'lightbox';
      this.lightbox.innerHTML = `
        <div class="lightbox-content">
          <button class="lightbox-close" aria-label="Close lightbox">×</button>
          <img class="lightbox-image" alt="Lightbox image" />
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

    const img = this.lightbox.querySelector('.lightbox-image');
    img.src = src;

    requestAnimationFrame(() => {
      this.lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  },

  /**
   * Close lightbox
   */
  close() {
    if (this.lightbox) {
      this.lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  /**
   * Initialize lightbox
   */
  init() {
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img[data-lightbox]');
      if (img) {
        e.preventDefault();
        this.open(img.src);
      }
    });
  },
};

const SmoothScroll = {
  /**
   * Scroll to target
   * @param {string} target - Selector or 'top'
   */
  scrollTo(target) {
    if (target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const element = query(target);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  },

  /**
   * Initialize smooth scroll
   */
  init() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (link && link.hash) {
        const target = link.hash;
        if (target === '#' || target === '#top') {
          e.preventDefault();
          this.scrollTo('top');
        } else {
          const element = query(target);
          if (element) {
            e.preventDefault();
            this.scrollTo(target);
          }
        }
      }
    });
  },
};

const ScrollToTop = {
  button: null,

  /**
   * Update button visibility
   */
  update() {
    if (!this.button) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > 300) {
      this.button.classList.add('visible');
    } else {
      this.button.classList.remove('visible');
    }
  },

  /**
   * Initialize scroll to top button
   */
  init() {
    this.button = document.createElement('button');
    this.button.className = 'scroll-to-top';
    this.button.innerHTML = '↑';
    this.button.setAttribute('aria-label', 'Scroll to top');
    document.body.appendChild(this.button);

    this.button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const throttledUpdate = throttle(this.update.bind(this), 100);
    window.addEventListener('scroll', throttledUpdate);
    this.update();
  },
};

const GradientMesh = {
  /**
   * Initialize animated gradient mesh background
   */
  init() {
    const mesh = document.createElement('div');
    mesh.className = 'gradient-mesh';
    mesh.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(mesh, document.body.firstChild);
  },
};

const CopyToClipboard = {
  /**
   * Copy text to clipboard
   * @param {string} text
   * @param {Element} button
   */
  async copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      this.showFeedback(button, 'Copied!');
      ToastNotification.show('Copied to clipboard', text, 'success', 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      ToastNotification.show('Copy failed', 'Please try again', 'error', 2000);
    }
  },

  /**
   * Show copy feedback
   * @param {Element} button
   * @param {string} message
   */
  showFeedback(button, message) {
    let feedback = button.querySelector('.copy-feedback');

    if (!feedback) {
      feedback = document.createElement('span');
      feedback.className = 'copy-feedback';
      button.appendChild(feedback);
    }

    feedback.textContent = message;
    feedback.classList.add('visible');

    setTimeout(() => {
      feedback.classList.remove('visible');
    }, 2000);
  },

  /**
   * Initialize copy to clipboard
   */
  init() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-copy]');
      if (button) {
        const text = button.dataset.copy;
        this.copy(text, button);
      }
    });
  },
};

const EnhancedPageTransition = {
  overlay: null,
  spinner: null,

  /**
   * Create transition elements
   */
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

  /**
   * Show transition
   */
  show() {
    this.createElements();
    requestAnimationFrame(() => {
      this.overlay.classList.add('active');
      this.spinner.classList.add('active');
    });
  },

  /**
   * Hide transition
   */
  hide() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
    if (this.spinner) {
      this.spinner.classList.remove('active');
    }
  },
};

// =============================================================================
// Application Initialization / アプリケーション初期化
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize state elements
  state.elements.root = query(CONFIG.SELECTORS.ROOT);

  // Remove no-js class
  if (state.elements.root) {
    state.elements.root.classList.remove(CONFIG.CLASSES.NO_JS);
  }

  // Load partials first (header/footer)
  await Partials.load();

  // Initialize state elements that depend on partials
  state.elements.container = query(CONFIG.SELECTORS.CONTAINER);
  state.elements.progressBar = query(CONFIG.SELECTORS.ROUTE_PROGRESS);

  // Initialize core modules
  Navigation.init();
  Navigation.setActive(location.href);
  Theme.init();
  CardTilt.init();
  Animation.initObserver();
  Animation.animateNav();
  PJAX.init();

  // Initialize enhanced UX/UI modules
  CursorFollower.init();
  RippleEffect.init();
  ScrollProgress.init();
  ParallaxEffect.init();
  TextAnimation.init();
  Tooltip.init();
  Lightbox.init();
  SmoothScroll.init();
  ScrollToTop.init();
  GradientMesh.init();
  CopyToClipboard.init();

  // Register Service Worker for PWA
  ServiceWorkerManager.register();
});
