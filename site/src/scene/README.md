# Top scene

Decorative WebGL scene inside the top page's hero panel. The HTML text is the content; the scene is `aria-hidden`.

A vase-like part is printed one layer at a time: each layer is a closed toolpath loop, the newest three layers are drawn in pen blue, older layers fade toward the panel colour, and a pen-blue dimension line grows with the part. After the print finishes the part holds for a few seconds and the print starts again. The part turns slowly; on desktop it also leans a little toward the pointer.

## Effects ledger

| Effect | What it conveys | Reduced motion / no WebGL | Budget |
| --- | --- | --- | --- |
| Layer-by-layer print in the hero | 作り替える: understanding turned into a made thing, one layer at a time, as FDM does | The same part as a static SVG drawing (`.top-scene__fallback`, shared geometry in `components/toolpath.ts`); three.js is never requested | 40 layers × 160 points desktop, 24 × 96 phones (≤ 13k line segments). DPR 1.5 desktop, 1 phones. Xperia 1 II: 60 fps, worst frame ≤ 20 ms, init ≤ 150 ms |

## Wiring

`TopScene.astro` is placed inside the hero panel (`components/Home.astro`). It renders a `[data-top-scene]` box with a `<canvas>` and the fallback SVG at the same size, and runs `boot()`.

## Loading and fallbacks

- `boot.ts` is the only code in the initial page. three.js is dynamically imported after the first scroll, pointer, touch or key, then after `load` + idle.
- `prefers-reduced-motion: reduce` or no WebGL: nothing is requested and the static drawing stays. Switching to reduced motion while the page is open tears the scene down.
- Rendering runs only while the hero is on screen (IntersectionObserver) and the tab is visible.
- Colours come from `--panel`, `--fg` and `--accent` and follow `html[data-theme]` changes.
- `?fps=1` shows a frame meter (fps, worst frame, DPR, layers, time from first engagement to the first frame) for checks on a phone. Headless Chromium renders WebGL in software, so numbers measured there are meaningless.
