// The household route planner on the real converted house: every route Lilah can take
// between her start, Arianna's start and her explore spots stays on free floor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';
import {HousePath} from '../../src/game/HousePath.ts';

const house = JSON.parse(readFileSync(resolve(ROOT, 'public/world/house.json'), 'utf8')).semantics;
const area = {walkable: house.walkable, obstacles: house.colliders};
const spots = [[1, .7], [0, .9], [1.1, 1.3], [3.8, 2], [1.4, 5.6], [.5, 10.8], [4.3, 11.4], [8.4, .5]].map(([x, z]) => ({x, z}));

test('free() respects walkable floors and inflated blockers', () => {
 const path = new HousePath(area);
 for (const s of spots) assert.ok(path.free(s.x, s.z), `spot ${s.x},${s.z} is free`);
 assert.equal(path.free(100, 100), false, 'outside the house');
 const box = house.colliders.find(c => c.active !== false);
 assert.equal(path.free(box.center[0], box.center[2]), false, 'inside a blocker');
});

test('routes between every pair of spots exist and every segment is clear', () => {
 const path = new HousePath(area);
 for (const a of spots) for (const b of spots) {
  if (a === b) continue;
  const route = path.route(a, b);
  assert.ok(route.length, `route ${a.x},${a.z} -> ${b.x},${b.z}`);
  let from = a;
  for (const p of route) { assert.ok(path.line(from, p), `clear segment to ${p.x},${p.z}`); from = p; }
  assert.deepEqual(route.at(-1), b, 'ends exactly at the goal');
 }
});

test('an extra blocker (Arianna) is routed around', () => {
 const plain = new HousePath(area);
 const [a, b] = spots.flatMap(a => spots.map(b => [a, b])).find(([a, b]) => Math.hypot(a.x - b.x, a.z - b.z) > 1.5 && plain.line(a, b));
 const mid = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2}, blocked = plain.withObstacles([{...mid, half: .27}], .18);
 assert.ok(plain.line(a, b), 'direct line without her');
 assert.equal(blocked.line(a, b), false, 'she blocks the direct line');
 const route = blocked.route(a, b);
 assert.ok(route.length > 1, 'detours around her');
});
