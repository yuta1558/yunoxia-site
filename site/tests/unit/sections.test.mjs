import assert from 'node:assert/strict';
import { test } from 'node:test';
import { threeSteps } from '../../src/lib/sections.mjs';

test('three ## sections become the three steps', () => {
  const md = '\n## 分解。\n\nA\n\n## 理解。\n\nB\n\nB2\n\n## 作り替え。\n\nC [Log](/log/)\n';
  assert.deepEqual(threeSteps(md), [
    { heading: '分解。', body: 'A' },
    { heading: '理解。', body: 'B\n\nB2' },
    { heading: '作り替え。', body: 'C [Log](/log/)' },
  ]);
});

test('other shapes stay prose', () => {
  const ja = (a, b, c) => `## 分解。\n\n${a}\n\n## 理解。\n\n${b}\n\n## 作り替え。\n\n${c}`;
  assert.equal(threeSteps('intro\n\n' + ja('x', 'y', 'z')), null);
  // Three sections with other headings
  assert.equal(threeSteps('## 背景。\n\nx\n\n## 方法。\n\ny\n\n## 結果。\n\nz'), null);
  // Shapes the CMS renderer cannot draw
  assert.equal(threeSteps(ja('x', '| a | b |\n| - | - |\n| 1 | 2 |', 'z')), null);
  assert.equal(threeSteps(ja('x', '<kbd>Ctrl</kbd>', 'z')), null);
  assert.equal(threeSteps(ja('x', '[Log](../log/)', 'z')), null);
  assert.ok(threeSteps(ja('x', '[Log](/log/) [a](https://example.com) [b](#s1)', 'z')));
  // A "## " line inside a code fence
  assert.equal(threeSteps(ja('x', '```\n## not a heading\n```', 'z')), null);
  assert.deepEqual(
    threeSteps('## Take it apart.\n\nx\n\n## Understand it.\n\ny\n\n## Remake it.\n\nz').map((s) => s.heading),
    ['Take it apart.', 'Understand it.', 'Remake it.'],
  );
  assert.equal(threeSteps('## a\n\nx\n\n## b\n\ny'), null);
  assert.equal(threeSteps('## a\n\nx\n\n## b\n\ny\n\n## c\n\nz\n\n## d\n\nw'), null);
  assert.equal(threeSteps('## a\n\n## b\n\ny\n\n## c\n\nz'), null);
  assert.equal(threeSteps('## a\n\nx\n\n### sub\n\n## b\n\ny\n\n## c\n\nz'), null);
});
