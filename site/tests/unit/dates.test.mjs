// node --test tests/unit — CMS dates are the day in Japan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from '../../functions/_lib/shell.js';

test('a post published early morning JST shows that day, not the UTC day', () => {
  assert.equal(formatDate('2026-10-18T22:30:00.000Z'), '2026.10.19');
  assert.equal(formatDate('2026-10-19T14:59:59.000Z'), '2026.10.19');
});

test('date-only values and missing values', () => {
  assert.equal(formatDate('2026-10-18'), '2026.10.18');
  assert.equal(formatDate(''), '');
  assert.equal(formatDate(null), '');
});
