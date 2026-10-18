import { getCollection } from 'astro:content';

// Last-updated time per page, used to mark links changed since the visitor's previous visit.
export async function GET() {
  const updates: Record<string, string> = {};
  for (const w of await getCollection('works')) updates[`/works/${w.id}/`] = w.data.updated.toISOString();
  for (const w of await getCollection('worksEn')) updates[`/en/works/${w.id}/`] = w.data.updated.toISOString();
  for (const l of await getCollection('log')) updates[`/log/${l.id}/`] = l.data.date.toISOString();
  return new Response(JSON.stringify(updates), {
    headers: { 'Content-Type': 'application/json' },
  });
}
