// Blog Posts CRUD API
// GET    /api/posts          - List published posts (public)
// GET    /api/posts?status=all - List all posts (auth required)
// GET    /api/posts?slug=xxx - Get single post by slug (public if published)
// POST   /api/posts          - Create post (auth required)
// PUT    /api/posts          - Update post (auth required)
// DELETE /api/posts          - Delete post (auth required)

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateId() {
  return crypto.randomUUID();
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s\u3000-\u9fff\uff00-\uffef-]/g, '')
    .replace(/[\s\u3000]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `post-${Date.now()}`;
}

function nowISO() {
  return new Date().toISOString();
}

// GET /api/posts
export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);

  const slug = url.searchParams.get('slug');
  const status = url.searchParams.get('status');
  const tag = url.searchParams.get('tag');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const offset = (page - 1) * limit;

  try {
    // Single post by slug
    if (slug) {
      const post = await env.DB.prepare(
        'SELECT * FROM posts WHERE slug = ?'
      ).bind(slug).first();

      if (!post) {
        return jsonResponse({ error: 'Post not found' }, 404);
      }

      // Only return published posts publicly (unless admin request with status=all)
      if (post.status !== 'published' && status !== 'all') {
        return jsonResponse({ error: 'Post not found' }, 404);
      }

      post.tags = JSON.parse(post.tags || '[]');
      return jsonResponse({ post });
    }

    // List posts
    let query, countQuery;
    const params = [];
    const countParams = [];

    if (status === 'all') {
      // Admin: all posts (auth enforced by middleware for non-GET with status param)
      query = 'SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as total FROM posts';
      params.push(limit, offset);
    } else if (tag) {
      // Filter by tag
      query = `SELECT * FROM posts WHERE status = 'published' AND tags LIKE ? ORDER BY published_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT COUNT(*) as total FROM posts WHERE status = 'published' AND tags LIKE ?`;
      const tagPattern = `%"${tag}"%`;
      params.push(tagPattern, limit, offset);
      countParams.push(tagPattern);
    } else {
      // Public: only published posts
      query = `SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT COUNT(*) as total FROM posts WHERE status = 'published'`;
      params.push(limit, offset);
    }

    const [postsResult, countResult] = await Promise.all([
      env.DB.prepare(query).bind(...params).all(),
      env.DB.prepare(countQuery).bind(...countParams).first(),
    ]);

    const posts = (postsResult.results || []).map((post) => ({
      ...post,
      tags: JSON.parse(post.tags || '[]'),
    }));

    const total = countResult?.total || 0;

    return jsonResponse({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    return jsonResponse({ error: 'Database error', details: err.message }, 500);
  }
}

// POST /api/posts
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const { title, content, excerpt, tags, status, featured_image } = body;

    if (!title || !content) {
      return jsonResponse({ error: 'Title and content are required' }, 400);
    }

    const id = generateId();
    let slug = body.slug || generateSlug(title);

    // Ensure slug uniqueness
    const existing = await env.DB.prepare(
      'SELECT id FROM posts WHERE slug = ?'
    ).bind(slug).first();

    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const now = nowISO();
    const postStatus = status === 'published' ? 'published' : 'draft';
    const publishedAt = postStatus === 'published' ? now : null;

    await env.DB.prepare(
      `INSERT INTO posts (id, slug, title, content, excerpt, tags, status, featured_image, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      slug,
      title,
      content,
      excerpt || '',
      JSON.stringify(tags || []),
      postStatus,
      featured_image || '',
      now,
      now,
      publishedAt
    ).run();

    return jsonResponse({ id, slug, status: postStatus }, 201);
  } catch (err) {
    return jsonResponse({ error: 'Failed to create post', details: err.message }, 500);
  }
}

// PUT /api/posts
export async function onRequestPut(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return jsonResponse({ error: 'Post ID is required' }, 400);
    }

    const existing = await env.DB.prepare(
      'SELECT * FROM posts WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return jsonResponse({ error: 'Post not found' }, 404);
    }

    const now = nowISO();
    const title = body.title ?? existing.title;
    const content = body.content ?? existing.content;
    const excerpt = body.excerpt ?? existing.excerpt;
    const tags = body.tags !== undefined ? JSON.stringify(body.tags) : existing.tags;
    const status = body.status ?? existing.status;
    const featured_image = body.featured_image ?? existing.featured_image;

    // Handle slug changes
    let slug = existing.slug;
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await env.DB.prepare(
        'SELECT id FROM posts WHERE slug = ? AND id != ?'
      ).bind(body.slug, id).first();
      slug = slugExists ? `${body.slug}-${Date.now().toString(36)}` : body.slug;
    }

    // Set published_at when first published
    let publishedAt = existing.published_at;
    if (status === 'published' && !existing.published_at) {
      publishedAt = now;
    }

    await env.DB.prepare(
      `UPDATE posts SET slug = ?, title = ?, content = ?, excerpt = ?, tags = ?,
       status = ?, featured_image = ?, updated_at = ?, published_at = ?
       WHERE id = ?`
    ).bind(
      slug, title, content, excerpt, tags,
      status, featured_image, now, publishedAt, id
    ).run();

    return jsonResponse({ id, slug, status, updated_at: now });
  } catch (err) {
    return jsonResponse({ error: 'Failed to update post', details: err.message }, 500);
  }
}

// DELETE /api/posts
export async function onRequestDelete(context) {
  const { env, request } = context;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return jsonResponse({ error: 'Post ID is required' }, 400);
    }

    const result = await env.DB.prepare(
      'DELETE FROM posts WHERE id = ?'
    ).bind(id).run();

    if (result.meta.changes === 0) {
      return jsonResponse({ error: 'Post not found' }, 404);
    }

    return jsonResponse({ deleted: true, id });
  } catch (err) {
    return jsonResponse({ error: 'Failed to delete post', details: err.message }, 500);
  }
}
