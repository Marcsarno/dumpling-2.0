// Family-life rules (slice 6): Dad's dinner schedule and menu, the bowl rule, Lilah's tuck-in
// window and her continuous path into the crib. Values match PlayCanvas FamilyDinner,
// DailyLife and BedEntry; the evening dinner fallback is a deliberate upgrade.
import test from 'node:test';
import assert from 'node:assert/strict';
import {dinnerFood, dinnerStart, dinnerDue, DINNER_LATEST, bowlHasFood, tuckInTime, cribKeys, samplePath, LILAH_BED_RECEIPT, LILAH_BEDTIME} from '../../src/game/familyRules.ts';
import {DailyClock} from '../../src/systems/DailyClock.ts';

test('menu rotates pizza, taco, turkey by day', () => {
 assert.deepEqual([1, 2, 3, 4, 5, 6].map(dinnerFood), ['pizza', 'taco', 'turkey', 'pizza', 'taco', 'turkey']);
});

test('dinner starts at 3:30 PM plus the PlayCanvas per-day offset', () => {
 assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(dinnerStart), [967, 1004, 951, 988, 935, 972, 1009]);
 for (let d = 1; d < 200; d++) assert.ok(dinnerStart(d) >= 930 && dinnerStart(d) < 1020);
});

test('dinner is due once a day: afternoon from its start minute, or early evening if missed', () => {
 const day = (o) => ({day: 1, phase: 'afternoon', minutes: 900, dinnerServed: false, ...o});
 assert.equal(dinnerDue(day({minutes: 966})), false);
 assert.equal(dinnerDue(day({minutes: 967})), true);
 assert.equal(dinnerDue(day({minutes: 1139, dinnerServed: true})), false, 'served once');
 assert.equal(dinnerDue(day({phase: 'night', minutes: 1140})), true, 'upgrade: a missed dinner is still served in the evening');
 assert.equal(dinnerDue(day({phase: 'night', minutes: DINNER_LATEST})), false);
 assert.equal(dinnerDue(day({phase: 'morning', minutes: 500})), false);
 assert.equal(dinnerDue(day({phase: 'school', minutes: 510})), false);
});

test('the bowl rule matches PlayCanvas and a fresh day starts with food', () => {
 const fresh = new DailyClock(() => .3).state;
 assert.equal(bowlHasFood(fresh), true);
 assert.equal(bowlHasFood({...fresh, dogFoodEmpty: true}), false);
 assert.equal(bowlHasFood({...fresh, phase: 'afternoon', petTask: 'feed-dog', done: []}), false, 'empty on feed-dog afternoons until filled');
 assert.equal(bowlHasFood({...fresh, phase: 'afternoon', petTask: 'feed-dog', done: ['feed-dog']}), true);
 assert.equal(bowlHasFood({...fresh, phase: 'afternoon', petTask: 'pet-care', done: []}), true);
});

test('tuck-in from 6:15 PM, afternoon or night, once; its receipt has no phase', () => {
 assert.equal(LILAH_BEDTIME, 1095);
 assert.equal(tuckInTime({phase: 'afternoon', minutes: 1094}), false);
 assert.equal(tuckInTime({phase: 'afternoon', minutes: 1095}), true);
 assert.equal(tuckInTime({phase: 'night', minutes: 1140}), true);
 assert.equal(tuckInTime({phase: 'night', minutes: 1140, lilahAsleep: true}), false);
 assert.equal(tuckInTime({phase: 'morning', minutes: 1100}), false);
 assert.equal(LILAH_BED_RECEIPT(3), 'day-3-lilah-bed');
});

test('the crib path is continuous and ends lying in the crib', () => {
 const keys = cribKeys({x: 7.8, z: -.6, yaw: 0});
 let last = samplePath(keys, 0);
 assert.deepEqual([last.x, last.z], [7.8, -.6]);
 for (let i = 1; i <= 320; i++) {
  const p = samplePath(keys, i / 320);
  assert.ok(Math.hypot(p.x - last.x, p.z - last.z) < .04, `step ${i} jumps`);
  assert.ok(Math.abs(p.h - last.h) < .04, `height step ${i} jumps`);
  last = p;
 }
 assert.deepEqual([last.x, last.z, last.h], [9.8, -1.7, .65]);
 assert.ok(Math.abs(last.yaw - Math.PI / 2) < 1e-9);
 assert.deepEqual(samplePath(keys, 2), samplePath(keys, 1), 'clamps past the end');
});
