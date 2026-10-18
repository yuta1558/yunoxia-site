// Front matter for scripts/cms.mjs: the small subset Log posts need, written so that
// `get` → edit → `push` gives back exactly what was read. Values that could be misread
// (quotes, colons, #, newlines, leading/trailing spaces) are written as JSON strings, and
// tags as a JSON array; plain `key: value` and `tags: [a, b]` written by hand also parse.

const STRINGS = ['title', 'slug', 'excerpt', 'status', 'featured_image'];

function value(raw) {
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, raw.endsWith('"') ? -1 : undefined);
    }
  }
  return /^'.*'$/.test(raw) ? raw.slice(1, -1) : raw;
}

function tags(raw) {
  if (raw.startsWith('[')) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list.map(String).filter(Boolean);
    } catch {}
  }
  // Hand-written list: split on commas outside quotes
  const list = raw.replace(/^\[|\]$/g, '');
  return (list.match(/\s*"(?:[^"\\]|\\.)*"\s*|\s*'[^']*'\s*|[^,]+/g) ?? []).map((t) => value(t.trim())).filter(Boolean);
}

// Returns { meta, content }, or null when there is no front matter block.
// Only keys present in the file are set on meta.
export function parse(text) {
  const src = text.replace(/^﻿/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(src);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const [, key, raw] = kv;
    if (key === 'tags') meta.tags = tags(raw.trim());
    else if (STRINGS.includes(key)) meta[key] = value(raw.trim());
  }
  return { meta, content: src.slice(m[0].length).replace(/^\s*\n/, '') };
}

const quote = (v) => (/^$|^[\s'"[{]|\s$|:\s|#|[\r\n\t]/.test(v) ? JSON.stringify(v) : v);

export function serialize(post) {
  return [
    '---',
    `title: ${quote(post.title)}`,
    `slug: ${post.slug}`,
    `excerpt: ${quote(post.excerpt || '')}`,
    `tags: ${JSON.stringify(post.tags || [])}`,
    `status: ${post.status}`,
    `featured_image: ${quote(post.featured_image || '')}`,
    '---',
    '',
    post.content,
  ].join('\n');
}
