// Molten bead: a drop of molten resin that trails the cursor like a toolhead.
// Moves with acceleration and jerk limits, cools and sets when idle, heats up over
// links updated since the last visit, and bursts toward a link when it is clicked.

type Persona = {
  maxSpeed: number; // px/s
  accel: number; // px/s^2
  jerk: number; // px/s^3
  radius: number; // px
  keep: number; // distance kept from the cursor (px); 0 = follow an offset instead
  offset: [number, number];
  squash: number; // deformation under acceleration
  wobble: number; // jiggle after sudden changes
  glow: number; // shadow blur (px)
  cool: number; // seconds of idle before it starts to set
};

// Quiet, slightly distant personality (chosen over a bouncier one after trying both)
const PERSONA: Persona = { maxSpeed: 900, accel: 2400, jerk: 18000, radius: 6, keep: 46, offset: [0, 0], squash: 0.14, wobble: 0, glow: 14, cool: 3 };

const SIZE = 200; // canvas size in CSS px; the bead is drawn at its centre
const BURST_MS = 280;

type RGB = [number, number, number];
type Particle = { x: number; y: number; vx: number; vy: number };

function cssColor(name: string, fallback: RGB): RGB {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const rgba = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function startBead() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const P = PERSONA;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = canvas.height = SIZE * dpr;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'yx-bead';
  document.body.append(canvas);

  let cool: RGB, warm: RGB;
  const readColors = () => {
    cool = cssColor('--muted', [94, 91, 84]);
    warm = cssColor('--accent', [31, 61, 255]);
  };
  readColors();
  new MutationObserver(readColors).observe(document.documentElement, { attributeFilter: ['data-theme'] });

  // State
  let mx = -100, my = -100; // cursor
  let x = -100, y = -100, vx = 0, vy = 0, ax = 0, ay = 0;
  let temp = 0; // 0 = set, 1 = fully molten
  let hot = false; // hovering a link updated since the last visit
  let idle = 0; // seconds without cursor movement
  let jig = 0; // wobble energy
  let gap = 0; // distance to the current target
  let seen = false;
  let parts: Particle[] = [];
  let burstAt = 0;
  let raf = 0;
  let last = 0;

  const wake = () => {
    if (!raf && !document.hidden) {
      // The first frame only takes its timestamp: a rAF timestamp can trail performance.now(),
      // and a zero or negative step would divide by zero and leave the bead at NaN (frozen)
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX;
    my = e.clientY;
    if (!seen) {
      seen = true;
      x = mx;
      y = my;
    }
    idle = 0;
    wake();
  }, { passive: true });

  document.addEventListener('pointerover', (e) => {
    hot = !!(e.target as Element).closest?.('a[data-updated="true"]');
    if (hot) wake();
  });

  // Burst toward the clicked link. Never blocks or delays the navigation.
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[href]');
    if (!a || !seen) return;
    const r = a.getBoundingClientRect();
    const dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
    const d = Math.hypot(dx, dy) || 1;
    parts = Array.from({ length: 14 }, () => {
      const s = 160 + Math.random() * 260;
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.6;
      return { x: 0, y: 0, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s };
    });
    vx += (dx / d) * 400;
    vy += (dy / d) * 400;
    burstAt = performance.now();
    temp = 1;
    wake();
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      // Coming back (tab or window switch): resume from rest instead of carrying stale motion
      vx = vy = ax = ay = 0;
      wake();
    }
  });

  function step(dt: number) {
    // Target: an offset from the cursor, or a point kept at a distance from it
    let tx = mx + P.offset[0], ty = my + P.offset[1];
    if (P.keep) {
      const d = Math.hypot(x - mx, y - my) || 1;
      tx = mx + ((x - mx) / d) * P.keep;
      ty = my + ((y - my) / d) * P.keep;
    }

    // Toolhead-like motion: brake to arrive, clamp acceleration, limit its rate of change (jerk)
    const ex = tx - x, ey = ty - y, dist = Math.hypot(ex, ey);
    gap = dist;
    const vmax = Math.min(P.maxSpeed, Math.sqrt(2 * P.accel * dist));
    const wx = dist > 0.01 ? (ex / dist) * vmax : 0, wy = dist > 0.01 ? (ey / dist) * vmax : 0;
    let dax = (wx - vx) / dt, day = (wy - vy) / dt;
    const am = Math.hypot(dax, day);
    if (am > P.accel) {
      dax *= P.accel / am;
      day *= P.accel / am;
    }
    const jx = dax - ax, jy = day - ay, jm = Math.hypot(jx, jy), jmax = P.jerk * dt;
    const k = jm > jmax ? jmax / jm : 1;
    ax += jx * k;
    ay += jy * k;
    jig = jig * Math.exp(-6 * dt) + (jm / P.accel) * P.wobble * dt * 4;
    vx += ax * dt;
    vy += ay * dt;
    x += vx * dt;
    y += vy * dt;

    // Molten while moving or over an updated link; sets after a while idle
    idle += dt;
    const target = hot ? 1 : idle < P.cool ? 0.7 : 0;
    temp += (target - temp) * Math.min(1, dt * (target > temp ? 6 : 0.8));
  }

  function draw(now: number) {
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, SIZE, SIZE);
    canvas.style.transform = `translate3d(${x - SIZE / 2}px,${y - SIZE / 2}px,0)`;
    const c = SIZE / 2;

    // Burst particles
    const age = now - burstAt;
    if (parts.length && age < BURST_MS) {
      const t = age / 1000, fade = 1 - age / BURST_MS;
      ctx!.fillStyle = rgba(warm, fade);
      for (const p of parts) {
        ctx!.beginPath();
        ctx!.arc(c + p.vx * t, c + p.vy * t, 1.6 * fade + 0.4, 0, 7);
        ctx!.fill();
      }
    } else parts = [];

    // Body: stretched along acceleration, jiggling after sudden changes
    const am = Math.hypot(ax, ay) / P.accel;
    const s = Math.min(am, 1) * P.squash;
    const jiggle = 1 + Math.min(jig, 0.3) * Math.sin(now / 45);
    const r = P.radius * (1 + temp * 0.12);
    ctx!.save();
    ctx!.translate(c, c);
    ctx!.rotate(Math.atan2(ay, ax));
    ctx!.scale((1 + s) * jiggle, (1 - s * 0.6) / jiggle);

    const body = mix(cool, warm, temp);
    if (P.glow) {
      ctx!.shadowColor = rgba(warm, 0.35 + temp * 0.4);
      ctx!.shadowBlur = P.glow * (0.4 + temp);
    }
    const g = ctx!.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
    g.addColorStop(0, rgba([255, 255, 255], 0.1 + 0.65 * temp)); // gloss fades as it sets
    g.addColorStop(0.35, rgba(body));
    g.addColorStop(1, rgba(mix(body, [0, 0, 0], 0.35)));
    ctx!.fillStyle = g;
    ctx!.beginPath();
    ctx!.arc(0, 0, r, 0, 7);
    ctx!.fill();
    ctx!.restore();
  }

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    const first = !last;
    last = now;
    if (first || !(dt > 0)) {
      raf = requestAnimationFrame(frame);
      return;
    }
    step(dt);
    // Last line of defence: never stay stuck on a broken state
    if (!Number.isFinite(x + y + vx + vy + ax + ay)) {
      x = mx;
      y = my;
      vx = vy = ax = ay = 0;
    }
    draw(now);
    // Stop the loop once the bead has set and nothing moves
    const still = Math.hypot(vx, vy) < 1 && gap < 0.5 && temp < 0.02 && !parts.length;
    raf = still ? 0 : requestAnimationFrame(frame);
  }
}
