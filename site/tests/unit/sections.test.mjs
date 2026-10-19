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
  assert.equal(threeSteps('intro\n\n## a\n\nx\n\n## b\n\ny\n\n## c\n\nz'), null);
  assert.equal(threeSteps('## a\n\nx\n\n## b\n\ny'), null);
  assert.equal(threeSteps('## a\n\nx\n\n## b\n\ny\n\n## c\n\nz\n\n## d\n\nw'), null);
  assert.equal(threeSteps('## a\n\n## b\n\ny\n\n## c\n\nz'), null);
  assert.equal(threeSteps('## a\n\nx\n\n### sub\n\n## b\n\ny\n\n## c\n\nz'), null);
});
