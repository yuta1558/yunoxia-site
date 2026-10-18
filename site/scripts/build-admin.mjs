// Bundles the CMS admin's Markdown editor (src/admin/editor.ts, CodeMirror 6) into
// public/admin/editor.js. The admin's CSP only allows same-origin scripts, so the editor ships
// as one local file rather than from a CDN. Runs before every build and dev server.

import { build } from 'esbuild';

await build({
  entryPoints: ['src/admin/editor.ts'],
  outfile: 'public/admin/editor.js',
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'warning',
});
