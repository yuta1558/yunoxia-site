// node --test tests/unit — page descriptions from the first paragraph of a Markdown body.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excerpt } from '../../src/lib/excerpt.mjs';

test('skips headings and images, strips inline markup', () => {
  assert.equal(excerpt('## 見出し\n\n![図](/a.png)\n\n**太字**と[リンク](/x)と`code`。\n次の行。\n\n二段落目'), '太字とリンクとcode。 次の行。');
});

test('long text is cut at a sentence end, or with an ellipsis', () => {
  const s = 'あ'.repeat(60) + '。' + 'い'.repeat(100);
  assert.equal(excerpt(s), 'あ'.repeat(60) + '。');
  const t = 'う'.repeat(200);
  assert.equal(excerpt(t), 'う'.repeat(119) + '…');
});

test('empty body', () => {
  assert.equal(excerpt(''), '');
  assert.equal(excerpt(undefined), '');
});

test('only paired emphasis marks are removed', () => {
  assert.equal(excerpt('snake_case と ~/path と a*b、*斜体*、_下線_、~~消し~~、__太字__。'), 'snake_case と ~/path と a*b、斜体、下線、消し、太字。');
});

test('lone marks around spaces are not emphasis', () => {
  assert.equal(excerpt('*.md と *.js、_a と _b、2 * 3 * 4、*強調*。'), '*.md と *.js、_a と _b、2 * 3 * 4、強調。');
});

test('double underscores inside words are not emphasis', () => {
  // __init__.py is strong "init" in CommonMark, so the text reads init.py, as on the page
  assert.equal(excerpt('a__b__c と a**b**c と __init__.py。'), 'a__b__c と abc と init.py。');
});

test('link and image URLs may hold one level of parentheses, as in markdown.js', () => {
  assert.equal(excerpt('[Wiki](https://e.com/a_(b)) を読む。'), 'Wiki を読む。');
  assert.equal(excerpt('![](/p_(1).png)\n\nBody.'), 'Body.');
});

test('a link or image title is part of the link, as in CommonMark', () => {
  assert.equal(excerpt('[a](https://e.com "Title") を読む。'), 'a を読む。');
  assert.equal(excerpt('![](a.jpg "Cover")\n\nBody.'), 'Body.');
});

test('a setext heading is skipped like a # heading, as markdown.js renders it', () => {
  assert.equal(excerpt('はじめに\n---\n\n本文です。'), '本文です。');
  assert.equal(excerpt('見出し\n---\n本文です。'), '本文です。');
  assert.equal(excerpt('Title\n===\n\nBody.'), 'Body.');
  assert.equal(excerpt('---\n\nBody.'), 'Body.');
});

test('a --- inside fenced code does not cut the code block', () => {
  assert.equal(excerpt('```yaml\ntitle: a\n---\nfoo: bar\n```\n\nBody.'), 'Body.');
});
