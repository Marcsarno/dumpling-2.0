import {saveKey} from '../systems/SaveNamespace';

/**
 * Saved volume levels (PlayCanvas AudioSettings, same keys and defaults: music 0.5,
 * effects 1). The settings dialog arrives with the music in slice 5; the chore sounds
 * already follow whatever level is saved.
 */
export type AudioChannel = 'music' | 'effects';
const listeners = new Set<() => void>();
const values: Partial<Record<AudioChannel, number>> = {};

export function audioLevel(channel: AudioChannel) {
  if (values[channel] === undefined) {
    let value = channel === 'music' ? .5 : 1;
    try { const saved = localStorage.getItem(saveKey('audio.' + channel)); if (saved !== null && Number.isFinite(Number(saved))) value = Math.max(0, Math.min(1, Number(saved))); } catch { /* storage blocked */ }
    values[channel] = value;
  }
  return values[channel]!;
}
export function setAudioLevel(channel: AudioChannel, value: number) {
  values[channel] = Math.max(0, Math.min(1, value));
  try { localStorage.setItem(saveKey('audio.' + channel), String(values[channel])); } catch { /* storage blocked */ }
  listeners.forEach(fn => fn());
}
export function onAudioChange(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
