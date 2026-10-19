// UI strings and URL mapping for the two languages.
// Japanese lives at the root, English under /en/. Log is Japanese-only for now.

export type Lang = 'ja' | 'en';

export const ui = {
  ja: {
    siteTagline: '分解して、理解して、作り替える。',
    defaultDescription: '分解して、理解して、作り替える。yunoxia は、ゆーの制作と研究の記録です。作ったものは Works に、研究は Research に、途中経過は Log にあります。',
    skip: '本文へ移動',
    home: 'yunoxia ホーム',
    nav: 'メイン',
    theme: 'テーマ',
    footerNav: 'フッター',
    contact: '問い合わせ',
    language: '言語',
    langSwitch: 'EN',
    langSwitchLabel: 'English version of this page',
    logLabel: 'Log',
    updated: '更新',
    ogLocale: 'ja_JP',
  },
  en: {
    siteTagline: 'Take it apart. Understand it. Remake it.',
    defaultDescription: "Take it apart. Understand it. Remake it. yunoxia is Yu's record of making and research.",
    skip: 'Skip to content',
    home: 'yunoxia home',
    nav: 'Main',
    theme: 'Theme',
    footerNav: 'Footer',
    contact: 'Contact',
    language: 'Language',
    langSwitch: 'JA',
    langSwitchLabel: 'このページの日本語版',
    logLabel: 'Log (ja)',
    updated: 'updated',
    ogLocale: 'en_US',
  },
} as const;

export const langOf = (pathname: string): Lang => (pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ja');

// Pages that exist in both languages. Log, its entries and 404 are Japanese-only.
const translatable = /^\/(?:(?:works(?:\/[^/]+)?|research|about)\/)?$/;

/** The same page in the other language, or null when there is no counterpart. */
export function counterpart(pathname: string): string | null {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (langOf(path) === 'en') {
    const ja = path.slice(3) || '/';
    return translatable.test(ja) ? ja : null;
  }
  return translatable.test(path) ? `/en${path}` : null;
}

/** Prefix a root-relative path for the given language. Log stays Japanese. */
export const localPath = (lang: Lang, path: string) =>
  lang === 'en' && !path.startsWith('/log') ? `/en${path}` : path;
