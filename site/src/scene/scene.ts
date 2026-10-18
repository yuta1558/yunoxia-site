// Top page scene: 分解 → 理解 → 作り替え, driven by scroll.
// Loaded lazily by boot.ts only when motion is allowed and WebGL is available.

import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Timer,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { budget, buildParticles, explodeGap, isSmallScreen, layerY, sliceWord } from './geometry';
import { particleFragment, particleVertex } from './shaders';

gsap.registerPlugin(ScrollTrigger);

export interface SceneHandle {
  destroy(): void;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function readColors() {
  const bg = new Color(css('--bg') || '#f6f6f4');
  const fg = new Color(css('--fg') || '#141416');
  const accent = new Color(css('--accent') || '#6f5fb8');
  return {
    solid: bg.clone().lerp(fg, 0.22),
    cool: bg.clone().lerp(fg, 0.55),
    hot: accent,
  };
}

export async function start(root: HTMLElement, canvas: HTMLCanvasElement): Promise<SceneHandle> {
  const { layers, particles } = budget();
  const small = isSmallScreen();
  const fontFamily = css('--font-sans').split(',')[0] || 'sans-serif';
  const solid = await sliceWord(layers, fontFamily);

  // --- renderer / camera -------------------------------------------------
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  let dprCap = small ? 1 : 1.5;
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  const group = new Group();
  scene.add(group);

  scene.add(new AmbientLight(0xffffff, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(3, 5, 6);
  scene.add(sun);

  // --- act 1: sliced solid (one box per solid interval per layer) ---------
  const solidMat = new MeshLambertMaterial({ transparent: true });
  const boxes = new InstancedMesh(new BoxGeometry(1, 1, 1), solidMat, solid.intervals.length);
  boxes.frustumCulled = false;
  group.add(boxes);

  const gap = explodeGap(solid);
  const m4 = new Matrix4();
  const setLayers = (explode: number) => {
    solid.intervals.forEach((iv, i) => {
      const y = layerY(solid, iv.layer) + (iv.layer - (solid.layers - 1) / 2) * gap * explode;
      m4.makeScale(iv.x1 - iv.x0, solid.pitch * 0.82, solid.depth);
      m4.setPosition((iv.x0 + iv.x1) / 2, y, 0);
      boxes.setMatrixAt(i, m4);
    });
    boxes.instanceMatrix.needsUpdate = true;
  };
  setLayers(0);

  // --- act 2/3: toolpath particles -----------------------------------------
  // Bar lengths for act 3 come from the Works list (see TopScene.astro)
  const rows = (root.dataset.rows || '').split(',').map(Number).filter((n) => n > 0 && n <= 1);
  const pd = buildParticles(solid, particles, rows);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pd.target, 3));
  geo.setAttribute('aRect', new BufferAttribute(pd.rect, 3));
  geo.setAttribute('aSeed', new BufferAttribute(pd.seed, 2));
  geo.setAttribute('aTarget', new BufferAttribute(pd.target, 3));
  geo.setAttribute('aOrder', new BufferAttribute(pd.order, 1));

  const uniforms = {
    uTime: { value: 0 },
    uP1: { value: 0 },
    uP2: { value: 0 },
    uP3: { value: 0 },
    uFade: { value: 1 },
    uLayers: { value: solid.layers },
    uPitch: { value: solid.pitch },
    uHeight: { value: solid.height },
    uDepth: { value: solid.depth },
    uGap: { value: gap },
    uSize: { value: small ? 3.6 : 3.2 },
    uPR: { value: renderer.getPixelRatio() },
    uCool: { value: new Color() },
    uHot: { value: new Color() },
  };
  const pointsMat = new ShaderMaterial({
    uniforms,
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
  });
  const points = new Points(geo, pointsMat);
  points.frustumCulled = false;
  group.add(points);

  // Nozzle: where material is being laid down right now (act 2 and 3)
  const nozzle = new Mesh(new SphereGeometry(0.05, 12, 12), new MeshBasicMaterial({ transparent: true }));
  group.add(nozzle);

  const applyColors = () => {
    const c = readColors();
    solidMat.color.copy(c.solid);
    uniforms.uCool.value.copy(c.cool);
    uniforms.uHot.value.copy(c.hot);
    (nozzle.material as MeshBasicMaterial).color.copy(c.hot);
  };
  applyColors();
  const themeObserver = new MutationObserver(applyColors);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // --- layout --------------------------------------------------------------
  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Keep the solid clear of the headline on wide screens; centre and shrink on narrow ones
    const wide = w / h > 1.1;
    group.position.set(wide ? 2.2 : 0, wide ? -0.3 : -1.6, 0);
    group.scale.setScalar(wide ? 0.85 : Math.min(0.9, (w / h) * 0.95));
  };
  resize();
  addEventListener('resize', resize);

  // --- scroll --------------------------------------------------------------
  const lenis = new Lenis({ lerp: 0.12 });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const state = { p: 0, fade: 1 };
  let bounds: [number, number] = [0.4, 0.7];

  const hero = document.querySelector<HTMLElement>('[data-scene="hero"]');
  const acts = document.querySelector<HTMLElement>('[data-scene="acts"]');
  const after = document.querySelector<HTMLElement>('[data-scene="after"]');
  const actEls = [2, 3].map((n) => document.querySelector<HTMLElement>(`[data-act="${n}"]`));

  const master = ScrollTrigger.create({
    trigger: hero ?? document.body,
    start: 'top top',
    endTrigger: acts ?? undefined,
    end: acts ? 'bottom bottom' : `+=${innerHeight * 2.5}`,
    scrub: true,
    onUpdate: (self) => {
      state.p = self.progress;
    },
    onRefresh: (self) => {
      const span = self.end - self.start;
      const at = (el: HTMLElement | null) =>
        el ? (el.getBoundingClientRect().top + scrollY - innerHeight * 0.6 - self.start) / span : NaN;
      const b1 = at(actEls[0]);
      const b2 = at(actEls[1]);
      // Acts laid out side by side give no usable boundaries; fall back to fixed thirds
      bounds = b1 > 0.15 && b2 - b1 > 0.12 && b2 < 0.95 ? [b1, b2] : [0.4, 0.7];
    },
  });

  const fadeTrigger = after
    ? ScrollTrigger.create({
        trigger: after,
        // Gone before the list reaches reading height, so particles never sit behind its text
        start: 'top 95%',
        end: 'top 75%',
        scrub: true,
        onUpdate: (self) => {
          state.fade = 1 - self.progress;
        },
      })
    : null;

  // --- render loop ---------------------------------------------------------
  const timer = new Timer();
  let raf = 0;
  let running = false;
  let frames = 0;
  let slowSum = 0;
  let downgraded = 0;
  const easeInOut = (x: number) => x * x * (3 - 2 * x);
  const target = new Vector3();

  // ?fps=1 shows a frame meter for on-device checks (no PC needed)
  const meter = new URLSearchParams(location.search).has('fps') ? document.createElement('output') : null;
  if (meter) {
    meter.style.cssText =
      'position:fixed;right:8px;bottom:8px;z-index:99;padding:4px 8px;font:12px/1.4 ui-monospace,monospace;' +
      'background:rgb(0 0 0 / 0.7);color:#fff;border-radius:4px;pointer-events:none;white-space:pre';
    document.body.append(meter);
  }
  let meterFrames = 0;
  let meterTime = 0;
  let meterWorst = 0;
  let meterInit = '';

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    timer.update(now);
    const dt = timer.getDelta();
    const t = timer.getElapsed();
    const [b1, b2] = bounds;
    const p = state.p;
    const p1 = easeInOut(Math.min(1, p / b1));
    const p2 = Math.max(0, Math.min(1, (p - b1) / (b2 - b1)));
    const p3 = Math.max(0, Math.min(1, (p - b2) / (1 - b2)));

    uniforms.uTime.value = t;
    uniforms.uP1.value = p1;
    uniforms.uP2.value = p2;
    uniforms.uP3.value = p3;
    uniforms.uFade.value = state.fade;
    setLayers(p1);
    solidMat.opacity = (1 - Math.min(1, p2 * 1.5) * 0.88) * (1 - p3) * state.fade;
    boxes.visible = solidMat.opacity > 0.01;

    // Show the solid in three quarters at rest, turn it flat to read the list in act 3
    const idle = Math.sin(t * 0.25) * 0.08;
    group.rotation.y = (-0.55 + idle) * (1 - p3);
    group.rotation.x = (0.22 + 0.25 * p1) * (1 - p3);

    // Nozzle follows the current print layer, then the deposit head
    if (p3 > 0) {
      const i = Math.min(pd.count - 1, Math.max(0, Math.floor((p3 * 1.02 - 0.02) * pd.count)));
      target.set(pd.target[i * 3], pd.target[i * 3 + 1] + solid.pitch, pd.target[i * 3 + 2]);
    } else {
      const layer = p2 * solid.layers;
      const y = layerY(solid, layer) + (layer - (solid.layers - 1) / 2) * gap * p1 + solid.pitch;
      target.set(Math.sin(t * 2.4) * solid.width * 0.45, y, 0);
    }
    nozzle.position.lerp(target, 0.25);
    (nozzle.material as MeshBasicMaterial).opacity = (p2 > 0 && p3 < 1 ? 1 : 0) * state.fade;

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
          `dpr ${renderer.getPixelRatio()}  quality -${downgraded}  init ${meterInit}`;
        meterFrames = 0;
        meterTime = 0;
        meterWorst = 0;
      }
    }

    // Quality downgrade: if frames stay slow, lower pixel ratio, then halve the particles
    frames++;
    if (dt > 1 / 40) slowSum++;
    if (frames === 90) {
      if (slowSum > 45 && downgraded < 2) {
        downgraded++;
        if (downgraded === 1 && renderer.getPixelRatio() > 1) {
          dprCap = 1;
          renderer.setPixelRatio(1);
          uniforms.uPR.value = 1;
          resize();
        } else {
          geo.setDrawRange(0, Math.floor(pd.count / 2));
        }
      }
      frames = 0;
      slowSum = 0;
    }

    // Nothing left to show once the Works list has arrived
    if (state.fade <= 0.001) stop();
  };

  const play = () => {
    if (running || document.hidden) return;
    running = true;
    timer.reset();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  // Resume when scrolling back up into the scene
  const resumeOnScroll = () => {
    if (!running && state.fade > 0.001) play();
  };
  lenis.on('scroll', resumeOnScroll);

  const onVisibility = () => (document.hidden ? stop() : play());
  document.addEventListener('visibilitychange', onVisibility);

  const onLost = (e: Event) => {
    e.preventDefault();
    handle.destroy();
    root.classList.remove('is-live');
  };
  canvas.addEventListener('webglcontextlost', onLost);

  ScrollTrigger.refresh();
  play();
  root.classList.add('is-live');

  const handle: SceneHandle = {
    destroy() {
      stop();
      master.kill();
      fadeTrigger?.kill();
      gsap.ticker.remove(tick);
      lenis.destroy();
      themeObserver.disconnect();
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      geo.dispose();
      pointsMat.dispose();
      boxes.geometry.dispose();
      solidMat.dispose();
      nozzle.geometry.dispose();
      (nozzle.material as Material).dispose();
      renderer.dispose();
      root.classList.remove('is-live');
    },
  };
  return handle;
}
