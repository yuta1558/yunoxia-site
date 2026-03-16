// Image Upload API
// POST /api/upload - Upload image to R2 (auth required)
// GET  /api/upload?key=xxx - Get image from R2 (public)

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/upload?key=xxx
export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return jsonResponse({ error: 'Key parameter required' }, 400);
  }

  try {
    const object = await env.IMAGES.get(key);

    if (!object) {
      return jsonResponse({ error: 'Image not found' }, 404);
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('ETag', object.httpEtag);

    return new Response(object.body, { headers });
  } catch (err) {
    return jsonResponse({ error: 'Failed to retrieve image' }, 500);
  }
}

// POST /api/upload
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const contentType = request.headers.get('Content-Type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ error: 'Multipart form data required' }, 400);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return jsonResponse({ error: 'No file provided' }, 400);
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonResponse({
        error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG',
      }, 400);
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return jsonResponse({ error: 'File too large. Maximum 5MB' }, 400);
    }

    // Generate unique key
    const ext = file.name.split('.').pop() || 'bin';
    const key = `blog/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    // Upload to R2
    await env.IMAGES.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Return the URL for the uploaded image
    const imageUrl = `/api/upload?key=${encodeURIComponent(key)}`;

    return jsonResponse({
      url: imageUrl,
      key,
      name: file.name,
      size: file.size,
      type: file.type,
    }, 201);
  } catch (err) {
    return jsonResponse({ error: 'Upload failed', details: err.message }, 500);
  }
}
