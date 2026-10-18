#!/usr/bin/env node
// Write Log posts to the CMS from the command line, so Claude (or anyone with the API token) can
// draft and publish without the admin UI.
//
//   node scripts/cms.mjs list
//   node scripts/cms.mjs get <slug>            # prints the post as a Markdown file
//   node scripts/cms.mjs push <file.md>        # create, or update the post with that slug
//   node scripts/cms.mjs push <file.md> --publish   (flags can go anywhere)
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
// with their URLs. JPEG metadata (EXIF, GPS) is stripped; PNG, WebP and other formats are sent
// as they are, metadata included. Files must be 5 MB or less.
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
import { parse, serialize } from './lib/frontmatter.mjs';
import { headingsWithoutStop, isLocal, rewriteImages, stripJpegMetadata } from './lib/images.mjs';

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

// Read a file the user named; a missing one is a message, not a stack trace
async function readInput(path, encoding) {
  try {
    return await readFile(path, encoding);
  } catch (err) {
    return fail(`${path}: ${err.code === 'ENOENT' ? 'no such file' : err.message}`);
  }
}

// The token (or the proxy's network secret) must not travel over plain HTTP
{
  let url;
  try {
    url = new URL(BASE);
  } catch {
    fail(`CMS_URL is not a valid URL (got ${BASE}); include the scheme, e.g. https://yunoxia.one.`);
  }
  const { protocol, hostname } = url;
  if (protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    fail(`CMS_URL must be https (got ${BASE}); http is allowed only for localhost.`);
  }
}

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) }).catch((err) =>
    fail(`${method} /api${path}: cannot reach ${BASE} (${err.cause?.code || err.message}).`),
  );
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

// ---- Images -------------------------------------------------------------------------

const uploaded = new Map(); // path → URL, so a file used twice is uploaded once
const MAX_BYTES = 5 * 1024 * 1024; // the API's limit

async function upload(path) {
  if (uploaded.has(path)) return uploaded.get(path);
  const type = TYPES[extname(path).toLowerCase()];
  if (!type) fail(`${path}: only jpg, png, gif, webp and avif can be uploaded`);
  let data = await readInput(path);
  if (type === 'image/jpeg') data = stripJpegMetadata(data);
  if (data.length > MAX_BYTES) fail(`${path}: ${(data.length / 1048576).toFixed(1)} MB is over the 5 MB limit; shrink it first (long side 2000 px is plenty).`);
  const form = new FormData();
  form.append('file', new Blob([data], { type }), basename(path));
  const { url } = await api('/upload', { method: 'POST', form });
  console.error(`uploaded ${path} → ${url}`);
  uploaded.set(path, url);
  return url;
}

const uploadLocalImages = (content, dir) => rewriteImages(content, (src) => upload(resolve(dir, src)));

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
  const out = serialize(full);
  process.stdout.write(out.endsWith('\n') ? out : `${out}\n`);
}

async function push(file, publish) {
  const text = await readInput(file, 'utf8');
  const parsed = parse(text);
  if (!parsed) fail('The file needs a front matter block (--- title: … ---).');
  const { meta, content } = parsed;
  // Privacy rule: refuse before anything (images included) is sent. The decoded front matter
  // is checked too, since a JSON string value can spell a character as \uXXXX.
  const hits = findForbidden([text, ...Object.values(meta).flat()].join('\n'));
  if (hits.length) fail(`${file} contains forbidden string ${hits.map((n) => `#${n}`).join(', ')} (scripts/forbidden.mjs). Nothing was sent.`);
  if (!meta.title) fail('title is required in the front matter.');
  const dir = dirname(resolve(file));

  // Warnings only: the post is still sent
  if (!meta.slug) console.error('warning: no slug in the front matter. Pushing this file again creates a new post each time; add an ASCII slug (e.g. slug: my-post) to update the same one.');
  for (const heading of headingsWithoutStop(content)) console.error(`warning: heading without a full stop: ${heading}`);

  // An update sends only what the file says: a key left out keeps its stored value, so a
  // file without `status:` does not take a published post down.
  const data = { title: meta.title, content: await uploadLocalImages(content, dir) };
  if (meta.slug) data.slug = meta.slug;
  if (meta.excerpt !== undefined) data.excerpt = meta.excerpt;
  if (meta.tags !== undefined) data.tags = meta.tags;
  if (meta.featured_image !== undefined) {
    data.featured_image = isLocal(meta.featured_image) ? await upload(resolve(dir, meta.featured_image)) : meta.featured_image;
  }
  if (publish) data.status = 'published';
  else if (meta.status !== undefined) data.status = meta.status;

  const existing = meta.slug ? (await allPosts()).find((p) => p.slug === meta.slug) : null;
  const result = existing
    ? await api('/posts', { method: 'PUT', body: { id: existing.id, ...data } })
    : await api('/posts', { method: 'POST', body: data });

  const verb = existing ? 'updated' : 'created';
  if (result.status === 'published') console.log(`${verb} and published: ${BASE}/log/p/${result.slug}/`);
  else console.log(`${verb} as a draft (slug: ${result.slug}). Publish with --publish or from ${BASE}/admin/.`);
}

// Flags can come before or after the arguments
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const [cmd, arg] = args.filter((a) => !a.startsWith('--'));
const usage = 'Usage: node scripts/cms.mjs list | get <slug> | push <file.md> [--publish]';
if (flags.some((f) => f !== '--publish')) fail(`Unknown option ${flags.find((f) => f !== '--publish')}\n${usage}`);
if (cmd === 'list') await list();
else if (cmd === 'get' && arg) await get(arg);
else if (cmd === 'push' && arg) await push(arg, flags.includes('--publish'));
else fail(usage);
