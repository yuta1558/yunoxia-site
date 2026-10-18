// GET /updates.json — the static map of last-updated times, plus published CMS posts,
// so the "updated since your last visit" marks also cover /log/p/<slug>/.

export async function onRequestGet(context) {
  const res = await context.next();
  if (!context.env.DB || !res.ok) return res;
  try {
    const updates = await res.clone().json();
    const { results } = await context.env.DB
      .prepare("SELECT slug, updated_at FROM posts WHERE status = 'published'")
      .all();
    for (const p of results || []) updates[`/log/p/${p.slug}/`] = p.updated_at;
    return new Response(JSON.stringify(updates), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return res;
  }
}
