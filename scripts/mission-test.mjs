import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MissionSystem, TASKS } from '../src/systems/MissionSystem.ts';
import { HOUSE_TASKS } from '../src/data/house.ts';

test('developer pause preserves remaining time and resumes the original deadline', () => {
  const mission=new MissionSystem();mission.start(1000);mission.tick(6000);
  assert.equal(mission.remaining,55000);mission.pauseFor(120000);mission.tick(126000);
  assert.equal(mission.remaining,55000);mission.tick(181000);assert.equal(mission.state,'finished');
  mission.pauseFor(1000);assert.equal(mission.remaining,0);
});

test('ready time is free; duplicate starts never extend an active round', () => {
  const mission = new MissionSystem();
  mission.tick(100_000); assert.equal(mission.remaining, 60_000);
  mission.start(100_000); mission.start(110_000); mission.tick(159_999);
  assert.equal(mission.remaining, 1); assert.equal(mission.state, 'running');
  mission.tick(160_000); assert.equal(mission.state, 'finished'); assert.equal(mission.allowance, 0);
});
test('duplicate placements cannot create money or a second completion', () => {
  const mission = new MissionSystem(); mission.start(0);
  assert.equal(mission.complete('teddy', 100), true);
  assert.equal(mission.complete('teddy', 110), false);
  assert.equal(mission.allowance, 1); assert.equal(mission.completed.size, 1);
});
test('an action at or after the deadline is rejected even without an update frame', () => {
  const mission = new MissionSystem(); mission.start(0); mission.complete('shirt', 1000);
  assert.equal(mission.complete('dirt', 60_000), false);
  assert.equal(mission.complete('crayons', 60_001), false);
  assert.equal(mission.state, 'finished'); assert.equal(mission.reason, 'time');
  assert.equal(mission.allowance, 1); assert.equal(mission.bonus, 0);
});
test('five unique tasks end early, award exactly one bonus and stay finished', () => {
  const mission = new MissionSystem(); mission.start(0);
  for (const [i, task] of TASKS.entries()) assert.equal(mission.complete(task.id, 1000 + i), true);
  assert.equal(mission.state, 'finished'); assert.equal(mission.reason, 'complete');
  assert.equal(mission.allowance, 7); assert.equal(mission.bonus, 2);
  mission.tick(80_000); mission.complete('book', 80_001); mission.start(90_000);
  assert.equal(mission.allowance, 7); assert.equal(mission.reason, 'complete');
});
test('replay clears a finished round and starts a fresh deadline', () => {
  const mission = new MissionSystem(); mission.start(0); mission.complete('book', 500); mission.tick(61_000);
  mission.reset(); assert.equal(mission.state, 'ready'); assert.equal(mission.remaining, 60_000);
  assert.equal(mission.allowance, 0); assert.equal(mission.completed.size, 0); assert.equal(mission.reason, null);
  mission.start(70_000); mission.tick(71_000); assert.equal(mission.remaining, 59_000);
});
test('House mission rewards only its six tasks, once each, for $8 total', () => {
  const mission = new MissionSystem(); mission.configure(HOUSE_TASKS); mission.start(0);
  assert.equal(mission.complete('teddy', 100), false); assert.equal(mission.allowance, 0);
  for (const task of HOUSE_TASKS) assert.equal(mission.complete(task.id, 500), true);
  assert.equal(mission.allowance, 8); assert.equal(mission.completed.size, 6); assert.equal(mission.reason, 'complete');
});
test('Untimed practice supports interactions without expiry or wallet rewards', () => {
  const mission = new MissionSystem(); mission.configure(HOUSE_TASKS, false); mission.start(0); mission.tick(120_000);
  assert.equal(mission.state, 'running'); assert.equal(mission.remaining, 60_000);
  for (const task of HOUSE_TASKS) assert.equal(mission.complete(task.id, 130_000), true);
  assert.equal(mission.allowance, 0); assert.equal(mission.bonus, 0); assert.equal(mission.reason, 'complete');
});
