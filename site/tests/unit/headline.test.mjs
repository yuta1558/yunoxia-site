// node --test tests/unit — the full stop added to work and Log h1s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFullStop } from '../../src/lib/headline.mjs';

test('Japanese titles get 。', () => {
  assert.equal(withFullStop('このサイトの作り直し', 'ja'), 'このサイトの作り直し。');
  assert.equal(withFullStop('演出を 17 個足した', 'ja'), '演出を 17 個足した。');
  assert.equal(withFullStop('BLTouch トラブルシューティング（多言語）', 'ja'), 'BLTouch トラブルシューティング（多言語）。');
});

test('already punctuated titles stay', () => {
  assert.equal(withFullStop('進み具合の記録。', 'ja'), '進み具合の記録。');
  assert.equal(withFullStop('本当に？', 'ja'), '本当に？');
  assert.equal(withFullStop('「分解して、理解して、作り替える。」', 'ja'), '「分解して、理解して、作り替える。」');
  assert.equal(withFullStop('Made, and in the making.', 'en'), 'Made, and in the making.');
  assert.equal(withFullStop('Why does it fail?', 'en'), 'Why does it fail?');
});

test('ASCII names stay', () => {
  for (const name of ['HevORT-lite', 'LPD8 DMX Kit']) {
    assert.equal(withFullStop(name, 'ja'), name);
    assert.equal(withFullStop(name, 'en'), name);
  }
});

test('sentence-like English titles get a full stop', () => {
  assert.equal(withFullStop('Rebuilding this site', 'en'), 'Rebuilding this site.');
  assert.equal(withFullStop('BLTouch troubleshooting (multilingual)', 'en'), 'BLTouch troubleshooting (multilingual).');
});

test('empty input', () => {
  assert.equal(withFullStop('', 'ja'), '');
  assert.equal(withFullStop(undefined, 'en'), '');
});
