// Marks links to pages updated since the visitor's previous visit (data-updated="true").
// Visit times stay in this browser only. Runs with or without the bead.

const LAST = 'yx:lastVisit';
const PREV = 'yx:prevVisit';

const norm = (path: string) => (path.endsWith('/') ? path : `${path}/`);

function previousVisit(): number | null {
  try {
    let prev = sessionStorage.getItem(PREV);
    if (prev === null) {
      // First page of this session: keep the last visit as the baseline for the whole session
      prev = localStorage.getItem(LAST) ?? '';
      sessionStorage.setItem(PREV, prev);
    }
    const t = Date.parse(prev);
    return Number.isNaN(t) ? null : t;
  } catch {
    return null;
  }
}

export async function markUpdates() {
  addEventListener('pagehide', () => {
    try {
      localStorage.setItem(LAST, new Date().toISOString());
    } catch {}
  });

  const prev = previousVisit();
  if (prev === null) return;

  let updates: Record<string, string>;
  try {
    const res = await fetch('/updates.json');
    if (!res.ok) return;
    updates = await res.json();
  } catch {
    return;
  }

  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (a.origin !== location.origin) continue;
    const t = updates[norm(a.pathname)];
    if (t && Date.parse(t) > prev) a.dataset.updated = 'true';
  }
}
