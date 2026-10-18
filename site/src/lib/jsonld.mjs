// JSON-LD for Base.astro. No Person, author or publisher: the site never names its owner.

/** Serialise for a <script type="application/ld+json">: `<` is escaped so the data can never close the tag. */
export function jsonLdString(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** WebSite: emitted by Base.astro on the top pages (/ and /en/). */
export function webSite({ url, lang, description }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'yunoxia',
    url: String(url),
    inLanguage: lang,
    description,
  };
}

/**
 * BlogPosting for a Log post; pass the result to Base as `jsonLd`. `date` is a Date from date-only
 * front matter (written as YYYY-MM-DD) or a CMS timestamp string (written as is, so the instant
 * and its day in JST stay right). An invalid or missing date is left out rather than throwing, and so
 * is `modified` (dateModified, same rules); `image` is an absolute URL.
 */
export function blogPosting({ title, date, modified, image, url, description, lang = 'ja' }) {
  const stamp = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
  const ok = (d) => d != null && !Number.isNaN(+new Date(d));
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    ...(ok(date) && { datePublished: stamp(date) }),
    ...(ok(modified) && { dateModified: stamp(modified) }),
    inLanguage: lang,
    url: String(url),
    mainEntityOfPage: String(url),
  };
  if (description) data.description = description;
  if (image) data.image = String(image);
  return data;
}
