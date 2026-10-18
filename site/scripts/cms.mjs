#!/usr/bin/env node
// Write Log posts to the CMS from the command line, so Claude (or anyone with the API token) can
// draft and publish without the admin UI.
//
//   node scripts/cms.mjs list
//   node scripts/cms.mjs get <slug>            # prints the post as a Markdown file
//   node scripts/cms.mjs push <file.md>        # create, or update the post with that slug
//   node scripts/cms.mjs push <file.md> --publish
//
// The file is Markdown with a front matter block:
//
//   ---
//   title: 記事のタイトル
//   slug: kiji-no-slug            (optional; made from the title when missing)
//   excerpt: 一覧に出る短い説明    (optional)
//   tags: [制作, 3Dプリンタ]       (optional; or a comma-separated list)
//   status: draft                 (draft or published; --publish overrides)
//   featured_image: ./cover.jpg   (optional)
//   ---
//   本文…
//
// Images given as local paths (in the body or featured_image) are uploaded first and replaced
// with their URLs. JPEG metadata (EXIF, GPS) is stripped; files must be 5 MB or less.
// CMS_URL defaults to https://yunoxia.one.
//
// Authentication is the CMS_API_TOKEN secret of the Pages project (see DEPLOY.md 4-6), either
// - as a network secret of the Claude environment: the proxy adds "Authorization: Bearer …" to
//   requests for the site, so this script never sees it and sends no header itself; or
// - as CMS_TOKEN in the environment, which this script sends.

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { findForbidden } from './forbidden.mjs';

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set. Behind a proxy (where the
// network secret is added), run again with it so requests go through the proxy.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const child = spawnSync(process.execPath, ['--disable-warning=UNDICI-EHPA', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(child.status ?? 1);
}

const BASE = (process.env.CMS_URL || 'https://yunoxia.one').replace(/\/$/, '');
const TOKEN = process.env.CMS_TOKEN;
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    fail(`${method} /api${path}: not authorised. Set the CMS_API_TOKEN value as a network secret for ${new URL(BASE).host} (Authorization: Bearer …) or as CMS_TOKEN.`);
  }
  if (!res.ok) fail(`${method} /api${path}: ${data.error || `HTTP ${res.status}`}`);
  return data;
}

async function allPosts() {
  const posts = [];
  for (let page = 1; ; page++) {
    const res = await api(`/posts?status=all&limit=50&page=${page}`);
    posts.push(...res.posts);
    if (!res.pagination?.hasNext) return posts;
  }
}

// ---- Front matter (the small subset the posts need) ------------------------------

const unquote = (v) => (/^(['"]).*\1$/.test(v) ? v.slice(1, -1) : v);

function parse(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) fail('The file needs a front matter block (--- title: … ---).');
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  if (meta.tags !== undefined) {
    const list = meta.tags.replace(/^\[|\]$/g, '');
    meta.tags = list ? list.split(',').map((t) => unquote(t.trim())).filter(Boolean) : [];
  }
  for (const key of ['title', 'slug', 'excerpt', 'status', 'featured_image']) {
    if (meta[key] !== undefined) meta[key] = unquote(meta[key]);
  }
  return { meta, content: text.slice(m[0].length).replace(/^\s*\n/, '') };
}

function serialize(post) {
  const q = (v) => (/^[\s'"[]|:\s|#|^$/.test(v) ? JSON.stringify(v) : v);
  return [
    '---',
    `title: ${q(post.title)}`,
    `slug: ${post.slug}`,
    `excerpt: ${q(post.excerpt || '')}`,
    `tags: [${post.tags.join(', ')}]`,
    `status: ${post.status}`,
    `featured_image: ${post.featured_image || ''}`,
    '---',
    '',
    post.content,
  ].join('\n');
}

// ---- Images -------------------------------------------------------------------------

const isLocal = (src) => src && !/^(https?:)?\/\//.test(src) && !src.startsWith('/') && !src.startsWith('data:');

const uploaded = new Map(); // path → URL, so a file used twice is uploaded once
const MAX_BYTES = 5 * 1024 * 1024; // the API's limit

// Drop a JPEG's APP1 segments (EXIF and XMP: camera data, GPS position) and keep the image data.
// The admin UI re-encodes and shrinks images in the browser; Node has no image encoder, so the CLI
// only strips metadata and leaves resizing to whoever prepares the file.
function stripJpegMetadata(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker === 0xda) break; // start of scan: the rest is image data
    const len = buf.readUInt16BE(i + 2);
    if (marker !== 0xe1) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  parts.push(buf.subarray(i));
  return Buffer.concat(parts);
}

async function upload(path) {
  if (uploaded.has(path)) return uploaded.get(path);
  const type = TYPES[extname(path).toLowerCase()];
  if (!type) fail(`${path}: only jpg, png, gif, webp and avif can be uploaded`);
  let data = await readFile(path);
  if (type === 'image/jpeg') data = stripJpegMetadata(data);
  if (data.length > MAX_BYTES) fail(`${path}: ${(data.length / 1048576).toFixed(1)} MB is over the 5 MB limit; shrink it first (long side 2000 px is plenty).`);
  const form = new FormData();
  form.append('file', new Blob([data], { type }), basename(path));
  const { url } = await api('/upload', { method: 'POST', form });
  console.error(`uploaded ${path} → ${url}`);
  uploaded.set(path, url);
  return url;
}

async function uploadLocalImages(content, dir) {
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  const done = new Map();
  for (const [, , src] of content.matchAll(re)) {
    if (isLocal(src)) done.set(src, await upload(resolve(dir, src)));
  }
  return content.replace(re, (all, alt, src) => (done.has(src) ? `![${alt}](${done.get(src)})` : all));
}

// ---- Commands -------------------------------------------------------------------------

async function list() {
  for (const p of await allPosts()) {
    console.log(`${p.status === 'published' ? '公開  ' : '下書き'}  ${(p.published_at || p.updated_at || '').slice(0, 10)}  ${p.slug}  ${p.title}`);
  }
}

async function get(slug) {
  const post = (await allPosts()).find((p) => p.slug === slug);
  if (!post) fail(`No post with slug "${slug}".`);
  // Read the single post for its full body
  const full = (await api(`/posts?status=all&id=${encodeURIComponent(post.id)}`)).post;
  process.stdout.write(serialize(full) + '\n');
}

async function push(file, publish) {
  const text = await readFile(file, 'utf8');
  // Privacy rule: refuse before anything (images included) is sent.
  const hits = findForbidden(text);
  if (hits.length) fail(`${file} contains forbidden string ${hits.map((n) => `#${n}`).join(', ')} (scripts/forbidden.mjs). Nothing was sent.`);
  const { meta, content } = parse(text);
  if (!meta.title) fail('title is required in the front matter.');
  const dir = dirname(resolve(file));

  const data = {
    title: meta.title,
    content: await uploadLocalImages(content, dir),
    excerpt: meta.excerpt ?? '',
    tags: meta.tags ?? [],
    status: publish ? 'published' : meta.status || 'draft',
    featured_image: isLocal(meta.featured_image) ? await upload(resolve(dir, meta.featured_image)) : meta.featured_image || '',
  };
  if (meta.slug) data.slug = meta.slug;

  const existing = meta.slug ? (await allPosts()).find((p) => p.slug === meta.slug) : null;
  const result = existing
    ? await api('/posts', { method: 'PUT', body: { id: existing.id, ...data } })
    : await api('/posts', { method: 'POST', body: data });

  const verb = existing ? 'updated' : 'created';
  if (result.status === 'published') console.log(`${verb} and published: ${BASE}/log/p/${result.slug}/`);
  else console.log(`${verb} as a draft (slug: ${result.slug}). Publish with --publish or from ${BASE}/admin/.`);
}

const [cmd, arg, ...flags] = process.argv.slice(2);
if (cmd === 'list') await list();
else if (cmd === 'get' && arg) await get(arg);
else if (cmd === 'push' && arg) await push(arg, flags.includes('--publish'));
else fail('Usage: node scripts/cms.mjs list | get <slug> | push <file.md> [--publish]');
