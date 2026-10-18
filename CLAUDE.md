# CLAUDE.md - AI Assistant Guide for yunoxia-site

## Project Overview

**yunoxia.one** is Yu's site for making and research. It lives in `site/`: an Astro 7 static site with a small blog CMS on Cloudflare Pages Functions + D1. Everything outside `site/` is repository housekeeping (this file, `README.md`, `.gitignore`).

- **Hosting**: Cloudflare Pages project `yunoxia-next` (root directory `site`, build `npm run build`, output `dist`), auto-deployed from `main`. Every PR gets a preview at `*.yunoxia-next.pages.dev`. The old project `yunoxia-site` (the pre-2026 static site at the repository root) has automatic deployments turned off and no longer serves the domain.
- **Languages**: Japanese at the root, English under `/en/` (Log is Japanese only).
- **Design system**: v3 (drafting paper, one pen-blue signal colour, light headlines; only the wordmark and the top h1 are heavy). The reference lives in a Claude Design System artifact; the code is the source of truth for values.

## Directory Structure

```
site/
├── astro.config.mjs        # site URL, sitemap (lab pages excluded), i18n
├── DEPLOY.md               # Pages setup, domain, CMS (D1, secrets), HSTS
├── public/
│   ├── _headers            # caching + security headers (see Caching)
│   ├── _redirects          # old URLs (about.html etc.) → new paths
│   ├── _routes.json        # which paths run Functions
│   ├── admin/              # CMS admin UI (noindex, strict CSP)
│   ├── assets/             # immutable images (ogp-v3.png …)
│   ├── favicon.svg/.ico, apple-touch-icon.png
│   └── sw.js               # kill switch for the old site's service worker
├── functions/              # Pages Functions: CMS API, /log/p/<slug>/, CMS posts into /log/, the top pages, RSS, sitemap and updates.json
├── migrations/             # D1 schema
├── scripts/
│   ├── build-admin.mjs     # bundles src/admin/editor.ts into public/admin/editor.js (before build and dev)
│   ├── cms.mjs             # write Log posts through the CMS API (see "Writing Log posts")
│   ├── font-subsets.mjs    # writes src/styles/fonts.generated.css (runs before every build)
│   └── profile-density.mjs # builds the Research density chart data from the analysis CSV
├── src/
│   ├── admin/editor.ts     # CMS body editor (CodeMirror 6, Obsidian-style live preview)
│   ├── layouts/Base.astro  # head, header, footer, theme script, bead
│   ├── components/         # Home (top page, ja/en), WorkCards, toolpath geometry
│   ├── pages/              # index, works, research, log, about, 404, en/*, rss, updates.json, lab/d
│   ├── content/            # works (ja/en) and log Markdown
│   ├── scene/              # top-page WebGL scene (README.md has the effects ledger)
│   ├── bead/               # molten bead cursor + "updated since last visit" marks
│   ├── research/           # Research figures
│   ├── i18n/ui.ts          # UI strings and ja/en path mapping
│   └── styles/global.css   # v3 tokens, type, buttons, section heads, prose
└── tests/
    ├── e2e/                # Playwright against the built site
    └── unit/
```

## Commands

```bash
cd site
npm install
npm run dev          # local dev server
npm run build        # font subsets + astro build → dist/
npm run test:unit
npm run test:e2e     # needs a build first; set CHROMIUM_PATH to use a preinstalled Chromium
```

## Rules

- **Privacy**: the site never shows the owner's real name, employer, employer product names or location. The e2e suite checks every page, `rss.xml` and `updates.json` against an encoded list; grep `site/` before committing.
- **Effects**: every effect needs a row in the effects ledger (`src/scene/README.md`): what it conveys, its reduced-motion / no-WebGL fallback, and its performance budget. Reduced motion and no-WebGL keep the static drawing and never request three.js or the bead.
- **Performance**: Lighthouse (mobile) ≥ 90 on reading pages, ≥ 80 on the top page. `?fps=1` on the top page shows a frame meter for real-device checks (headless Chromium renders WebGL in software, so fps measured there is meaningless).
- **Fonts**: Zen Kaku Gothic New is served only for the characters the site uses (`scripts/font-subsets.mjs`). Weight 700 is used only by the top h1. Do not import Fontsource's full weight CSS in pages: it adds ~180 KB of render-blocking CSS.
- **Colours**: use the v3 tokens in `global.css` (`--paper`, `--ink`, `--muted`, `--line`, `--pen`, `--panel`, `--band`…), defined for both themes. `--bg` / `--fg` / `--accent` are aliases read at runtime by the scene, the bead and the research figures; keep them.
- **Typography**: headlines are light (300) and end with a full stop; break Japanese headlines only between phrases (`.phrases` spans). Bold only for the wordmark and the top h1.
- **One h1 per page**, `lang` set, no page errors: the e2e suite checks every sitemap page.

## Writing Log posts

When asked to write or publish a Log post, use the CMS through `site/scripts/cms.mjs`, not a Markdown file under `src/content/log/` (those are the pre-CMS archive):

1. Write the post as Markdown with front matter (`title`, `slug`, `excerpt`, `tags`, `status`, optionally `featured_image`) in the scratchpad, not in the repository. Give an ASCII `slug`: a Japanese title alone becomes `post-<random>`.
2. Follow the Privacy rule above and the site's voice (light, short sentences; headings with `##`).
3. `node scripts/cms.mjs push <file>` saves a draft; add `--publish` only when the user asked to publish. Same slug = update.
4. Report the URL it prints. `list` and `get <slug>` read existing posts.

It needs `CMS_TOKEN` in the environment (the `CMS_API_TOKEN` secret of the Pages project; DEPLOY.md 4-6). If it is missing, say so and do not ask for the token in chat. Image upload needs the R2 binding `IMAGES`.

## Caching (`public/_headers`)

| Path | Cache-Control |
| --- | --- |
| everything by default (HTML, `sw.js`, favicons) | `public, max-age=0, must-revalidate` |
| `/_astro/*` (hashed build output) | `public, max-age=31536000, immutable` |
| `/assets/*` (images) | `public, max-age=31536000, immutable` |

- **Changing an image under `/assets/`: use a new filename** (e.g. `ogp-v3.png` → `ogp-v4.png`) and update the references. Overwriting in place leaves visitors on the old file for a year.
- Files at the public root (favicons, `robots.txt`) revalidate on every load and can be overwritten.
- Do not add a catch-all rewrite to `/index.html`: it turns every missing URL into a soft 404.

## Git Workflow

- Feature branches: `claude/<description>` or `codex/<description>`.
- PR-based. Cloudflare Pages posts a preview URL on each PR; Codex reviews PRs automatically when its quota allows.
- Merging to `main` deploys straight to yunoxia.one.
- Commit messages: English or Japanese, describing what changed and why.

---

**Last Updated**: 2026-10-18
**Maintained By**: yuta1558 / yunoxia.one
