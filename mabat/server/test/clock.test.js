import test from 'node:test';
import assert from 'node:assert/strict';
import { marketState, nyTime, isTradingDay } from '../clock.js';

const at = iso => Date.parse(iso);

test('regular session in New York, summer and winter time', () => {
  assert.equal(marketState(at('2026-10-29T13:29:00Z')).session, 'pre'); // 9:29 EDT
  assert.equal(marketState(at('2026-10-29T13:30:00Z')).session, 'open'); // 9:30 EDT
  assert.equal(marketState(at('2026-10-29T19:59:00Z')).session, 'open');
  assert.equal(marketState(at('2026-10-29T20:00:00Z')).session, 'post'); // 16:00 EDT
  assert.equal(marketState(at('2026-12-03T14:29:00Z')).session, 'pre'); // 9:29 EST
  assert.equal(marketState(at('2026-12-03T14:30:00Z')).session, 'open');
});

test('holidays, weekends and early closes', () => {
  assert.equal(isTradingDay('2026-11-26'), false); // Thanksgiving
  assert.equal(isTradingDay('2026-10-31'), false); // Saturday
  assert.equal(isTradingDay('2027-03-26'), false); // Good Friday 2027
  const black = marketState(at('2026-11-27T18:30:00Z')); // 13:30 EST on the early close
  assert.equal(black.session, 'post');
  assert.equal(black.earlyClose, true);
  assert.equal(marketState(at('2026-11-27T17:59:00Z')).session, 'open');
});

test('next open skips the weekend and the holiday', () => {
  const fri = marketState(at('2026-11-25T22:00:00Z')); // Wed evening before Thanksgiving
  assert.equal(new Date(fri.nextOpen).toISOString(), '2026-11-27T14:30:00.000Z');
  const sat = marketState(at('2026-10-31T15:00:00Z'));
  assert.equal(new Date(sat.nextOpen).toISOString(), '2026-11-02T14:30:00.000Z'); // DST ended Nov 1
  assert.equal(new Date(nyTime('2026-03-09', 570)).toISOString(), '2026-03-09T13:30:00.000Z'); // the day after DST starts
});

test('unknown holiday years are flagged', () => {
  assert.equal(marketState(at('2028-03-01T15:00:00Z')).holidaysKnown, false);
});
