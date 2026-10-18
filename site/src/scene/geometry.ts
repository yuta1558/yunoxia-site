// Procedural geometry for the top scene.
// The word is rasterised on a 2D canvas and sliced into horizontal layers, like a slicer would:
// each layer is a set of x-intervals (where the glyphs are solid at that height).

export interface Interval {
  layer: number;
  x0: number;
  x1: number;
}

export interface SlicedSolid {
  layers: number;
  intervals: Interval[];
  width: number; // world units
  height: number; // world units
  depth: number; // world units
  pitch: number; // world units per layer
}

export interface Budget {
  layers: number;
  particles: number;
}

export const isSmallScreen = () => matchMedia('(max-width: 48rem)').matches;

export const budget = (): Budget =>
  isSmallScreen() ? { layers: 24, particles: 5000 } : { layers: 40, particles: 20000 };

const WORD = 'YUNOXIA';
const WORLD_WIDTH = 6;

export async function sliceWord(layers: number, fontFamily: string): Promise<SlicedSolid> {
  const font = `600 160px ${fontFamily}`;
  try {
    await Promise.race([document.fonts.load(font, WORD), new Promise((r) => setTimeout(r, 800))]);
  } catch {
    // Fall back to whatever sans-serif is available
  }

  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 240;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff';
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(WORD, c.width / 2, c.height / 2);

  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const solid = (x: number, y: number) => data[(y * c.width + x) * 4] > 127;

  // Tight bounding box of the ink
  let minX = c.width, maxX = 0, minY = c.height, maxY = 0;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      if (solid(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    minX = 0; maxX = c.width - 1; minY = 0; maxY = c.height - 1;
  }

  const inkW = maxX - minX + 1;
  const inkH = maxY - minY + 1;
  const scale = WORLD_WIDTH / inkW;
  const height = inkH * scale;
  const pitch = height / layers;
  const intervals: Interval[] = [];

  for (let i = 0; i < layers; i++) {
    // Layer 0 is the bottom (first printed) layer
    const y = Math.round(maxY - (i + 0.5) * (inkH / layers));
    let start = -1;
    for (let x = minX; x <= maxX + 1; x++) {
      const on = x <= maxX && solid(x, y);
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= 2) {
          intervals.push({
            layer: i,
            x0: (start - minX) * scale - WORLD_WIDTH / 2,
            x1: (x - minX) * scale - WORLD_WIDTH / 2,
          });
        }
        start = -1;
      }
    }
  }

  return { layers, intervals, width: WORLD_WIDTH, height, depth: 0.7, pitch };
}

// Base y of a layer centre (unexploded), in world units
export const layerY = (s: SlicedSolid, layer: number) => (layer + 0.5) * s.pitch - s.height / 2;

// Extra spacing per layer when fully exploded
export const explodeGap = (s: SlicedSolid) => s.pitch * 2.2;

export interface ParticleData {
  count: number;
  rect: Float32Array; // x0, x1, layer
  seed: Float32Array; // t along the perimeter, random
  target: Float32Array; // deposit target xyz
  order: Float32Array; // deposit order 0..1
}

// Rows the particles are re-deposited into in act 3: a short list, laid down bar by bar.
const ROWS = [1, 0.78, 0.9, 0.62];
const SUBLAYERS = 3;

export function buildParticles(s: SlicedSolid, count: number): ParticleData {
  const perim = s.intervals.map((iv) => 2 * (iv.x1 - iv.x0) + 2 * s.depth);
  const total = perim.reduce((a, b) => a + b, 0) || 1;
  const rect = new Float32Array(count * 3);
  const seed = new Float32Array(count * 2);
  const target = new Float32Array(count * 3);
  const order = new Float32Array(count);

  // Distribute particles over intervals proportionally to toolpath length
  let k = 0;
  for (let j = 0; j < s.intervals.length && k < count; j++) {
    const n = j === s.intervals.length - 1 ? count - k : Math.round((perim[j] / total) * count);
    const iv = s.intervals[j];
    for (let m = 0; m < n && k < count; m++, k++) {
      rect[k * 3] = iv.x0;
      rect[k * 3 + 1] = iv.x1;
      rect[k * 3 + 2] = iv.layer;
      seed[k * 2] = Math.random();
      seed[k * 2 + 1] = Math.random();
    }
  }

  // Deposit targets: ROWS bars, each SUBLAYERS thick, filled left to right
  const rowGap = s.height / (ROWS.length + 0.5);
  const thick = s.pitch * 0.9;
  const slots = ROWS.length * SUBLAYERS;
  for (let i = 0; i < count; i++) {
    const slot = Math.floor((i / count) * slots);
    const r = Math.floor(slot / SUBLAYERS);
    const sub = slot % SUBLAYERS;
    const within = (i / count) * slots - slot; // 0..1 along the bar
    const len = ROWS[r] * s.width;
    target[i * 3] = -s.width / 2 + within * len;
    target[i * 3 + 1] = s.height / 2 - (r + 0.5) * rowGap + sub * thick;
    // In front of the old solid so the new rows read separately from the source material
    target[i * 3 + 2] = 1.4 + (Math.random() - 0.5) * s.depth * 0.3;
    order[i] = (slot + within) / slots;
  }

  return { count, rect, seed, target, order };
}
