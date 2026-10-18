// Top page scene: a part being printed, one layer at a time (作り替える).
// The static toolpath drawing in the hero says the same thing; this makes it happen.
// Loaded lazily by boot.ts only when motion is allowed and WebGL is available.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Scene,
  Timer,
  WebGLRenderer,
} from 'three';

export interface SceneHandle {
  destroy(): void;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isSmallScreen = () => matchMedia('(max-width: 48rem)').matches;

// Budgets (effects ledger): 40 layers × 160 points desktop, 24 × 96 phones
const budget = () => (isSmallScreen() ? { layers: 24, points: 96 } : { layers: 40, points: 160 });

const PITCH = 0.06; // layer height in world units
const NEW_LAYERS = 3; // the newest layers are drawn in pen blue
const PRINT_SECONDS = 9; // one full print
const HOLD_SECONDS = 4; // finished part shown before the next print starts

// A vase-like part: each layer is a closed, slightly squared loop whose radius follows the same
// gentle wave as the 2D drawing (see components/toolpath.ts), so the scene and its fallback match.
function buildPart(layers: number, points: number) {
  const segs = layers * points;
  const position = new Float32Array(segs * 2 * 3);
  let o = 0;
  const at = (layer: number, k: number) => {
    const a = (k / points) * Math.PI * 2;
    const r = 1 + Math.sin(layer / 3.2) * 0.28;
    // Superellipse (n = 4) gives the soft corners of a printed box rather than a cylinder
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = Math.sign(c) * Math.abs(c) ** 0.5 * r * 1.35;
    const z = Math.sign(s) * Math.abs(s) ** 0.5 * r * 0.85;
    return [x, (layer - (layers - 1) / 2) * PITCH, z];
  };
  for (let l = 0; l < layers; l++) {
    for (let k = 0; k < points; k++) {
      const a = at(l, k);
      const b = at(l, (k + 1) % points);
      position.set(a, o);
      position.set(b, o + 3);
      o += 6;
    }
  }
  return position;
}

export async function start(root: HTMLElement, canvas: HTMLCanvasElement): Promise<SceneHandle> {
  const { layers, points } = budget();
  const small = isSmallScreen();

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1 : 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.3, 6.2);
  camera.lookAt(0, 0, 0);

  const group = new Group();
  scene.add(group);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(buildPart(layers, points), 3));
  const colors = new Float32Array(layers * points * 2 * 3);
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  const mat = new LineBasicMaterial({ vertexColors: true });
  const lines = new LineSegments(geo, mat);
  lines.frustumCulled = false;
  group.add(lines);

  // Dimension line: grows with the part, like the drawing's "N × 0.20"
  const dimGeo = new BufferGeometry();
  const dimPos = new Float32Array(6 * 3);
  dimGeo.setAttribute('position', new BufferAttribute(dimPos, 3));
  const dimMat = new LineBasicMaterial();
  const dim = new LineSegments(dimGeo, dimMat);
  dim.frustumCulled = false;
  scene.add(dim);

  // Colours follow the theme: older layers fade toward the paper, the newest are pen blue
  let paper = new Color();
  let ink = new Color();
  let pen = new Color();
  const readColors = () => {
    paper = new Color(css('--panel') || css('--bg') || '#d9d4c8');
    ink = new Color(css('--fg') || '#121211');
    pen = new Color(css('--accent') || '#1f3dff');
    dimMat.color.copy(pen);
    paintedUpTo = -1;
  };

  let paintedUpTo = -1;
  const tmp = new Color();
  const paint = (top: number) => {
    if (top === paintedUpTo) return;
    paintedUpTo = top;
    for (let l = 0; l < layers; l++) {
      if (l >= top - NEW_LAYERS && l < top) tmp.copy(pen);
      else tmp.copy(paper).lerp(ink, 0.2 + (Math.min(l, top) / Math.max(1, top)) * 0.8);
      const start = l * points * 2;
      for (let v = 0; v < points * 2; v++) colors.set([tmp.r, tmp.g, tmp.b], (start + v) * 3);
    }
    geo.attributes.color.needsUpdate = true;
  };

  readColors();
  const themeObserver = new MutationObserver(readColors);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const resize = () => {
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole part in frame on narrow (portrait) boxes
    camera.position.z = w / h < 1 ? 6.2 / Math.max(0.55, w / h) : 6.2;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();

  // Pointer parallax: a small turn toward the pointer, desktop only
  let tiltX = 0;
  let tiltY = 0;
  const onPointer = (e: PointerEvent) => {
    tiltY = (e.clientX / innerWidth - 0.5) * 0.35;
    tiltX = (e.clientY / innerHeight - 0.5) * 0.15;
  };
  if (!small) addEventListener('pointermove', onPointer, { passive: true });

  // ?fps=1 shows a frame meter for on-device checks (no PC needed)
  const meter = new URLSearchParams(location.search).has('fps') ? document.createElement('output') : null;
  if (meter) {
    meter.style.cssText =
      'position:fixed;right:8px;bottom:8px;z-index:99;padding:4px 8px;font:12px/1.4 ui-monospace,monospace;' +
      'background:rgb(0 0 0 / 0.7);color:#fff;pointer-events:none;white-space:pre';
    document.body.append(meter);
  }
  let meterFrames = 0;
  let meterTime = 0;
  let meterWorst = 0;
  let meterInit = '';

  const timer = new Timer();
  let raf = 0;
  let running = false;
  let visible = true;
  let clock = 0;
  const segsPerLayer = points;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    clock += dt;

    // Print progress: 0 → layers over PRINT_SECONDS, then hold, then start again
    const cycle = PRINT_SECONDS + HOLD_SECONDS;
    const t = clock % cycle;
    const progress = Math.min(1, t / PRINT_SECONDS) * layers;
    const top = Math.min(layers, Math.floor(progress) + 1);
    const segs = Math.min(layers * segsPerLayer, Math.floor(progress * segsPerLayer));
    geo.setDrawRange(0, segs * 2);
    paint(top);

    // Dimension line beside the part, from the bed to the current top
    const yBed = (-(layers - 1) / 2) * PITCH;
    const yTop = yBed + Math.max(progress, 0.001) * PITCH;
    const x = 2.15;
    dimPos.set([x, yBed, 0, x, yTop, 0, x - 0.08, yBed, 0, x + 0.08, yBed, 0, x - 0.08, yTop, 0, x + 0.08, yTop, 0]);
    dimGeo.attributes.position.needsUpdate = true;

    group.rotation.y += ((-0.5 + clock * 0.12 + tiltY) - group.rotation.y) * 0.08;
    group.rotation.x += (tiltX - group.rotation.x) * 0.08;

    renderer.render(scene, camera);

    if (meter) {
      if (!meterInit) {
        const engagedAt = (window as unknown as { __yxEngagedAt?: number }).__yxEngagedAt;
        meterInit = engagedAt === undefined ? '-' : `${(performance.now() - engagedAt).toFixed(0)} ms`;
      }
      meterFrames++;
      meterTime += dt;
      meterWorst = Math.max(meterWorst, dt);
      if (meterTime >= 1) {
        meter.textContent =
          `${(meterFrames / meterTime).toFixed(0)} fps  worst ${(meterWorst * 1000).toFixed(0)} ms\n` +
          `dpr ${renderer.getPixelRatio()}  layers ${layers}  init ${meterInit}`;
        meterFrames = 0;
        meterTime = 0;
        meterWorst = 0;
      }
    }
  };

  const play = () => {
    if (running || document.hidden || !visible) return;
    running = true;
    timer.reset();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  // Render only while the hero is on screen
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) play();
    else stop();
  });
  io.observe(root);

  const onVisibility = () => (document.hidden ? stop() : play());
  document.addEventListener('visibilitychange', onVisibility);

  const onLost = (e: Event) => {
    e.preventDefault();
    handle.destroy();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  play();
  root.classList.add('is-live');

  const handle: SceneHandle = {
    destroy() {
      stop();
      io.disconnect();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      meter?.remove();
      geo.dispose();
      mat.dispose();
      dimGeo.dispose();
      dimMat.dispose();
      renderer.dispose();
      root.classList.remove('is-live');
    },
  };
  return handle;
}
