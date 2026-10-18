// Top page scene: 分解 → 理解 → 作り替え, looping.
//   01 分解: a finished part comes apart into blocks of layers.
//   02 理解: a scan runs up the layers one by one, and a pen-blue profile (radius per layer) is drawn beside them.
//   03 作り替え: the old part dissolves, the profile is redesigned, and a new part is printed layer by layer to it.
// Each loop remakes the part into the next shape. The current step is mirrored on the hero (data-phase) so the
// matching line of the h1 lights up. Loaded lazily by boot.ts only when motion is allowed and WebGL is available.

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
const BLOCKS = 5; // the part comes apart into this many blocks of layers
const NEW_LAYERS = 3; // the newest printed layers are pen blue

// Seconds per step of one loop
const T = { hold: 1.4, apart: 2.2, scan: 3.6, dissolve: 1.2, print: 5.2 };
const LOOP = T.hold + T.apart + T.scan + T.dissolve + T.print;

// Part profiles (radius per layer, 0..1 along the height). Each loop remakes the part into the next one.
const SHAPES: ((h: number) => number)[] = [
  (h) => 1 + Math.sin(h * 12.2) * 0.28, // the vase of the static drawing (same wave as components/toolpath.ts)
  (h) => 0.72 + h * 0.5 + Math.sin(h * 6) * 0.06, // a flared cup
  (h) => 1.05 - Math.sin(h * Math.PI) * 0.32, // a waisted spool
];

const ease = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export async function start(root: HTMLElement, canvas: HTMLCanvasElement): Promise<SceneHandle> {
  const { layers, points } = budget();
  const small = isSmallScreen();
  const host = root.closest<HTMLElement>('[data-scene-host]');
  const stepEl = root.querySelector<HTMLElement>('[data-scene-step]');
  const steps = (root.dataset.steps || '').split('|');

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1 : 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  const group = new Group();
  scene.add(group);

  // One closed loop per layer; the unit loop is a superellipse (soft corners of a printed box)
  const ux = new Float32Array(points);
  const uz = new Float32Array(points);
  for (let k = 0; k < points; k++) {
    const a = (k / points) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ux[k] = Math.sign(c) * Math.abs(c) ** 0.5 * 1.35;
    uz[k] = Math.sign(s) * Math.abs(s) ** 0.5 * 0.85;
  }

  const verts = layers * points * 2;
  const position = new Float32Array(verts * 3);
  const colors = new Float32Array(verts * 3);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(position, 3));
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  const mat = new LineBasicMaterial({ vertexColors: true });
  const lines = new LineSegments(geo, mat);
  lines.frustumCulled = false;
  group.add(lines);

  // The measured profile: one segment per layer, beside the part, in pen blue
  const profPos = new Float32Array((layers - 1) * 2 * 3);
  const profGeo = new BufferGeometry();
  profGeo.setAttribute('position', new BufferAttribute(profPos, 3));
  const profMat = new LineBasicMaterial({ transparent: true });
  const profile = new LineSegments(profGeo, profMat);
  profile.frustumCulled = false;
  scene.add(profile);

  // Colours follow the theme
  let paper = new Color();
  let ink = new Color();
  let pen = new Color();
  const readColors = () => {
    paper = new Color(css('--panel') || css('--bg') || '#efece5');
    ink = new Color(css('--fg') || '#121211');
    pen = new Color(css('--accent') || '#1f3dff');
    profMat.color.copy(pen);
  };
  readColors();
  const themeObserver = new MutationObserver(readColors);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const radius = (shape: number, l: number) => SHAPES[((shape % SHAPES.length) + SHAPES.length) % SHAPES.length](l / (layers - 1));
  const blockOf = (l: number) => Math.min(BLOCKS - 1, Math.floor((l / layers) * BLOCKS));

  // Layer height with the blocks pulled apart by `apart` (0..1)
  const layerY = (l: number, apart: number) =>
    (l - (layers - 1) / 2) * PITCH + (blockOf(l) - (BLOCKS - 1) / 2) * 0.32 * apart;

  const tmp = new Color();
  const writeLayer = (l: number, r: number, y: number, dx: number, color: Color) => {
    let o = l * points * 6;
    for (let k = 0; k < points; k++) {
      const n = (k + 1) % points;
      position[o] = ux[k] * r + dx;
      position[o + 1] = y;
      position[o + 2] = uz[k] * r;
      position[o + 3] = ux[n] * r + dx;
      position[o + 4] = y;
      position[o + 5] = uz[n] * r;
      colors[o] = colors[o + 3] = color.r;
      colors[o + 1] = colors[o + 4] = color.g;
      colors[o + 2] = colors[o + 5] = color.b;
      o += 6;
    }
  };

  const resize = () => {
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
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

  // Mirror the current step on the hero, so the matching h1 line lights up
  let shownStep = 0;
  const showStep = (step: number) => {
    if (step === shownStep) return;
    shownStep = step;
    if (host) host.dataset.phase = String(step);
    if (stepEl) stepEl.textContent = steps[step - 1] ?? '';
  };

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
  let camZ = 6.4;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    timer.update(now);
    // rAF timestamps can trail the timer's reset, so clamp at both ends
    const dt = Math.min(Math.max(timer.getDelta(), 0), 0.1) || 0;
    clock += dt;

    const cycle = Math.floor(clock / LOOP);
    let t = clock % LOOP;
    const oldShape = cycle;
    const newShape = cycle + 1;

    let apart = 0;
    let scan = -1; // layer being measured
    let measured = 0; // layers measured so far (profile length)
    let dissolve = 0;
    let printed = -1; // layers printed of the new part; -1 = the old part is shown
    let morph = 0; // profile: old shape → new shape
    let profAlpha = 0;
    let step = 1;

    if (t < T.hold) {
      // The finished part
    } else if ((t -= T.hold) < T.apart) {
      apart = ease(t / T.apart);
    } else if ((t -= T.apart) < T.scan) {
      step = 2;
      apart = 1;
      const p = t / T.scan;
      scan = Math.min(layers - 1, Math.floor(p * layers));
      measured = Math.min(layers, p * layers);
      profAlpha = 1;
    } else if ((t -= T.scan) < T.dissolve) {
      step = 3;
      apart = 1 - ease(t / T.dissolve);
      dissolve = ease(t / T.dissolve);
      measured = layers;
      morph = ease(t / T.dissolve);
      profAlpha = 1;
    } else {
      t -= T.dissolve;
      step = 3;
      printed = Math.min(layers, (t / (T.print * 0.85)) * layers);
      measured = layers;
      morph = 1;
      profAlpha = 1 - ease((t - T.print * 0.85) / (T.print * 0.15));
    }
    showStep(step);

    // Layers
    const top = Math.floor(printed);
    for (let l = 0; l < layers; l++) {
      const h = l / Math.max(1, layers - 1);
      if (printed < 0) {
        // The old part: whole, coming apart, being measured, or dissolving
        const y = layerY(l, apart);
        const dx = (blockOf(l) % 2 ? 1 : -1) * 0.18 * apart;
        tmp.copy(paper).lerp(ink, 0.25 + h * 0.75);
        if (scan >= 0) {
          if (l === scan) tmp.copy(pen);
          else if (l > scan) tmp.copy(paper).lerp(ink, 0.25);
        }
        if (dissolve > 0) tmp.lerp(paper, dissolve);
        writeLayer(l, radius(oldShape, l), y, dx, tmp);
      } else {
        // The new part, printed to the redesigned profile
        if (l >= top - NEW_LAYERS && l < top) tmp.copy(pen);
        else tmp.copy(paper).lerp(ink, 0.25 + (l / Math.max(1, top)) * 0.75);
        writeLayer(l, radius(newShape, l), layerY(l, 0), 0, tmp);
      }
    }
    const drawn = printed < 0 ? layers * points : Math.floor(printed * points);
    geo.setDrawRange(0, drawn * 2);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    // Profile beside the part: radius per layer, at the exploded heights while measuring
    const px = small ? 2.05 : 2.45;
    const segs = Math.max(0, Math.floor(measured) - 1);
    for (let l = 0; l < segs; l++) {
      for (let e = 0; e < 2; e++) {
        const i = l + e;
        const r = radius(oldShape, i) * (1 - morph) + radius(newShape, i) * morph;
        const o = (l * 2 + e) * 3;
        profPos[o] = px + (r - 1) * 0.9;
        profPos[o + 1] = layerY(i, apart);
        profPos[o + 2] = 0;
      }
    }
    profGeo.setDrawRange(0, segs * 2);
    profGeo.attributes.position.needsUpdate = true;
    profMat.opacity = profAlpha;
    profile.visible = profAlpha > 0.01 && segs > 0;

    // Pull the camera back while the part is apart, so the whole stack stays in frame
    const targetZ = 6.4 + apart * 1.9;
    camZ += (targetZ - camZ) * 0.06;
    camera.position.set(0, camZ * 0.2, camZ / Math.min(1, Math.max(0.55, camera.aspect)));
    camera.lookAt(0, 0, 0);

    group.rotation.y += (-0.5 + clock * 0.1 + tiltY - group.rotation.y) * 0.08;
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
      profGeo.dispose();
      profMat.dispose();
      renderer.dispose();
      root.classList.remove('is-live');
      if (host) delete host.dataset.phase;
      if (stepEl) stepEl.textContent = '';
    },
  };
  return handle;
}
