import type { Vec3 } from 'playcanvas';
import type { Interaction, ItemId } from '../game/cleanupProps';
import type { MissionSystem } from './MissionSystem';

export class InteractionSystem {
  focus: Interaction | null = null;
  constructor(readonly interactions: Interaction[], private readonly guard: (target: Interaction) => boolean = () => true) {}
  available(target: Interaction, carried: ItemId | null, mission: MissionSystem) {
    if (mission.state === 'finished') return false;
    if (!this.guard(target)) return false;
    if(target.kind==='daily')return target.available?.(carried)??false;
    const task = target.task ?? (target.item === 'vacuum' ? 'dirt' : target.item);
    if (task && !mission.tasks.some(entry => entry.id === task)) return false;
    if (target.task && mission.completed.has(target.task)) return false;
    if (target.available) return target.available(carried);
    if (target.kind === 'place' || target.kind === 'vacuum') return carried === target.item;
    if (carried) return false;
    if (target.kind === 'pickup') return !mission.completed.has(target.item === 'vacuum' ? 'dirt' : target.item!);
    return true;
  }
  distance(target: Interaction, position: Vec3) {
    return Math.hypot(target.anchor.x - position.x, target.anchor.z - position.z);
  }
  update(position: Vec3, carried: ItemId | null, mission: MissionSystem) {
    let nearest: Interaction | null = null;
    let nearestDistance = Infinity;
    for (const target of this.interactions) {
      if (!this.available(target, carried, mission)) continue;
      const distance = this.distance(target, position);
      // Small exit hysteresis prevents the button flickering at the range boundary.
      const range = target.range + (target === this.focus ? 0.1 : 0);
      // A usable mess wins over nearby tool storage when their interaction ranges overlap.
      const score=distance+(target.id==='put-tool-away'?100:0);
      if (distance <= range && score < nearestDistance) { nearest = target; nearestDistance = score; }
    }
    this.focus = nearest;
  }
}
