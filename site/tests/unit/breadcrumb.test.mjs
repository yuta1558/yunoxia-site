import assert from 'node:assert/strict';
import { test } from 'node:test';
import { breadcrumbMarkup } from '../../src/lib/breadcrumb.mjs';

test('ancestors are links, the last item is the current page, separators are hidden', () => {
  const out = breadcrumbMarkup([
    { label: 'yunoxia', href: '/' },
    { label: 'Log', href: '/log/' },
    { label: '<題>' },
  ]);
  assert.equal(
    out,
    '<nav class="breadcrumb" aria-label="パンくず"><a href="/">yunoxia</a><span aria-hidden="true">/</span><a href="/log/">Log</a><span aria-hidden="true">/</span><span aria-current="page">&lt;題&gt;</span></nav>',
  );
});

test('hreflang and the nav label are passed through', () => {
  const out = breadcrumbMarkup([{ label: 'Log', href: '/log/', hreflang: 'ja' }, { label: 'x' }], 'Breadcrumb');
  assert.match(out, /aria-label="Breadcrumb"/);
  assert.match(out, /<a href="\/log\/" hreflang="ja">Log<\/a>/);
});
