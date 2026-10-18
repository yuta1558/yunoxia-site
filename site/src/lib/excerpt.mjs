// The first prose paragraph of a Markdown body as plain text, for page descriptions and the
// RSS feed. Cut to `limit` characters at a sentence end where one falls late enough, else with "…".
export function excerpt(body, limit = 120) {
  const first =
    (body ?? '')
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .find((b) => b && !/^(#|>|[-*+] |\d+\. |```|\||<)/.test(b) && !/^!\[[^\]]*\]\([^)]*\)$/.test(b)) ?? '';
  const plain = first
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(plain);
  if (chars.length <= limit) return plain;
  const head = chars.slice(0, limit).join('');
  const end = Math.max(...['。', '！', '？', '. ', '! ', '? '].map((m) => head.lastIndexOf(m)));
  return end >= 40 ? head.slice(0, end + 1).trim() : `${chars.slice(0, limit - 1).join('').trim()}…`;
}
