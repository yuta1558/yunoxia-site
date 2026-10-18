// node --test tests/unit — the CMS Markdown renderer never emits markup from post text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../../functions/_lib/markdown.js';

test('an image inside link text cannot break out of its alt attribute', () => {
  // Before the fix, the link pass matched across the finished <img>, and its href=" closed the alt
  // attribute: browsers then read "/onerror=…" as an onerror handler.
  assert.equal(
    renderMarkdown('![[y](/a)](/x/onerror=window.onerror=alert;throw+1//)'),
    '<p><img src="/a" alt="[y" loading="lazy" decoding="async">](/x/onerror=window.onerror=alert;throw+1//)</p>',
  );
});

test('links, images, code and emphasis still render', () => {
  assert.equal(
    renderMarkdown('**b** [*l*](https://e.com) ![alt `c`](/i.png) `k`'),
    '<p><strong>b</strong> <a href="https://e.com" rel="noopener"><em>l</em></a> <img src="/i.png" alt="alt c" loading="lazy" decoding="async"> <code>k</code></p>',
  );
});

test('unsafe or odd URLs stay as text', () => {
  assert.equal(renderMarkdown('[a](javascript:alert(1))'), '<p>[a](javascript:alert(1))</p>');
  assert.equal(renderMarkdown('[a](/\\evil.example)'), '<p>[a](/\\evil.example)</p>');
  assert.equal(renderMarkdown('[a](/p`q`r)'), '<p>[a](/p<code>q</code>r)</p>');
});

test('placeholder characters in the input are dropped, not expanded', () => {
  assert.equal(renderMarkdown('x \u00000\u0000 \u00010\u0001 y'), '<p>x 0 0 y</p>');
});

test('raw HTML is escaped', () => {
  assert.equal(renderMarkdown('<img src=x onerror=alert(1)> & "q"'), '<p>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;</p>');
});

test('control characters are removed from post fields', async () => {
  const { validatePost } = await import('../../functions/_lib/posts.js');
  const out = validatePost({ title: 'Tab\u0008bell\u0000', content: 'a\tb\nc\u001F' });
  assert.equal(out.title, 'Tabbell');
  assert.equal(out.content, 'a\tb\nc');
});
