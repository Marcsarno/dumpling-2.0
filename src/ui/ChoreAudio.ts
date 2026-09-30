import {saveKey} from '../systems/SaveNamespace';
import {audioLevel, onAudioChange} from './audioLevels';
import {audioContext, unlockAudio} from './audioContext';

const SOUNDS = ['vacuum', 'munch', 'wipe', 'water', 'handle'] as const;
type Sound = typeof SOUNDS[number];
const VOLUME: Record<Sound, number> = {vacuum: .23, water: .3, munch: .5, wipe: .4, handle: .4};
export const EFFECTS_MUTED_KEY = saveKey('house-effects.muted');

/**
 * Chore foley (PlayCanvas ChoreAudio): the recorded CC0 vacuum, wipe, water and munch loops
 * while work goes on, and a handling sound for pick-ups and put-downs. Buffers are decoded
 * once after the first tap or key press (browsers keep audio locked until then). Same sound
 * choice per chore, volumes, five-voice limit and saved mute as PlayCanvas.
 *
 * Upgrade: loops fade out over 80 ms instead of stopping dead, so there is no click.
 */
export class ChoreAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private current?: {source: AudioBufferSourceNode; gain: GainNode};
  private kind: Sound | '' = '';
  private muted = false;
  private generation = 0;
  private loading?: Promise<void>;
  private readonly buffers = new Map<Sound, AudioBuffer>();
  private readonly voices = new Set<AudioBufferSourceNode>();
  private readonly failures: string[] = [];
  private readonly abort = new AbortController();
  private readonly unsubscribe = onAudioChange(() => this.volume());
  /** The "Sounds on / off" toggle, placed in the menu by the session. */
  readonly button = document.createElement('button');

  constructor(private readonly base = import.meta.env.BASE_URL) {
    try { this.muted = localStorage.getItem(EFFECTS_MUTED_KEY) === 'true'; } catch { /* storage blocked */ }
    this.button.id = 'house-effects'; this.button.type = 'button'; this.paint();
    this.button.addEventListener('click', () => {
      this.muted = !this.muted;
      try { localStorage.setItem(EFFECTS_MUTED_KEY, String(this.muted)); } catch { /* storage blocked */ }
      this.paint(); this.volume();
    }, {signal: this.abort.signal});
    const unlock = () => { void this.unlock(); };
    document.addEventListener('pointerdown', unlock, {signal: this.abort.signal});
    document.addEventListener('keydown', unlock, {signal: this.abort.signal});
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.silence(); }, {signal: this.abort.signal});
  }

  private volume() { if (this.master) this.master.gain.value = this.muted ? 0 : audioLevel('effects'); }
  private paint() {
    this.button.textContent = this.muted ? '◖ Sounds off' : '◖ Sounds on';
    this.button.setAttribute('aria-label', this.muted ? 'Turn house sounds on' : 'Mute house sounds');
    this.button.setAttribute('aria-pressed', String(!this.muted));
  }

  private async unlock() {
    await unlockAudio();
    const ctx = audioContext();
    if (!ctx) return;
    this.context = ctx;
    if (!this.master) { this.master = ctx.createGain(); this.master.connect(ctx.destination); this.volume(); }
    this.loading ??= Promise.all(SOUNDS.map(async name => {
      try {
        const response = await fetch(`${this.base}assets/audio/foley/${name}.mp3`);
        if (!response.ok) throw Error(name);
        this.buffers.set(name, await this.context!.decodeAudioData(await response.arrayBuffer()));
      } catch { this.failures.push(name); }
    })).then(() => {});
    await this.loading;
  }

  private play(name: Sound, loop: boolean) {
    const ctx = this.context, buffer = this.buffers.get(name);
    if (!ctx || !buffer || !this.master || document.hidden || this.voices.size >= 5) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; source.loop = loop; gain.gain.value = VOLUME[name];
    source.connect(gain).connect(this.master); this.voices.add(source);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(source); };
    source.start();
    return {source, gain};
  }

  /** The sound for a chore (PlayCanvas chose by interaction id). */
  static soundFor(id: string): Sound | '' {
    return /vacuum|dirt|mess-2/.test(id) ? 'vacuum' : /eat/.test(id) ? 'munch' : /wipe|mess-1/.test(id) ? 'wipe'
      : /wash|teeth/.test(id) ? 'water' : /sleep|lilah-bed/.test(id) ? '' : 'handle';
  }

  start(id: string) {
    this.stop();
    const kind = ChoreAudio.soundFor(id), token = this.generation;
    if (!kind) return;
    this.kind = kind;
    void this.unlock().then(() => {
      if (token !== this.generation || document.hidden) return;
      this.current = this.play(kind, kind !== 'handle');
    });
  }

  stop() {
    this.generation++; this.kind = '';
    const voice = this.current; this.current = undefined;
    if (!voice || !this.context) return;
    const t = this.context.currentTime;
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t); voice.gain.gain.linearRampToValueAtTime(0, t + .08);
    try { voice.source.stop(t + .09); } catch { /* already stopped */ }
  }

  silence() { this.stop(); for (const voice of this.voices) { try { voice.stop(); } catch { /* already stopped */ } } }
  get busy() { return !!this.kind; }
  snapshot() { return {kind: this.kind, playing: !!this.current, muted: this.muted, state: this.context?.state, decoded: this.buffers.size, failures: this.failures}; }
  destroy() { this.silence(); this.unsubscribe(); this.abort.abort(); this.button.remove(); this.master?.disconnect(); }
}
