# yunoxia.one static site

This repository contains the files that make up **yunoxia.one**, a small personal website. The pages are plain HTML styled with CSS and enhanced with a little JavaScript.

## Serving locally

No build step is required. To view the site locally, run any static HTTP server in this directory, e.g.

```bash
python3 -m http.server
```

Then open `http://localhost:8000/` in your browser.

## Deploying

Because it is entirely static, the site can be deployed to any static hosting provider such as GitHub Pages or Netlify. Simply upload the contents of this repository to your hosting service of choice.

## Features

- A dark‑mode toggle (`theme-switch` element) remembers the user's preference and respects the system color scheme.
- PJAX navigation in `assets/js/app.js` fetches page fragments and updates the history so navigation feels instant without full page reloads.

## Running tests

Install development dependencies:

```bash
npm install
```

Then execute:

```bash
npm test
```

The command launches a headless browser using Puppeteer and runs the Mocha/Chai suite defined in `tests/`.

