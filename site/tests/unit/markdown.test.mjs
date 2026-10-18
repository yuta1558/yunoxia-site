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

test('URLs with one level of balanced parentheses keep them', () => {
  assert.equal(
    renderMarkdown('[x](https://e.com/a_(b)) ![i](/p_(1).png)'),
    '<p><a href="https://e.com/a_(b)" rel="noopener">x</a> <img src="/p_(1).png" alt="i" loading="lazy" decoding="async"></p>',
  );
  assert.equal(renderMarkdown('([x](https://e.com/a))'), '<p>(<a href="https://e.com/a" rel="noopener">x</a>)</p>');
});

test('a rule line interrupts a paragraph; --- or === right under text makes a heading', () => {
  assert.equal(renderMarkdown('a\n***\nb'), '<p>a</p>\n<hr>\n<p>b</p>');
  assert.equal(renderMarkdown('a\n- - -\nb'), '<p>a</p>\n<hr>\n<p>b</p>');
  // As in CommonMark and the editor's preview (setext headings; h1 is the post title, so h2)
  assert.equal(renderMarkdown('a\n---\nb'), '<h2>a</h2>\n<p>b</p>');
  assert.equal(renderMarkdown('a\nb\n==='), '<h2>a b</h2>');
  assert.equal(renderMarkdown('---\nb'), '<hr>\n<p>b</p>');
});

test('an empty > line splits a blockquote into paragraphs', () => {
  assert.equal(renderMarkdown('> a\n>\n> b'), '<blockquote><p>a</p><p>b</p></blockquote>');
  assert.equal(renderMarkdown('> a\n> b'), '<blockquote><p>a b</p></blockquote>');
});

test('emphasis nests in strong; a * between word characters stays literal', () => {
  assert.equal(renderMarkdown('**bold *it* x**'), '<p><strong>bold <em>it</em> x</strong></p>');
  assert.equal(renderMarkdown('2*3*4'), '<p>2*3*4</p>');
  assert.equal(renderMarkdown('a *b* c'), '<p>a <em>b</em> c</p>');
  // Crossed marks never produce crossed tags
  assert.equal(renderMarkdown('**a *b** c*'), '<p><strong>a *b</strong> c*</p>');
  assert.equal(renderMarkdown('***x*** y'), '<p><em><strong>x</strong></em> y</p>');
  // ...and strong nests in em
  assert.equal(renderMarkdown('*a **b** c*'), '<p><em>a <strong>b</strong> c</em></p>');
  assert.equal(renderMarkdown('**[*l*](/x)**'), '<p><strong><a href="/x"><em>l</em></a></strong></p>');
});

test('uploaded images with a sized key get width and height; others do not', () => {
  const sized = encodeURIComponent('blog/1700000000000-0123abcd-37x23.png');
  assert.equal(
    renderMarkdown(`![a](/api/upload?key=${sized})`),
    `<p><img src="/api/upload?key=${sized}" alt="a" width="37" height="23" loading="lazy" decoding="async"></p>`,
  );
  const plain = '/api/upload?key=blog%2F1700000000000-0123abcd.png';
  assert.equal(renderMarkdown(`![a](${plain})`), `<p><img src="${plain}" alt="a" loading="lazy" decoding="async"></p>`);
  assert.equal(renderMarkdown('![a](https://e.com/api/upload?key=blog%2F1-0123abcd-37x23.png)'), '<p><img src="https://e.com/api/upload?key=blog%2F1-0123abcd-37x23.png" alt="a" loading="lazy" decoding="async"></p>');
  assert.equal(renderMarkdown('![a](/x-37x23.png)'), '<p><img src="/x-37x23.png" alt="a" loading="lazy" decoding="async"></p>');
});
