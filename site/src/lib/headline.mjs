// Headlines end with a full stop (CLAUDE.md, Typography). Titles in front matter and the CMS stay
// bare, because they also feed <title>, og:title, cards and RSS; the stop is added only in the h1.
// Plain JS with no dependencies: Astro pages and Pages Functions both import it.

const JAPANESE = /[぀-ヿ㐀-鿿豈-﫿]/;
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
// Ends in a stop, optionally followed by closing brackets or quotes (…。」, …!), "…?")
const ENDS_IN_STOP = /[。．.！？!?…][」』）)"'”’]*$/;
// A sentence-like English title has an all-lowercase word of 3+ letters ("Rebuilding this site");
// names such as "HevORT-lite" or "LPD8 DMX Kit" do not, because "-lite" is part of a larger token.
const LOWERCASE_WORD = /^[("'“‘]*[a-z]{3,}[)"'”’,:;]*$/;

export function withFullStop(title, lang = 'ja') {
  const text = String(title ?? '').trimEnd();
  if (!text || ENDS_IN_STOP.test(text)) return text;
  if (lang === 'en') {
    return text.split(/\s+/).some((word) => LOWERCASE_WORD.test(word)) ? `${text}.` : text;
  }
  // Korean headings end with a period, as English ones do ("만든 것.")
  if (lang === 'ko') return HANGUL.test(text) ? `${text}.` : text;
  return JAPANESE.test(text) ? `${text}。` : text;
}
