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
