// Blog posts API (D1).
// GET    /api/posts                 published posts, newest first (public)
// GET    /api/posts?slug=x          one published post (public)
// GET    /api/posts?status=all      every post incl. drafts (admin; enforced by _middleware)
// GET    /api/posts?status=all&id=x one post incl. drafts (admin)
// POST   /api/posts                 create (admin)
// PUT    /api/posts                 update by id (admin)
// DELETE /api/posts?id=x            delete (admin)

import { error, json, readJson } from '../_lib/http.js';
import { getPublishedBySlug, rowToPost, slugify, validatePost } from '../_lib/posts.js';

async function uniqueSlug(db, base, excludeId = '') {
  let slug = base;
  for (let n = 2; await db.prepare('SELECT 1 FROM posts WHERE slug = ? AND id != ?').bind(slug, excludeId).first(); n++) {
    slug = `${base}-${n}`;
  }
  return slug;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const db = env.DB;
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '10', 10) || 10));
  const offset = (page - 1) * limit;
  const admin = url.searchParams.get('status') === 'all';

  try {
    if (admin && url.searchParams.has('id')) {
      const row = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(url.searchParams.get('id')).first();
      return row ? json({ post: rowToPost(row) }) : error('Post not found', 404);
    }

    const slug = url.searchParams.get('slug');
    if (slug !== null) {
      const post = await getPublishedBySlug(db, slug);
      return post ? json({ post }) : error('Post not found', 404);
    }

    const where = admin ? '' : "WHERE status = 'published'";
    const order = admin ? 'updated_at DESC' : 'published_at DESC';
    const [rows, count] = await Promise.all([
      db.prepare(`SELECT * FROM posts ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(limit, offset).all(),
      db.prepare(`SELECT COUNT(*) AS total FROM posts ${where}`).first(),
    ]);
    const total = count?.total || 0;

    return json({
      posts: (rows.results || []).map(rowToPost),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch {
    return error('Database error', 500);
  }
}

export async function onRequestPost({ request, env }) {
  const { value, error: bodyError } = await readJson(request);
  if (bodyError) return error(bodyError, 400);

  let post;
  try {
    post = validatePost(value);
  } catch (e) {
    return error(e.message, 400);
  }

  try {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const slug = await uniqueSlug(env.DB, post.slug || slugify(post.title));
    const status = post.status || 'draft';

    await env.DB.prepare(
      `INSERT INTO posts (id, slug, title, content, excerpt, tags, status, featured_image, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, slug, post.title, post.content, post.excerpt || '', JSON.stringify(post.tags || []), status,
        post.featured_image || '', now, now, status === 'published' ? now : null)
      .run();

    return json({ id, slug, status }, 201);
  } catch {
    return error('Failed to create post', 500);
  }
}

export async function onRequestPut({ request, env }) {
  const { value, error: bodyError } = await readJson(request);
  if (bodyError) return error(bodyError, 400);
  if (typeof value.id !== 'string' || !value.id) return error('id is required', 400);

  let changes;
  try {
    changes = validatePost(value, { partial: true });
  } catch (e) {
    return error(e.message, 400);
  }

  try {
    const existing = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(value.id).first();
    if (!existing) return error('Post not found', 404);

    const now = new Date().toISOString();
    const status = changes.status ?? existing.status;
    const slug = changes.slug && changes.slug !== existing.slug
      ? await uniqueSlug(env.DB, changes.slug, existing.id)
      : existing.slug;
    const publishedAt = status === 'published' && !existing.published_at ? now : existing.published_at;

    await env.DB.prepare(
      `UPDATE posts SET slug = ?, title = ?, content = ?, excerpt = ?, tags = ?, status = ?,
       featured_image = ?, updated_at = ?, published_at = ? WHERE id = ?`
    )
      .bind(slug, changes.title ?? existing.title, changes.content ?? existing.content,
        changes.excerpt ?? existing.excerpt, changes.tags ? JSON.stringify(changes.tags) : existing.tags,
        status, changes.featured_image ?? existing.featured_image, now, publishedAt, existing.id)
      .run();

    return json({ id: existing.id, slug, status, updated_at: now });
  } catch {
    return error('Failed to update post', 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return error('id is required', 400);
  try {
    const result = await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return result.meta.changes ? json({ deleted: true, id }) : error('Post not found', 404);
  } catch {
    return error('Failed to delete post', 500);
  }
}
