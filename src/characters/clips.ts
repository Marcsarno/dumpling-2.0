import {AnimationClip, type KeyframeTrack} from 'three';
import type {LoadedCharacter} from './Arianna';
import {Poser} from './pose';
import {balancedRun} from './run';

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
  poser.dispose();
  return {clips, notes};
}
