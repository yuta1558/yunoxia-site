#!/usr/bin/env node
// Write Log posts to the CMS from the command line, so Claude (or anyone with the API token) can
// draft and publish without the admin UI.
//
//   CMS_TOKEN=… node scripts/cms.mjs list
//   CMS_TOKEN=… node scripts/cms.mjs get <slug>            # prints the post as a Markdown file
//   CMS_TOKEN=… node scripts/cms.mjs push <file.md>        # create, or update the post with that slug
//   CMS_TOKEN=… node scripts/cms.mjs push <file.md> --publish
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
// with their URLs. CMS_URL defaults to https://yunoxia.one. CMS_TOKEN is the CMS_API_TOKEN secret
// of the Pages project (see DEPLOY.md).

import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';

const BASE = (process.env.CMS_URL || 'https://yunoxia.one').replace(/\/$/, '');
const TOKEN = process.env.CMS_TOKEN;
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
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

async function upload(path) {
  if (uploaded.has(path)) return uploaded.get(path);
  const type = TYPES[extname(path).toLowerCase()];
  if (!type) fail(`${path}: only jpg, png, gif, webp and avif can be uploaded`);
  const form = new FormData();
  form.append('file', new Blob([await readFile(path)], { type }), basename(path));
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
  const { meta, content } = parse(await readFile(file, 'utf8'));
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
if (!TOKEN) fail('Set CMS_TOKEN to the CMS_API_TOKEN secret of the Pages project.');
if (cmd === 'list') await list();
else if (cmd === 'get' && arg) await get(arg);
else if (cmd === 'push' && arg) await push(arg, flags.includes('--publish'));
else fail('Usage: node scripts/cms.mjs list | get <slug> | push <file.md> [--publish]');
