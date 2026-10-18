// POST /api/preview — render Markdown with the same renderer the public pages use (admin only).

import { error, json, readJson } from '../_lib/http.js';
import { renderMarkdown } from '../_lib/markdown.js';

export async function onRequestPost({ request }) {
  const { value, error: bodyError } = await readJson(request);
  if (bodyError) return error(bodyError, 400);
  if (typeof value.content !== 'string') return error('content must be a string', 400);
  return json({ html: renderMarkdown(value.content) });
}
