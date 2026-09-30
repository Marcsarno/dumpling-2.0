// The mission picker's rounds with real key presses (disposable headless Edge, 390x844 @3x):
// House (six of eleven chores, $6 + $2 all-clean bonus), Puppy (scoop · flush · wash, $1 + $2)
// and Explore (every chore, no timer, no allowance). Rounds pay once by receipt, the picker
// locks while a timed round runs, and "Back to everyday life" returns to the day.
// Adapted from PlayCanvas scripts/house-browser-test.mjs and pet-browser-test.mjs.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {openGame, out} from './lib/chore-driver.mjs';

const {page, errors, close, driver: {snap, chore, doIt, standBy, pick, openMenu}} = await openGame(5228);
try {
  await page.waitForFunction(() => window.__player.session().chores.pet.loaded, undefined, {timeout: 30000});
  const wallet = async () => (await snap()).day.balance;
  const results = () => page.waitForSelector('#results[open]', {timeout: 8000});
  const start = await wallet();

  // House: six chores drawn from eleven, scattered to reachable spots.
  await pick('house');
  let c = (await snap()).cleanup;
  assert.equal(c.tasks.length, 6); assert.equal(c.timed, true); assert.equal(c.state, 'ready');
  const pool = ['book', 'living-toy', 'kitchen-dish', 'kitchen-trash', 'laundry-clothes', 'bath-towel', 'hall-shoes', 'hall-mail', 'living-cushion', 'laundry-clean', 'bath-bottle'];
  assert.ok(c.tasks.every(t => pool.includes(t)), c.tasks.join());
  for (const t of pool) assert.equal(c.items.find(i => i.id === t).visible, c.tasks.includes(t), `${t} shown only when drawn`);
  const houseTasks = c.tasks;
  for (const task of houseTasks) {
    await chore(task);
    c = (await snap()).cleanup;
    if (c.state === 'running') {
      // The picker is locked while the timer runs.
      await openMenu(); await page.evaluate(() => { document.querySelector('.adventure-activities').open = true; });
      assert.equal(await page.locator('#mission-day').isDisabled(), true);
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    }
  }
  await results();
  c = (await snap()).cleanup;
  assert.deepEqual([c.state, c.allowance, c.bonus], ['finished', 8, 2]);
  assert.equal(await page.locator('#results-title').textContent(), 'House ready!');
  assert.equal(await wallet(), start + 8);
  await page.screenshot({path: resolve(out, 'missions-10-house.png')});
  // Play again draws a different six.
  await page.click('#replay');
  c = (await snap()).cleanup;
  assert.notDeepEqual([...c.tasks].sort(), [...houseTasks].sort(), 'a fresh set of chores');
  assert.equal(await wallet(), start + 8, 'the finished round paid once');

  // Puppy: one chore in four steps, $3 when done.
  await pick('pet');
  c = (await snap()).cleanup;
  assert.deepEqual(c.tasks, ['pet-care']); assert.equal(c.pet.stage, 'tool'); assert.equal(c.pet.poopVisible, true);
  assert.match(await page.locator('#adventure-journal [data-hint]').textContent(), /scooper/);
  await doIt('pickup-scooper'); assert.equal((await snap()).cleanup.pet.stage, 'scoop');
  await doIt('scoop-poop'); c = (await snap()).cleanup; assert.deepEqual([c.pet.stage, c.pet.poopParent], ['flush', 'Pooper scooper']);
  await standBy('flush-poop'); await page.waitForFunction(() => document.querySelector('#action-button')?.dataset.target === 'flush-poop');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__player.snapshot().cleanup.pet.flushing, undefined, {timeout: 5000});
  await page.screenshot({path: resolve(out, 'missions-11-flush.png')});
  await page.waitForFunction(() => window.__player.snapshot().cleanup.pet.stage === 'wash' && !window.__player.session().animator.busy, undefined, {timeout: 5000});
  assert.match(await page.locator('#adventure-journal [data-hint]').textContent(), /wash your hands/);
  await doIt('wash-hands');
  await results();
  c = (await snap()).cleanup;
  assert.deepEqual([c.allowance, c.bonus, c.pet.stage], [3, 2, 'done']);
  assert.equal(await wallet(), start + 11);

  // Explore: every chore, no timer and no allowance. Once the poop is flushed, washing up comes first.
  await page.click('#replay'); await pick('practice');
  c = (await snap()).cleanup;
  assert.equal(c.tasks.length, 16); assert.equal(c.timed, false);
  assert.equal(await page.locator('.adventure-timer').isHidden(), true, 'no round timer');
  assert.match(await page.locator('#adventure-journal [data-hint]').textContent(), /Explore freely/);
  await doIt('pickup-scooper'); await doIt('scoop-poop'); await doIt('flush-poop');
  await standBy('pickup-teddy'); await page.waitForTimeout(150);
  assert.notEqual((await snap()).cleanup.focus, 'pickup-teddy', 'hands first');
  await doIt('wash-hands');
  for (const task of c.tasks.filter(t => t !== 'pet-care')) await chore(task);
  await results();
  c = (await snap()).cleanup;
  assert.deepEqual([c.state, c.reason ?? 'complete', c.allowance, c.completed.length], ['finished', 'complete', 0, 16]);
  assert.equal(await wallet(), start + 11, 'Explore pays nothing');
  const receipts = await page.evaluate(() => JSON.parse(localStorage.getItem('dumpling.three.progress.v1')).creditedRounds);
  assert.equal(receipts.length, 2, 'one receipt per paid round, none for Explore');

  // Back to everyday life.
  await page.click('#results-day');
  c = (await snap()).cleanup;
  assert.equal(c.mode, 'day'); assert.equal(c.items.find(i => i.id === 'teddy').visible, false, 'round props put away');
  assert.deepEqual(errors, []);
  console.log('PASS missions:', JSON.stringify({house: houseTasks, paid: (await wallet()) - start}));
} finally { await close(); }
