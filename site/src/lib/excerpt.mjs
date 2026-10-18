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
    // Only paired marks are markup: snake_case and ~/path keep their characters
    .replace(/`([^`]*)`/g, '$1')
    // ** works inside words; __ and _ do not (a__b__c and snake_case stay), as in CommonMark
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '$1')
    .replace(/(^|\W)__(\S(?:.*?\S)?)__(?=\W|$)/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    // As in CommonMark, an emphasis mark does not close right after a space (*.md と *.js stays)
    .replace(/(^|[^\w*])\*([^*\s](?:[^*]*[^*\s])?)\*(?![\w*])/g, '$1$2')
    .replace(/(^|\W)_([^_\s](?:[^_]*[^_\s])?)_(?=\W|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(plain);
  if (chars.length <= limit) return plain;
  const head = chars.slice(0, limit).join('');
  const end = Math.max(...['。', '！', '？', '. ', '! ', '? '].map((m) => head.lastIndexOf(m)));
  return end >= 40 ? head.slice(0, end + 1).trim() : `${chars.slice(0, limit - 1).join('').trim()}…`;
}
