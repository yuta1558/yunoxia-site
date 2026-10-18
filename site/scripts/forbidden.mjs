// Strings that must never appear on the site (owner's real name, employer, location).
// Stored encoded so this public repository does not spell them out. Used by the e2e suite,
// scripts/privacy-check.mjs and scripts/cms.mjs.
export const FORBIDDEN = ['5bGx76iR', '5bGx5bSO', '5YSq5aSq', 'Ry1aRVJP', 'R1VURU5CRVJH', '6JKy55Sw'].map((b) =>
  Buffer.from(b, 'base64').toString('utf8'),
);

// 1-based numbers of the forbidden strings found in text, so callers can report them without
// printing the strings.
export const findForbidden = (text) => FORBIDDEN.flatMap((word, i) => (text.includes(word) ? [i + 1] : []));
