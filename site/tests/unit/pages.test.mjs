import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageItems } from '../../src/lib/pages.mjs';

test('first, last, current and neighbours, with … for longer gaps', () => {
  assert.deepEqual(pageItems(1, 1), [1]);
  assert.deepEqual(pageItems(2, 3), [1, 2, 3]);
  assert.deepEqual(pageItems(2, 12), [1, 2, 3, '…', 12]);
  assert.deepEqual(pageItems(6, 12), [1, '…', 5, 6, 7, '…', 12]);
  assert.deepEqual(pageItems(12, 12), [1, '…', 11, 12]);
});

test('a gap of one page shows the page, not …', () => {
  assert.deepEqual(pageItems(4, 12), [1, 2, 3, 4, 5, '…', 12]);
  assert.deepEqual(pageItems(9, 10), [1, '…', 8, 9, 10]);
});
