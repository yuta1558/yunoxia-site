// Which page numbers a Pagination shows: the first, the last, the current one and its neighbours,
// with "…" where numbers are left out. A gap of a single page shows that page instead of "…".

/**
 * @param {number} current  1-based
 * @param {number} total
 * @returns {(number | '…')[]}
 */
export function pageItems(current, total) {
  const keep = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const out = [];
  let last = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - last === 2) out.push(last + 1);
    else if (n - last > 2) out.push('…');
    out.push(n);
    last = n;
  }
  return out;
}
