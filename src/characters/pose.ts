import {AnimationClip, AnimationMixer, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, type Bone, type KeyframeTrack, type Object3D} from 'three';

/**
 * Bone-space posing helpers shared by generated clips. All work happens on the character's
 * existing bones; rest transforms are captured first and restored afterwards, so the rig
 * is left exactly as loaded.
 */
export class Poser {
  private readonly mixer: AnimationMixer;
  private active?: ReturnType<AnimationMixer['clipAction']>;
  private readonly rest = new Map<Object3D, {p: Vector3; q: Quaternion; s: Vector3}>();
  readonly bind = new Map<string, Quaternion>();
  constructor(readonly model: Object3D, readonly bones: Map<string, Bone>) {
    this.mixer = new AnimationMixer(model);
    model.traverse(o => this.rest.set(o, {p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone()}));
    model.updateMatrixWorld(true);
    for (const [name, bone] of bones) this.bind.set(name, bone.getWorldQuaternion(new Quaternion()));
  }
  bone(name: string) { const b = this.bones.get(name); if (!b) throw Error(`Arianna has no bone ${name}`); return b; }
  restore() { for (const [o, r] of this.rest) { o.position.copy(r.p); o.quaternion.copy(r.q); o.scale.copy(r.s); } this.model.updateMatrixWorld(true); }
  restLocal(name: string) { return this.rest.get(this.bone(name))!.q.clone(); }
  restPosition(name: string) { return this.rest.get(this.bone(name))!.p.clone(); }

  /** Apply a clip at a time (weight 1), from rest. */
  sample(clip: AnimationClip, time: number) {
    this.restore();
    // Only one clip drives the bones at a time. Stopping an action makes three.js restore
    // each bone's original state, so the previous one is stopped *before* posing.
    const action = this.mixer.clipAction(clip);
    if (this.active && this.active !== action) this.active.stop();
    this.restore();
    action.reset().play(); action.time = time; this.active = action;
    this.mixer.update(0);
    this.model.updateMatrixWorld(true);
  }
  world(name: string) { return this.bone(name).getWorldQuaternion(new Quaternion()); }
  /** Model-space rotation relative to the bind pose (PlayCanvas: rotation · bind⁻¹). */
  delta(name: string) { return this.world(name).multiply(this.bind.get(name)!.clone().invert()); }
  setWorld(name: string, q: Quaternion) {
    const bone = this.bone(name), parent = bone.parent!;
    parent.updateWorldMatrix(true, false);
    bone.quaternion.copy(parent.getWorldQuaternion(new Quaternion()).invert().multiply(q));
    bone.updateMatrixWorld(true);
  }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); this.restore(); }
}

/** Mirror a model-space rotation across the character's sagittal (X = 0) plane. */
export const mirror = (q: Quaternion) => new Quaternion(q.x, -q.y, -q.z, q.w);

/**
 * Swing/twist about a bone's own axis (+Y points from a joint to its child on this rig).
 * `swing` bends the axis; `twist` rolls around it.
 */
export function swingTwist(q: Quaternion, axis = new Vector3(0, 1, 0)) {
  const bent = axis.clone().applyQuaternion(q);
  const swing = new Quaternion().setFromUnitVectors(axis, bent);
  const twist = swing.clone().invert().multiply(q);
  return {swing, twist};
}

/** Record the current local transforms of every bone the reference clip animates. */
export function recorder(reference: AnimationClip, bones: Map<string, Bone>) {
  const channels = reference.tracks.map(t => {
    const [node, property] = t.name.split('.');
    return {name: t.name, bone: bones.get(node)!, property: property as 'quaternion' | 'position' | 'scale'};
  }).filter(c => c.bone);
  const frames: number[][][] = [];
  return {
    capture() { frames.push(channels.map(c => c.bone[c.property].toArray() as number[])); },
    frames,
    channels,
    clip(name: string, times: number[]) {
      const tracks: KeyframeTrack[] = channels.map((c, i) => {
        const values = frames.flatMap(f => f[i]);
        return c.property === 'quaternion' ? new QuaternionKeyframeTrack(c.name, times, values) : new VectorKeyframeTrack(c.name, times, values);
      });
      return new AnimationClip(name, times.at(-1)!, tracks);
    },
  };
}
