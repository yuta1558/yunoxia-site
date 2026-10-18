// Minimal Markdown renderer for CMS posts.
// Safe by construction: every piece of text is HTML-escaped, raw HTML is never passed
// through, and link/image URLs are limited to http(s), mailto and same-site paths.
// Supported: headings, paragraphs, lists (one level), fenced code, blockquotes, rules,
// tables are not supported (rendered as text). Inline: `code`, **strong**, *em*, links, images.

import { escapeHtml } from './http.js';

function safeUrl(raw) {
  const url = raw.trim();
  if (/^(https?:|mailto:)/i.test(url)) return url;
  // A path starting "/\" is read by browsers as "//", another site
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return url;
  if (url.startsWith('#')) return url;
  return null;
}

const emphasis = (s) =>
  s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');

function inline(text) {
  // Placeholders: \u0000n\u0000 for code spans, \u0001n\u0001 for finished links and images.
  // Markup is set aside as soon as it is made, so a later pattern can never match across it
  // (an image's alt text closed by a link's href="… was an XSS). Input cannot contain either mark.
  const codes = [];
  const held = [];
  const hold = (html) => `\u0001${held.push(html) - 1}\u0001`;
  const codeText = (s) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => escapeHtml(codes[Number(i)]));

  let src = String(text).replace(/[\u0000\u0001]/g, '');
  src = src.replace(/`([^`]+)`/g, (_, code) => `\u0000${codes.push(code) - 1}\u0000`);
  src = escapeHtml(src);

  src = src.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (match, bang, label, url) => {
    if (/[\u0000\u0001]/.test(url)) return match;
    const safe = safeUrl(url.replaceAll('&amp;', '&'));
    if (!safe) return match;
    if (bang) return hold(`<img src="${escapeHtml(safe)}" alt="${codeText(label)}" loading="lazy" decoding="async">`);
    if (!label) return match;
    const external = /^https?:/i.test(safe);
    return hold(`<a href="${escapeHtml(safe)}"${external ? ' rel="noopener"' : ''}>${emphasis(label)}</a>`);
  });
  src = emphasis(src);

  return src
    .replace(/\u0001(\d+)\u0001/g, (_, i) => held[Number(i)])
    .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
}

export function renderMarkdown(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    const fence = line.match(/^```\s*([\w-]*)\s*$/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (or end of input)
      const lang = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : '';
      out.push(`<pre><code${lang}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      // Post titles are the page's h1, so body headings start at h2. `##` is h2 as in the
      // site's Markdown pages; a stray `#` is lifted to h2 rather than becoming a second h1.
      const level = Math.max(2, heading[1].length);
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(body.join(' '))}</p></blockquote>`);
      continue;
    }

    const listMatch = line.match(/^\s*([-*+]|\d+\.)\s+/);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1]);
      const pattern = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      const items = [];
      while (i < lines.length && pattern.test(lines[i])) items.push(lines[i++].match(pattern)[1]);
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6}\s|```|>\s?)/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}
