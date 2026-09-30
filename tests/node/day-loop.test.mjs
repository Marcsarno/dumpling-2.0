// The household day over the vendored PlayCanvas core: the rebuild's daily.v1 and
// progress.v1 are read back unchanged by the PlayCanvas validators (DailyClock and
// ProgressStore), time follows the pause rules, and chore pay is $1 once per receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DayLoop, DAILY_KEY, PROGRESS_KEY} from '../../src/game/DayLoop.ts';
import {DailyClock} from '../../src/systems/DailyClock.ts';
import {ProgressStore} from '../../src/systems/ProgressStore.ts';

const memory = (seed = {}) => { const m = new Map(Object.entries(seed)); return {map: m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }}; };
const seeded = (s = 7) => () => (s = (s * 16807) % 2147483647) / 2147483647;

test('saves use the rebuild namespace, never arianna.*', () => {
 assert.equal(DAILY_KEY, 'dumpling.three.daily.v1'); assert.equal(PROGRESS_KEY, 'dumpling.three.progress.v1');
});

test('a fresh day is written and the PlayCanvas DailyClock accepts it unchanged', () => {
 const store = memory(), loop = new DayLoop(store, seeded());
 assert.equal(loop.problem, '');
 const saved = JSON.parse(store.getItem(DAILY_KEY));
 assert.deepEqual([saved.day, saved.phase, saved.minutes], [1, 'morning', 420]);
 assert.deepEqual(new DailyClock(seeded(99), saved).state, saved, 'PlayCanvas validator keeps every field');
 assert.ok(store.getItem('dumpling.three.daily-play.v1'), 'daily-play record kept current');
});

test('time runs at 0.5 game-minutes per second, only while running, in steps of at most 2 s', () => {
 const loop = new DayLoop(memory(), seeded());
 for (let i = 0; i < 60; i++) loop.update(1, true);
 assert.equal(loop.state.minutes, 450);
 for (let i = 0; i < 60; i++) loop.update(1, false);
 assert.equal(loop.state.minutes, 450, 'paused (shop, dialog, action)');
 loop.update(30, true);
 assert.equal(loop.state.minutes, 451, 'a 30 s stall counts as 2 s');
 for (let i = 0; i < 400; i++) loop.update(1, true);
 assert.equal(loop.state.minutes, 510, 'morning waits at 8:30 for school');
 assert.equal(loop.clock.schoolDue, true);
});

test('a chore pays $1 once by its receipt, and progress.v1 passes the PlayCanvas ProgressStore', () => {
 const store = memory(), loop = new DayLoop(store, seeded());
 assert.equal(loop.complete('teeth'), true);
 assert.equal(loop.complete('teeth'), false, 'already done');
 assert.equal(loop.balance, 1);
 assert.equal(loop.credit('day-1-morning-teeth', 1), false, 'the receipt never pays twice');
 const pc = new ProgressStore({read: () => store.getItem(PROGRESS_KEY), write() { throw Error('read only'); }});
 assert.equal(pc.problem, ''); assert.equal(pc.data.balance, 1);
 assert.deepEqual(pc.data.creditedRounds, ['day-1-morning-teeth']);
 const daily = new DailyClock(seeded(), JSON.parse(store.getItem(DAILY_KEY)));
 assert.deepEqual(daily.state.done, ['teeth']);
});

test('a reload resumes the same day, time and chores', () => {
 const store = memory(), a = new DayLoop(store, seeded());
 for (let i = 0; i < 40; i++) a.update(1, true);
 a.complete('outfit');
 const b = new DayLoop(store, seeded(3));
 assert.deepEqual(b.state, a.state); assert.equal(b.balance, 1);
});

test('an unreadable daily save is kept aside and reported, not silently lost', () => {
 const store = memory({[DAILY_KEY]: '{"version":1,"day":"nope"}'}), loop = new DayLoop(store, seeded());
 assert.match(loop.problem, /could not be read/);
 assert.equal(store.getItem(DAILY_KEY + '.unreadable'), '{"version":1,"day":"nope"}');
 assert.equal(loop.state.day, 1);
});

test('a reward that cannot be saved waits and is paid once saving works', () => {
 const store = memory(); let blocked = false;
 const flaky = {getItem: store.getItem, setItem: (k, v) => { if (blocked && k === PROGRESS_KEY) throw Error('quota'); store.setItem(k, v); }};
 const loop = new DayLoop(flaky, seeded());
 blocked = true; loop.complete('teeth');
 assert.equal(loop.balance, 0); assert.equal(loop.snapshot().pending, 1); assert.match(loop.message, /not saved yet/);
 blocked = false; loop.update(1, false);
 assert.equal(loop.balance, 1); assert.equal(loop.snapshot().pending, 0); assert.equal(loop.message, '');
});

test('sleeping at night starts the next day and announces it', () => {
 const store = memory(), loop = new DayLoop(store, seeded());
 Object.assign(loop.state, {phase: 'night', minutes: 1260, done: []});
 let started = 0; loop.onNewDay = d => { started = d; };
 assert.equal(loop.sleep(), true);
 assert.deepEqual([loop.state.day, loop.state.phase, loop.state.minutes, started], [2, 'morning', 420, 2]);
 assert.equal(JSON.parse(store.getItem('dumpling.three.daily-play.v1')).day, 2);
 assert.deepEqual(new DailyClock(seeded(), JSON.parse(store.getItem(DAILY_KEY))).state.day, 2);
});
