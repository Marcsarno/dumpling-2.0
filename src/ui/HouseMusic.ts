import {saveKey} from '../systems/SaveNamespace';
import {audioLevel} from './audioLevels';
import {audioContext} from './audioContext';

export interface MusicScene {
  mode: 'home' | 'store' | 'recess';
  phase: string;
  store: string;
  /** Held silent (PlayCanvas: Squishy Pop, the Tornado, the developer panel). */
  paused: boolean;
  /** A squishy reveal is playing: the music ducks. */
  revealing: boolean;
}
const TRACKS = {
  home: {file: 'Squishy home clean.mp3', name: 'Home · morning & night'},
  chores: {file: 'Squishy Home clean v2.mp3', name: 'Home · after-school chores'},
  school: {file: 'Squishy school trading.mp3', name: 'School trading'},
  shop: {file: 'Squishy shopping.mp3', name: 'Shopping · 1'},
  shop2: {file: 'Squishy shopping v2.mp3', name: 'Shopping · 2'},
} as const;
type Track = keyof typeof TRACKS;
export const MUSIC_MUTED_KEY = saveKey('house-music.muted');
/** Music level before the player's volume (PlayCanvas: quiet, ducked to a third for reveals). */
const LEVEL = .252, DUCKED = .081;
const GAP_SECONDS = 5;

/**
 * One music voice across the game (PlayCanvas HouseMusic): Marc's home track in the morning
 * and at night, the after-school track in the afternoon, the two shopping songs alternating
 * with each new shop, and the school trading song. Tracks cross-fade (out at 0.45/s, in at
 * 0.14/s), fade over their last three seconds and rest five seconds before repeating. Music
 * waits for the first tap or key, pauses in a hidden tab, and remembers its mute.
 *
 * Upgrade: the level goes through a Web Audio gain node instead of `audio.volume`, so fades
 * and the volume slider work on iPhones and iPads too (iOS ignores `audio.volume`).
 */
export class HouseMusic {
  private readonly audio = new Audio();
  private gain?: GainNode;
  private level = 0;
  private unlocked = false;
  private wanted = false;
  private muted = false;
  private current: Track = 'home';
  private desired: Track = 'home';
  private lastStore = '';
  private secondStore = false;
  private gap = 0;
  private pending = false;
  private readonly abort = new AbortController();
  /** The "Music on / off" toggle, placed in the sound settings. */
  readonly button = document.createElement('button');

  constructor(private readonly base = import.meta.env.BASE_URL) {
    try { this.muted = localStorage.getItem(MUSIC_MUTED_KEY) === 'true'; } catch { /* storage blocked */ }
    this.audio.preload = 'none'; this.audio.src = this.url(this.current);
    const signal = this.abort.signal;
    this.audio.addEventListener('ended', () => { this.gap = GAP_SECONDS; this.setLevel(0); }, {signal});
    this.button.id = 'house-music'; this.button.type = 'button'; this.paint();
    this.button.addEventListener('click', () => {
      this.muted = !this.muted;
      try { localStorage.setItem(MUSIC_MUTED_KEY, String(this.muted)); } catch { /* storage blocked */ }
      this.paint(); this.sync();
    }, {signal});
    // The shared context is created at the start of this same tap (capture phase), so the
    // music is routed through its gain node before it ever plays, inside the gesture iOS needs.
    const unlock = () => { this.route(); this.unlocked = true; this.sync(); };
    document.addEventListener('pointerdown', unlock, {signal});
    document.addEventListener('keydown', unlock, {signal});
    document.addEventListener('visibilitychange', () => this.sync(), {signal});
  }

  private route() {
    const ctx = audioContext();
    if (this.gain || !ctx) return;
    this.gain = ctx.createGain(); this.gain.gain.value = this.level;
    ctx.createMediaElementSource(this.audio).connect(this.gain).connect(ctx.destination);
  }

  private url(track: Track) { return `${this.base}assets/audio/${encodeURIComponent(TRACKS[track].file)}`; }
  private setLevel(value: number) {
    this.level = Math.max(0, Math.min(1, value));
    const ctx = audioContext();
    if (this.gain && ctx) this.gain.gain.setTargetAtTime(this.level, ctx.currentTime, .015);
  }
  private paint() {
    this.button.textContent = this.muted ? '♫ Music off' : '♫ Music on';
    this.button.title = `${TRACKS[this.desired].name} · tap to ${this.muted ? 'play' : 'mute'}`;
    this.button.setAttribute('aria-label', this.muted ? 'Turn music on' : 'Mute music');
    this.button.setAttribute('aria-pressed', String(!this.muted));
  }

  private sync() {
    if (this.wanted && this.unlocked && this.gain && !this.muted && !document.hidden && !this.gap) {
      if (this.audio.paused && !this.pending) { this.pending = true; void this.audio.play().catch(() => {}).finally(() => { this.pending = false; }); }
    } else { this.audio.pause(); this.setLevel(0); }
  }
  private switchTrack() { this.current = this.desired; this.audio.pause(); this.audio.src = this.url(this.current); this.setLevel(0); this.gap = 0; this.sync(); }

  update(scene: MusicScene, dt = 0) {
    // Pausing for Pop or the developer panel must not count as a shop visit.
    if (scene.mode === 'store' && scene.store !== this.lastStore) { if (this.lastStore) this.secondStore = !this.secondStore; this.lastStore = scene.store; }
    const choice: Track = scene.mode === 'store' ? (this.secondStore ? 'shop2' : 'shop') : scene.mode === 'recess' ? 'school' : scene.phase === 'afternoon' ? 'chores' : 'home';
    if (this.desired !== choice) { this.desired = choice; this.paint(); }
    this.wanted = !scene.paused;
    if (!this.wanted || this.muted || document.hidden) { this.sync(); return; }
    const step = Math.min(.1, Math.max(0, dt));
    if (this.current !== this.desired) {
      this.setLevel(this.level - step * .45);
      if (this.level <= .001 || this.audio.paused) this.switchTrack();
      return;
    }
    if (this.gap) { this.gap = Math.max(0, this.gap - step); if (!this.gap) { this.audio.currentTime = 0; this.sync(); } return; }
    this.sync();
    if (!this.audio.paused) {
      const left = this.audio.duration - this.audio.currentTime, level = (scene.revealing ? DUCKED : LEVEL) * audioLevel('music');
      const target = Number.isFinite(left) ? Math.min(level, Math.max(0, left / 3) * level) : level;
      this.setLevel(this.level + Math.max(-step * .45, Math.min(step * .14, target - this.level)));
    }
  }

  snapshot() {
    return {playing: !this.audio.paused, muted: this.muted, track: TRACKS[this.current].name, requested: TRACKS[this.desired].name,
      source: decodeURIComponent(this.audio.src), position: this.audio.currentTime, level: this.level, routed: !!this.gain, gap: this.gap,
      duration: this.audio.duration, error: this.audio.error?.message ?? null};
  }
  destroy() { this.abort.abort(); this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.button.remove(); this.gain?.disconnect(); }
}
