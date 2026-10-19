# Top scene

Decorative WebGL scene inside the top page's hero panel. The HTML text is the content; the scene is `aria-hidden`.

The scene loops through the three verbs of the h1:

1. 分解 (take apart): a finished part comes apart into five blocks of layers, which pull away from each other and shift sideways.
2. 理解 (understand): a pen-blue scan runs up the layers one at a time, and beside the stack a pen-blue profile (radius per layer) is drawn as it goes: the shape turned into numbers.
3. 作り替え (remake): the old part dissolves, the profile is redrawn into a new shape, and a new part is printed to it layer by layer (newest three layers in pen blue).

Each loop remakes the part into the next of three shapes (vase, cup, spool). While the scene runs, the hero gets `data-phase="1|2|3"`; the matching line of the h1 turns pen blue and a caption under the scene names the step. Without the scene the h1 keeps its default (last line pen blue) and no caption is shown. The part turns slowly; on desktop it also leans toward the pointer.

## Effects ledger

| Effect | What it conveys | Reduced motion / no WebGL | Budget |
| --- | --- | --- | --- |
| Take apart → measure → reprint loop in the hero | The h1's three verbs as one process: a part split into layers, each layer measured into a profile, a new part printed from it | The same part as a static SVG drawing (`.top-scene__fallback`, shared geometry in `components/toolpath.ts`); three.js is never requested | 40 layers × 160 points desktop, 24 × 96 phones (≤ 6.4k line segments, rewritten on the CPU each frame). DPR 1.5 desktop, 1 phones. Xperia 1 II: 60 fps, worst frame ≤ 20 ms, init ≤ 150 ms |
| Molten bead cursor (`bead/`), every page | The pointer as a toolhead: a drop of resin that follows with acceleration limits, sets when idle and heats over links updated since the last visit | Not loaded with reduced motion, a coarse pointer or no WebGL; the "updated" marks still show. The bead draws on a 2D canvas: the WebGL check is there only to follow the rule above | One 200 × 200 CSS px canvas (DPR ≤ 2), ~3 KB chunk loaded at idle; the frame loop stops when the bead is still and while the tab is hidden |
| Stack (積む): rows, cards, spec items and pager links below the first screen rise 8px and fade in, 60ms apart (six steps at most), once (`motion/reveal.ts`) | The page is read in layers, the way a part is printed | Reduced motion or no IntersectionObserver: nothing is marked, everything is in place from the start. Blocks already on screen at load never move; a page opened at a #fragment or reached with back / forward is left alone (the browser scrolls after the check). Print shows the final state | `transform` and `opacity` only, 400ms + ≤ 300ms of stagger; CLS 0 (space is kept, nothing is laid out again). Script ~1 KB gzip, no frame loop when idle |
| Draw (引く): the 1.5px rule on top of a spec item or a Works step is drawn left to right as the block enters (`.rule-draw`) | Where a block starts, as a pen stroke | Same as Stack: the rule is simply there | `transform: scaleX` on a pseudo-element, 600ms; ends within 900ms with the stagger |
| Read (読む): spec numerals count from 0 to their value as the item enters | The numbers are readings off an instrument | Same as Stack: the value is shown at once. Values that are not a single number are never counted | `requestAnimationFrame` for 800ms per numeral, width held with `min-width` so the unit does not move; tabular figures |

## Wiring

`TopScene.astro` is placed inside the hero panel (`components/Home.astro`). It renders a `[data-top-scene]` box with a `<canvas>` and the fallback SVG at the same size, and runs `boot()`.

## Loading and fallbacks

- `boot.ts` is the only code in the initial page. three.js is dynamically imported after the first scroll, pointer, touch or key, then after `load` + idle.
- `prefers-reduced-motion: reduce` or no WebGL: nothing is requested and the static drawing stays. Switching to reduced motion while the page is open tears the scene down.
- Rendering runs only while the hero is on screen (IntersectionObserver) and the tab is visible.
- Colours come from `--panel`, `--fg` and `--accent` and follow `html[data-theme]` changes.
- `?fps=1` shows a frame meter (fps, worst frame, DPR, layers, time from first engagement to the first frame) for checks on a phone. Headless Chromium renders WebGL in software, so numbers measured there are meaningless.
