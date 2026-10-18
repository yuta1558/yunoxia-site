// Post validation and D1 access shared by the API and the public Log pages.

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Keys of uploaded images (api/upload.js makes them; this format has never changed)
export const KEY_RE = /^blog\/\d+-[0-9a-f]{8}\.(jpg|png|gif|webp|avif)$/;
const IMAGE_PREFIX = '/api/upload?key=';

// Control characters (other than tab and newlines) are invalid in the RSS feed's XML
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// The key inside a featured_image value, or '' when the value is not an uploaded image
function imageKey(value) {
  if (!value.startsWith(IMAGE_PREFIX)) return '';
  try {
    return decodeURIComponent(value.slice(IMAGE_PREFIX.length));
  } catch {
    return '';
  }
}

const LIMITS = { title: 200, excerpt: 500, content: 200_000, tag: 40, tags: 10, slug: 80 };

export function slugify(title) {
  const slug = String(title)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, LIMITS.slug)
    .replace(/^-|-$/g, '');
  return slug || `post-${Date.now().toString(36)}`;
}

// Validates a create/update payload. `partial` allows missing fields (updates).
export function validatePost(input, { partial = false } = {}) {
  const out = {};
  const str = (key, max, required) => {
    const value = input[key];
    if (value === undefined || value === null) {
      if (required && !partial) throw new Error(`${key} is required`);
      return;
    }
    if (typeof value !== 'string') throw new Error(`${key} must be a string`);
    const clean = value.replace(CONTROL_RE, '');
    const trimmed = key === 'content' ? clean : clean.trim();
    if (required && !trimmed) throw new Error(`${key} is required`);
    if (trimmed.length > max) throw new Error(`${key} is too long`);
    out[key] = trimmed;
  };

  str('title', LIMITS.title, true);
  str('content', LIMITS.content, true);
  str('excerpt', LIMITS.excerpt, false);

  if (input.slug !== undefined && input.slug !== '') {
    if (typeof input.slug !== 'string' || !SLUG_RE.test(input.slug) || input.slug.length > LIMITS.slug) {
      throw new Error('slug must be lowercase letters, digits and hyphens');
    }
    out.slug = input.slug;
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.length > LIMITS.tags) throw new Error('tags must be an array (max 10)');
    out.tags = [...new Set(input.tags.map((t) => {
      if (typeof t !== 'string') throw new Error('invalid tag');
      const tag = t.replace(CONTROL_RE, '').trim();
      if (!tag || tag.length > LIMITS.tag) throw new Error('invalid tag');
      return tag;
    }))];
  }

  if (input.status !== undefined) {
    if (input.status !== 'draft' && input.status !== 'published') throw new Error('status must be draft or published');
    out.status = input.status;
  }

  if (input.featured_image !== undefined) {
    if (typeof input.featured_image !== 'string') throw new Error('featured_image must be a string');
    const v = input.featured_image.trim();
    if (v && !KEY_RE.test(imageKey(v))) throw new Error('featured_image must be an uploaded image');
    out.featured_image = v;
  }

  return out;
}

export function rowToPost(row) {
  if (!row) return null;
  let tags = [];
  try {
    tags = JSON.parse(row.tags || '[]');
  } catch {}
  return { ...row, tags };
}

export async function getPublishedBySlug(db, slug) {
  if (!SLUG_RE.test(slug)) return null;
  const row = await db.prepare("SELECT * FROM posts WHERE slug = ? AND status = 'published'").bind(slug).first();
  return rowToPost(row);
}

// `withContent` adds the start of the body, for callers that derive an excerpt from it
// (the first paragraph is all excerpt() reads)
export async function listPublished(db, limit = 50, { withContent = false } = {}) {
  const { results } = await db
    .prepare(`SELECT id, slug, title, excerpt, ${withContent ? 'substr(content, 1, 4000) AS content, ' : ''}tags, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT ?`)
    .bind(limit)
    .all();
  return (results || []).map(rowToPost);
}
