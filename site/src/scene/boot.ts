// Decides whether the top scene runs at all, and loads it only after first paint and first engagement.
// Reduced motion or no WebGL: three.js is never requested and the static illustration stays.

import type { SceneHandle } from './scene';
import { hasWebGL } from './webgl';

const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');

const afterFirstPaint = (fn: () => void) => {
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
};

// three.js costs seconds of main-thread work on mid-range phones (parse, geometry, shader compile).
// Until the visitor engages, the static illustration says the same thing, so wait for the first scroll,
// pointer, touch or key before paying that cost.
const afterEngagement = (fn: () => void) => {
  const events = ['scroll', 'wheel', 'pointerdown', 'pointermove', 'touchstart', 'keydown'] as const;
  const go = () => {
    events.forEach((e) => removeEventListener(e, go));
    // Read by the ?fps=1 meter: the start-up cost lands on the first scroll, not on load
    (window as unknown as { __yxEngagedAt?: number }).__yxEngagedAt = performance.now();
    afterFirstPaint(fn);
  };
  events.forEach((e) => addEventListener(e, go, { once: true, passive: true }));
};

// ?fps=1: show why the scene is (not) running, for checks on a phone without devtools.
// Once the scene runs, its own frame meter (scene.ts) replaces this line.
const status = new URLSearchParams(location.search).has('fps')
  ? (() => {
      const el = document.createElement('output');
      el.dataset.sceneStatus = '';
      el.style.cssText =
        'position:fixed;left:8px;bottom:8px;z-index:99;padding:4px 8px;font:12px/1.4 ui-monospace,monospace;' +
        'background:rgb(0 0 0 / 0.7);color:#fff;border-radius:4px;pointer-events:none';
      document.body.append(el);
      return (text: string) => {
        el.textContent = `scene: ${text}`;
      };
    })()
  : () => {};

export function boot() {
  const root = document.querySelector<HTMLElement>('[data-top-scene]');
  const canvas = root?.querySelector<HTMLCanvasElement>('canvas');
  if (!root || !canvas) return;

  let handle: SceneHandle | null = null;
  let loading = false;

  const run = () => {
    if (handle || loading) return;
    if (reduceQuery.matches) return status('off (reduced motion is on in system settings)');
    if (!hasWebGL()) return status('off (WebGL unavailable)');
    loading = true;
    status('waiting for first scroll or touch');
    afterEngagement(async () => {
      status('loading…');
      try {
        const { start } = await import('./scene');
        if (reduceQuery.matches) return status('off (reduced motion is on in system settings)');
        handle = await start(root, canvas);
        document.querySelector('[data-scene-status]')?.remove();
      } catch (err) {
        console.warn('[top-scene] disabled:', err);
        status(`error: ${err instanceof Error ? err.message : String(err)}`);
        root.classList.remove('is-live');
      } finally {
        loading = false;
      }
    });
  };

  // Follow the setting live: switching to reduced motion tears the scene down
  reduceQuery.addEventListener('change', () => {
    if (reduceQuery.matches) {
      handle?.destroy();
      handle = null;
    } else {
      run();
    }
  });

  run();
}
