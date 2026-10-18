// Small response helpers shared by the Pages Functions.

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function error(message, status) {
  return json({ error: message }, status);
}

export async function readJson(request, maxBytes = 512 * 1024) {
  try {
    const text = await request.text();
    if (text.length > maxBytes) return { error: 'Request body too large' };
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { error: 'JSON object expected' };
    }
    return { value };
  } catch {
    return { error: 'Invalid JSON' };
  }
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
