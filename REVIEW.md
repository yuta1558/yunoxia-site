# Review instructions

Rules for whoever reviews pull requests here (the Claude review workflow, Codex, people). `CLAUDE.md` holds the project rules; this file says how to apply them in a review.

## Severity

Start every finding with one label.

- Important: must be fixed before merging. Something breaks, leaks or regresses: wrong logic, a page error, a broken build, a privacy leak, an auth or CSP hole in the CMS, a D1 migration that breaks existing rows, a rule in `CLAUDE.md` broken in a way visitors would see.
- Nit: worth fixing, not blocking. Naming, small simplifications, comments, wording.
- Pre-existing: a problem in code the PR did not change. Report it only when the PR makes it matter.

Style and refactoring suggestions are Nit at most. Report at most five Nits per review. If nothing is Important, say so plainly; do not invent findings.

## Never write the forbidden strings

This repository is public and so are review comments. Never write the owner's real name, employer, employer product names or location, not even to quote a leak. Find leaks with `node site/scripts/privacy-check.mjs`, which reports them as `file:line: forbidden string #n`; quote that output, never the string.

## Always check

- Privacy: no forbidden string in pages, Log posts, `rss.xml`, `updates.json`, image file names, alt text or commit-visible fixtures.
- CMS and Functions (`site/functions/`): every `/api/*` write requires auth; inputs are validated; no secrets or tokens in responses or logs; `_routes.json` lists any new Function path; no catch-all rewrite to `/index.html`.
- Caching: an image changed under `site/public/assets/` gets a new filename and the references follow. Overwriting in place is Important.
- Effects: a new or changed effect has a row in the effects ledger (`site/src/scene/README.md`) with its reduced-motion / no-WebGL fallback and budget. Reduced motion and no WebGL must not request three.js or the bead.
- Performance: nothing new in the initial page of the top page or reading pages that is large or render-blocking (full Fontsource CSS, eager three.js, unsized images).
- Colours: v3 tokens only, defined for both themes; `--bg` / `--fg` / `--accent` aliases kept.
- Typography: headlines weight 300 ending with a full stop; Japanese headlines break only between `.phrases` spans; bold only for the wordmark and the top h1.
- Pages: one h1, `lang` set, ja/en paths mapped in `site/src/i18n/ui.ts` when a page has both.
- Tests: a behaviour change in `site/functions/` or `site/scripts/` comes with a unit test or a stated reason why not.

## Do not report

- Generated files: `site/src/styles/fonts.generated.css`, `site/public/admin/editor.js`, `site/package-lock.json`.
- The pre-CMS Log archive under `site/src/content/log/` unless the PR edits it.
- Formatting that does not change meaning.
- What CI already checks (`.github/workflows/ci.yml`): unit and e2e failures, a broken build, the privacy check. Point out a missing test, not a failing one.
