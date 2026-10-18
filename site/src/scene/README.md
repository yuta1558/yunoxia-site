# Top scene (phases 2–3)

Decorative WebGL scene for the top page. The HTML text is the content; the canvas is `aria-hidden`.

| Act | What happens | What it conveys |
| --- | --- | --- |
| 1 分解 | The word YUNOXIA, built as a solid, is sliced into layers that spread apart | Opening things up; knowing a slicer from the inside |
| 2 理解 | Each layer's perimeter becomes a toolpath; particles run along it and layers appear in print order, the newest hot (accent) and older layers cooling | Breaking a phenomenon into physical quantities (flow, heat history, cooling) |
| 3 作り替え | The material is re-deposited, bar by bar like extrusion, into a short list | Turning understanding into something others can use (the Works list that follows) |

## Wiring (index.astro)

```astro
---
import TopScene from '../scene/TopScene.astro';
---
<Base>
  <TopScene />
  <section class="hero wrap" data-scene="hero">…</section>
  <section class="acts wrap" data-scene="acts">
    <div class="act" data-act="1">…</div>
    <div class="act" data-act="2">…</div>
    <div class="act" data-act="3">…</div>
  </section>
  <section class="wrap block" data-scene="after">…Works…</section>
```

- `data-scene="hero"`: scroll range starts at its top.
- `data-scene="acts"`: scroll range ends when its bottom reaches 55% of the viewport.
- `data-act="2"` / `data-act="3"`: act boundaries are taken from where these reach 60% of the viewport. If the acts sit side by side (no usable boundaries), the range is split into fixed thirds.
- `data-scene="after"`: the scene fades out as this section rises from 55% to 20% of the viewport, then rendering stops.

Recommended layout: stack the acts in one column with roughly `min-height: 80–85vh` each, text kept to the left half on wide screens. In the current three-column layout the whole scene plays within about one screen of scrolling, which is too fast to read.

## Loading and fallbacks

- `boot.ts` is the only code in the initial page (≈1.3 KB gzip). three.js, GSAP and Lenis are dynamically imported after `load` + idle.
- `prefers-reduced-motion: reduce` or no WebGL: nothing is requested; a static SVG of the sliced layers is shown. Switching to reduced motion while the page is open tears the scene down.
- Rendering pauses when the tab is hidden or after the fade-out, and resumes on scroll.
- Quality: DPR capped (1.5 desktop, 1 mobile); if most of 90 frames exceed 25 ms, DPR drops to 1, then particles are halved.
- Budgets: 40 layers / 20k particles desktop, 24 layers / 5k particles mobile (within the ledger's 60/20k and 30/5k).
- Colours come from `--bg`, `--fg`, `--accent` and follow `html[data-theme]` changes.
- Lenis smooth scrolling runs only while this scene is live (top page only).
