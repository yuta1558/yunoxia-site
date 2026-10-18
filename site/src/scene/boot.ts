// Decides whether the top scene runs at all, and loads it only after first paint and first engagement.
// Reduced motion or no WebGL: three.js is never requested and the static illustration stays.

import type { SceneHandle } from './scene';

const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

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

export function boot() {
  const root = document.querySelector<HTMLElement>('[data-top-scene]');
  const canvas = root?.querySelector<HTMLCanvasElement>('canvas');
  if (!root || !canvas) return;

  let handle: SceneHandle | null = null;
  let loading = false;

  const run = () => {
    if (handle || loading || reduceQuery.matches || !hasWebGL()) return;
    loading = true;
    afterEngagement(async () => {
      try {
        const { start } = await import('./scene');
        if (reduceQuery.matches) return;
        handle = await start(root, canvas);
      } catch (err) {
        console.warn('[top-scene] disabled:', err);
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
