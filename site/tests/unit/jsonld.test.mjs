// node --test tests/unit — structured data never names a person and never throws on a bad date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blogPosting, jsonLdString } from '../../src/lib/jsonld.mjs';

const url = 'https://yunoxia.one/log/p/x/';

test('date-only front matter and CMS timestamps', () => {
  assert.equal(blogPosting({ title: 't', date: new Date('2026-10-18'), url }).datePublished, '2026-10-18');
  // 07:30 JST on the 19th: the timestamp is kept, so the day is not shifted to the UTC 18th
  assert.equal(blogPosting({ title: 't', date: '2026-10-18T22:30:00.000Z', url }).datePublished, '2026-10-18T22:30:00.000Z');
});

test('a missing or invalid date is left out', () => {
  assert.equal('datePublished' in blogPosting({ title: 't', date: null, url }), false);
  assert.equal('datePublished' in blogPosting({ title: 't', date: 'nope', url }), false);
});

test('no author or person, and < cannot close the script tag', () => {
  const s = jsonLdString(blogPosting({ title: '</script><b>', date: '2026-10-18', url }));
  assert.doesNotMatch(s, /author|Person|publisher/);
  assert.doesNotMatch(s, /</);
});
