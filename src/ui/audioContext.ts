/**
 * One Web Audio context for the whole game (music and effects), created and resumed on the
 * first tap or key press, because browsers keep audio locked until the player interacts.
 *
 * Upgrade: PlayCanvas faded music through `HTMLAudioElement.volume`, which iPhones and iPads
 * ignore (it is read-only there), so music played at full volume with no fades on iOS.
 * Everything here goes through gain nodes, which work on every browser.
 */
let context: AudioContext | undefined;
const waiting = new Set<(ctx: AudioContext) => void>();

export function audioContext() { return context; }

/** Runs `fn` once audio is unlocked (at once if it already is). */
export function whenAudioReady(fn: (ctx: AudioContext) => void) {
  if (context && context.state === 'running') fn(context); else waiting.add(fn);
}

async function unlock() {
  try {
    context ??= new AudioContext();
    await context.resume();
  } catch { return; }
  if (context.state !== 'running') return;
  for (const fn of [...waiting]) { waiting.delete(fn); fn(context); }
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => { void unlock(); }, true);
  document.addEventListener('keydown', () => { void unlock(); }, true);
  // iOS suspends the context when the page is backgrounded; resume on return.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && context?.state === 'suspended') void unlock(); });
}
export {unlock as unlockAudio};
