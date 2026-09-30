import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore } from '../src/systems/ProgressStore.ts';
import { DUMPLINGS, rollDumpling } from '../src/data/collection.ts';
function fixture() {
  let raw = null, fail = false, serial = 0;
  const repository = { read: () => raw, write: value => { if (fail) throw Error('blocked'); raw = value; } };
  return { store: new ProgressStore(repository, () => 0, () => String(++serial)), reload: () => new ProgressStore(repository, () => 0, () => String(++serial)), fail: () => { fail = true; } };
}
test('Rarity intervals match 65/25/8/2 and every configured dumpling is reachable', () => {
  const totals = {}, ids = new Set();
  for (let i = 0; i < 10000; i++) {
    let draw = 0; const d = rollDumpling(() => draw++ === 0 ? (i + .5) / 10000 : (i % 31) / 31);
    totals[d.rarity] = (totals[d.rarity] || 0) + 1; ids.add(d.id);
  }
  assert.deepEqual(totals, { Common: 6500, Rare: 2500, Epic: 800, Legendary: 200 });
  assert.equal(ids.size, DUMPLINGS.length);
});
test('Allowance credits once; purchases deduct $4 and enforce a persistent three-box trip cap', () => {
  const f = fixture(), s = f.store;
  s.creditRound('a', 7); s.creditRound('a', 7); assert.equal(s.data.balance, 7);
  s.creditRound('b', 7); s.startTrip(); s.purchase(); s.purchase(); s.purchase();
  assert.equal(s.data.balance, 2); assert.equal(s.data.boxes.length, 3);
  s.creditRound('c', 7); const again = f.reload(); again.startTrip();
  assert.throws(() => again.purchase(), /bag is full/); assert.equal(again.data.balance, 9);
  again.goHome(); again.startTrip(); again.purchase(); assert.equal(again.data.balance, 5);
});
test('Unopened receipts survive refresh, reveal is idempotent, and duplicates increment', () => {
  const f = fixture(), s = f.store; s.creditRound('a', 7); s.creditRound('b', 7); s.startTrip(); s.purchase(); s.purchase(); s.goHome();
  const again = f.reload(), first = again.openNext();
  assert.equal(first.dumplingId, 'mochi'); assert.equal(first.isNew, true);
  const interrupted = f.reload(); assert.deepEqual(interrupted.openNext(), first); assert.equal(interrupted.data.boxes.length, 1);
  interrupted.showCollection(); interrupted.goHome(); const duplicate = interrupted.openNext();
  assert.equal(duplicate.count, 2); assert.equal(duplicate.isNew, false);
  const final = f.reload(); assert.equal(final.data.balance, 6); assert.equal(final.data.collection.mochi, 2);
  final.startCleanup(); assert.equal(final.data.collection.mochi, 2);
});
test('Insufficient funds and failed saves never partially deduct money or award contents', () => {
  const f = fixture(), s = f.store; s.startTrip(); assert.throws(() => s.purchase(), /costs/);
  s.creditRound('a', 7); f.fail(); assert.throws(() => s.purchase(), /Unable to save/);
  assert.equal(s.data.balance, 7); assert.equal(s.data.boxes.length, 0); assert.equal(f.reload().data.balance, 7);
});
test('Unreadable saves remain intact and cannot silently be replaced', () => {
  let writes = 0; const s = new ProgressStore({ read: () => '{bad', write: () => writes++ });
  assert.ok(s.problem); assert.throws(() => s.creditRound('a', 7)); assert.equal(writes, 0);
});
