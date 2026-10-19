// Motion vocabulary of the design system v4, for blocks that scroll into view:
//   stack ("積む") – rows, cards and spec items rise 8px and fade in, 60ms apart (at most six steps)
//   draw  ("引く") – the heavy rule at the top of a block is drawn from left to right
//   read  ("読む") – spec numerals count up from 0 to their value
// Each block moves once, when 20 % of it is in view, and never rewinds. Blocks already on screen when
// the page opens are left alone (the first screen is readable at once). With reduced motion, or
// without IntersectionObserver, nothing is touched and everything stays in its final state.
// The effects ledger (src/scene/README.md) has the rows for these three.

const TARGETS = ['.cards > li', '.logs > li', '.specs > div', '.work-steps__list > li', '.article-pager > a'].join(',');
const MAX_STEP = 5; // the 7th item and later start with the 6th
const COUNT_MS = 800;

// ease-machine, cubic-bezier(0.3, 0, 0.7, 1), solved for y at x = t
function easeMachine(t: number): number {
  const bez = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (bez(0.3, 0.7, mid) < t) lo = mid;
    else hi = mid;
  }
  return bez(0, 1, (lo + hi) / 2);
}

// "7,000" → count to 7000 and keep the comma; "2.5" keeps one decimal; "≤ 500" keeps the sign.
// Values that are not one plain number (such as "0.26 → 0.27") are not counted.
function countUp(el: HTMLElement, delay: number) {
  const text = el.textContent ?? '';
  const m = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\D*)$/.exec(text);
  if (!m) return;
  const [, before, num, after] = m;
  const commas = num.includes(',');
  const decimals = num.includes('.') ? num.split('.')[1].length : 0;
  const target = Number(num.replaceAll(',', ''));
  const format = (v: number) => {
    const s = v.toFixed(decimals);
    return before + (commas ? Number(s).toLocaleString('en-US') : s) + after;
  };
  // Hold the final width so the unit beside it never moves
  el.style.display = 'inline-block';
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  el.textContent = format(0);
  const start = performance.now() + delay;
  const tick = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
    el.textContent = t === 1 ? text : format(target * easeMachine(t));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function init() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const below = [...document.querySelectorAll<HTMLElement>(TARGETS)].filter(
    (el) => el.getBoundingClientRect().top > innerHeight,
  );
  if (!below.length) return;
  for (const el of below) el.dataset.reveal = 'pending';

  const io = new IntersectionObserver(
    (entries) => {
      const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
      shown.forEach((el, i) => {
        io.unobserve(el);
        const step = Math.min(i, MAX_STEP);
        el.style.setProperty('--reveal-step', String(step));
        el.dataset.reveal = 'in';
        for (const num of el.querySelectorAll<HTMLElement>('.num')) countUp(num, step * 60);
      });
    },
    { threshold: 0.2 },
  );
  for (const el of below) io.observe(el);
}

init();
