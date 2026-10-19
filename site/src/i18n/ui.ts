// UI strings and URL mapping for the languages.
// Japanese lives at the root, English under /en/, Korean under /ko/ (only the pages that have a Korean
// version, listed from src/content/ko). Log is Japanese-only for now.

export type Lang = 'ja' | 'en' | 'ko';
export const LANGS: Lang[] = ['ja', 'en', 'ko'];

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
    logLabel: 'Log (ja)',
    updated: 'updated',
    ogLocale: 'en_US',
  },
  ko: {
    siteTagline: '분해하고, 이해하고, 다시 만든다.',
    defaultDescription: '분해하고, 이해하고, 다시 만든다. yunoxia는 유의 제작과 연구 기록입니다.',
    skip: '본문으로 건너뛰기',
    home: 'yunoxia 홈',
    nav: '메인',
    theme: '테마',
    footerNav: '푸터',
    contact: '문의',
    language: '언어',
    logLabel: 'Log (ja)',
    updated: '업데이트',
    ogLocale: 'ko_KR',
  },
} as const;

/** Read by screen readers after a language code in a switch, in the language it leads to */
export const versionLabel: Record<Lang, string> = {
  ja: 'このページの日本語版',
  en: 'English version of this page',
  ko: '이 페이지의 한국어판',
};

export const langOf = (pathname: string): Lang =>
  pathname === '/en' || pathname.startsWith('/en/') ? 'en' : pathname === '/ko' || pathname.startsWith('/ko/') ? 'ko' : 'ja';

// Pages that exist in Japanese and English. Log, its entries and 404 are Japanese-only.
const translatable = /^\/(?:(?:works(?:\/[^/]+)?|research|about)\/)?$/;

// Pages with a Korean version: one per Markdown file under src/content/ko/works
const koPaths = new Set(
  Object.keys(import.meta.glob('../content/ko/works/*.md')).map((f) => `/works/${f.split('/').pop()!.replace(/\.md$/, '')}/`),
);

/** The page's path without its language prefix, with a trailing slash */
const basePath = (pathname: string) => {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const lang = langOf(path);
  return lang === 'ja' ? path : path.slice(3) || '/';
};

/** The same page in every language it exists in (the page itself included) */
export function versionsOf(pathname: string): Partial<Record<Lang, string>> {
  const base = basePath(pathname);
  const out: Partial<Record<Lang, string>> = {};
  if (translatable.test(base)) {
    out.ja = base;
    out.en = `/en${base}`;
  }
  if (koPaths.has(base)) {
    out.ja = base;
    out.ko = `/ko${base}`;
  }
  return out;
}

/** Prefix a root-relative path for the given language. Log stays Japanese; Korean only where a Korean page exists. */
export const localPath = (lang: Lang, path: string) => {
  if (lang === 'en') return path.startsWith('/log') ? path : `/en${path}`;
  if (lang === 'ko') return koPaths.has(path) ? `/ko${path}` : path;
  return path;
};
