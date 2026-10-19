import assert from 'node:assert/strict';
import { test } from 'node:test';
import { numberHeadings, tocFromText, tocMarkup } from '../../src/lib/toc.mjs';

test('numberHeadings gives h2s ids in order and lists their text without tags', () => {
  const { html, toc } = numberHeadings('<p>a</p><h2>症状</h2><p>b</p><h2>原因 <code>x</code></h2><h3>c</h3>');
  assert.equal(html, '<p>a</p><h2 id="s1">症状</h2><p>b</p><h2 id="s2">原因 <code>x</code></h2><h3>c</h3>');
  assert.deepEqual(toc, [
    { id: 's1', html: '症状' },
    { id: 's2', html: '原因 x' },
  ]);
});

test('tocMarkup needs two sections and numbers the rows', () => {
  assert.equal(tocMarkup([{ id: 's1', html: 'a' }]), '');
  const out = tocMarkup([
    { id: 's1', html: 'a' },
    { id: 's2', html: 'b' },
  ]);
  assert.match(out, /<a href="#s1"><span>01<\/span>a<\/a><a href="#s2"><span>02<\/span>b<\/a>/);
  assert.match(out, /aria-label="目次"/);
});

test('tocFromText escapes plain heading text', () => {
  assert.deepEqual(tocFromText([{ slug: 'x', text: '<b>&' }]), [{ id: 'x', html: '&lt;b&gt;&amp;' }]);
});
