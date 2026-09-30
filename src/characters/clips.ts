import {AnimationClip, type KeyframeTrack} from 'three';
import type {LoadedCharacter} from './Arianna';
import {Poser} from './pose';
import {balancedRun} from './run';
import {ActionBaker} from './actions';
import {ACTIONS} from './actionSpecs';

/**
 * Arianna's motion library. Authored clips come from her untouched GLB; derived clips
 * are generated at load by posing her existing bones (never a new rig or new weights).
 */
export interface ClipLibrary { clips: AnimationClip[]; notes: Record<string, string> }

/** Blender exported a 1/15 s lead-in on most clips; start them at their first key so loops close. */
function fromFirstKey(source: AnimationClip, name: string) {
  const start = Math.min(...source.tracks.map(t => t.times[0]));
  const tracks = source.tracks.map(t => { const c = t.clone() as KeyframeTrack; if (start > 0) c.shift(-start); return c; });
  return new AnimationClip(name, source.duration - start, tracks);
}

export function buildClipLibrary(character: LoadedCharacter): ClipLibrary {
  const authored = (name: string) => {
    const clip = character.clips.find(c => c.name === name);
    if (!clip) throw Error(`Arianna is missing authored clip ${name}`);
    return clip;
  };
  const notes: Record<string, string> = {};
  const clips = [
    fromFirstKey(authored('Idle'), 'Idle'),
    fromFirstKey(authored('Walking'), 'Walk'),
    fromFirstKey(authored('Running'), 'RunAuthored'),
    fromFirstKey(authored('CarryWalk'), 'CarryWalk'),
    fromFirstKey(authored('CarryRun'), 'CarryRun'),
    fromFirstKey(authored('Casual_Walk'), 'CasualWalk'),
  ];
  notes.RunAuthored = 'Meshy running clip as supplied (reference for the rebalanced Run).';
  const poser = new Poser(character.model, character.bones);
  const run = balancedRun(poser, clips.find(c => c.name === 'RunAuthored')!);
  clips.splice(2, 0, run);
  notes.Run = `PlayCanvas balanced run body; both wrists share rest roll and a softened, lagging bend (max ${(run.userData.maxWristBendDegrees as number).toFixed(1)} deg).`;
  const baker = new ActionBaker(poser, character.root, clips.find(c => c.name === 'CarryWalk')!, clips.find(c => c.name === 'Idle')!);
  for (const spec of ACTIONS) clips.push(baker.bake(spec));
  poser.dispose();
  return {clips, notes};
}

/**
 * Lilah's motion library: her own eight authored clips, untouched (PlayCanvas Lilah.ts).
 * One-shots and their gameplay events are marked on the clip; PickUp and PutDown play at
 * 3x (2.4 s authored, 0.8 s in play) via the animator's action rate.
 */
export const LILAH_ACTION_RATE: Record<string, number> = {PickUp: 3, PutDown: 3};
export const LILAH_WALK_SPEED = .7;
export function buildLilahClips(character: LoadedCharacter): ClipLibrary {
  const required = ['Idle', 'Walk', 'CarryIdle', 'CarryWalk', 'PickUp', 'PutDown', 'Celebrate'];
  for (const name of required) if (!character.clips.some(c => c.name === name)) throw Error(`Lilah is missing authored clip ${name}`);
  const events: Record<string, {time: number; event: string}[]> = {PickUp: [{time: 1.1, event: 'take-toy'}], PutDown: [{time: 1.3, event: 'drop-toy'}]};
  const clips = character.clips.map(source => {
    const clip = fromFirstKey(source, source.name);
    clip.userData = {loop: !['PickUp', 'PutDown', 'Celebrate'].includes(clip.name), events: events[clip.name] ?? []};
    return clip;
  });
  return {clips, notes: {PickUp: 'Authored; plays at 3x (0.8 s), take-toy at 1.1 s clip time.', PutDown: 'Authored; plays at 3x (0.8 s), drop-toy at 1.3 s clip time.'}};
}

/**
 * Marc's motion library (PlayCanvas Marc.ts): his authored clips, Walk aliased to the
 * retargeted Walk_Basic, and CarryIdle as CarryWalk's first frame held still. SitDown and
 * StandUp play once. The owner-rejected Run_Alternative is not in the file and never added.
 */
export const MARC_WALK_SPEED = 1.2;
export const MARC_CARRY_SPEED = 1.05;
export function buildMarcClips(character: LoadedCharacter): ClipLibrary {
  for (const name of ['SitDown', 'SitIdle', 'StandUp', 'Idle', 'Walk_Basic', 'CarryWalk'])
    if (!character.clips.some(c => c.name === name)) throw Error(`Marc is missing authored clip ${name}`);
  if (character.clips.some(c => c.name === 'Run_Alternative')) throw Error('Marc must not ship the rejected Run_Alternative clip');
  const clips = character.clips.map(source => {
    const clip = fromFirstKey(source, source.name);
    clip.userData = {loop: !['SitDown', 'StandUp'].includes(clip.name), events: []};
    return clip;
  });
  const walk = fromFirstKey(character.clips.find(c => c.name === 'Walk_Basic')!, 'Walk'); walk.userData = {loop: true, events: []};
  const carry = character.clips.find(c => c.name === 'CarryWalk')!;
  const hold = new AnimationClip('CarryIdle', 1, carry.tracks.map(t => {
    const size = t.getValueSize(), c = t.clone() as KeyframeTrack;
    c.times = new Float32Array([0, 1]) as typeof c.times;
    c.values = new Float32Array([...t.values.slice(0, size), ...t.values.slice(0, size)]) as typeof c.values;
    return c;
  }));
  hold.userData = {loop: true, events: []};
  return {clips: [...clips, walk, hold], notes: {Walk: 'Walk_Basic (Quaternius Walk_Loop retargeted), as PlayCanvas.', CarryIdle: 'CarryWalk first frame, held.'}};
}
