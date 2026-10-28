import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingSeconds, waitEstimate, addressFromQuery } from '../src/lib/activity.ts';

test('remaining estimate never becomes negative and reaches overrun state', () => {
  assert.equal(remainingSeconds(4, 10), 6);
  assert.equal(remainingSeconds(80, 75), 0);
});
test('a delayed connection gets a possible-startup estimate, not a confirmed cold-start claim', () => {
  assert.equal(waitEstimate('search', 5, 'connecting'), 75);
  assert.equal(waitEstimate('search', 5, 'working'), 4);
  assert.equal(waitEstimate('analysis', 5, 'connecting'), 105);
});
test('past duration estimates stay bounded', () => {
  assert.equal(waitEstimate('analysis', 0, 'working', 500), 180);
  assert.ok(waitEstimate('search', 0, 'working', 0.1) >= 3);
});
test('only address-like searches offer explicit analysis', () => {
  assert.equal(addressFromQuery('www.suno.com'), 'https://www.suno.com/');
  assert.equal(addressFromQuery('suno.com'), 'https://suno.com/');
  assert.equal(addressFromQuery('learn CSS fast'), '');
  assert.equal(addressFromQuery('javascript:alert(1)'), '');
});

test('initial connection estimates do not reuse slow analysis durations', () => {
  assert.equal(waitEstimate('analysis', 0, 'connecting', 180), 5);
});
