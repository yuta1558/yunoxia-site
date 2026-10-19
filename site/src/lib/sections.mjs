// A Works body written as the three steps (## 分解。 / ## 理解。 / ## 作り替え。, or the English
// and Korean equivalents) becomes the three columns of the dark band on its page. Anything else stays prose:
// other headings, another number of sections, text before the first one, deeper headings, or code
// fences (a "## " line inside one is not a heading).
// The band renders the steps with the CMS renderer (functions/_lib/markdown.js), which has no tables,
// escapes raw HTML and drops links that are not absolute paths, #fragments, http(s) or mailto. A body
// using any of those stays prose, so it never breaks silently.

const STEPS = [
  ['分解。', '理解。', '作り替え。'],
  ['Take it apart.', 'Understand it.', 'Remake it.'],
  ['분해.', '이해.', '다시 만들기.'],
];

/**
 * @param {string} markdown
 * @returns {{ heading: string, body: string }[] | null}  three sections, or null when the body is not in that shape
 */
export function threeSteps(markdown) {
  const text = String(markdown).replace(/\r\n?/g, '\n');
  if (/^ {0,3}(```|~~~)/m.test(text)) return null;
  // Tables, raw HTML, and links the CMS renderer would drop (relative paths such as ../log/)
  if (/^\s*\|/m.test(text) || /<[A-Za-z/!]/.test(text) || /\]\((?!https?:|mailto:|#|\/(?![/\\]))/i.test(text)) return null;
  const parts = text.split(/^## +(.+)$/m);
  // parts: [before, heading1, body1, heading2, body2, …]
  if (parts[0].trim() !== '' || parts.length !== 7) return null;
  const sections = [];
  for (let i = 1; i < parts.length; i += 2) sections.push({ heading: parts[i].trim(), body: parts[i + 1].trim() });
  // A section with deeper headings or no text does not fit a column
  if (sections.some((s) => !s.body || /^#{1,6} /m.test(s.body))) return null;
  const headings = sections.map((s) => s.heading);
  if (!STEPS.some((set) => set.every((h, i) => h === headings[i]))) return null;
  return sections;
}
