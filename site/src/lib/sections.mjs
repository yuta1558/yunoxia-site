// A Works body written as the three steps (## 分解。 / ## 理解。 / ## 作り替え。, or the English
// equivalents) becomes the three columns of the dark band on its page. Anything else stays prose.

/**
 * @param {string} markdown
 * @returns {{ heading: string, body: string }[] | null}  three sections, or null when the body is not in that shape
 */
export function threeSteps(markdown) {
  const parts = String(markdown).replace(/\r\n?/g, '\n').split(/^## +(.+)$/m);
  // parts: [before, heading1, body1, heading2, body2, …]
  if (parts[0].trim() !== '' || parts.length !== 7) return null;
  const sections = [];
  for (let i = 1; i < parts.length; i += 2) sections.push({ heading: parts[i].trim(), body: parts[i + 1].trim() });
  // A section with deeper headings or no text does not fit a column
  if (sections.some((s) => !s.body || /^#{1,6} /m.test(s.body))) return null;
  return sections;
}
