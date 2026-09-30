import type { Interaction } from '../game/cleanupProps';

/** Return tools after their available uses; players can still put them away early. */
export function guidanceCandidates(available: Interaction[], carried: string | null): Interaction[] {
  if(!carried)return available.filter(target=>target.id==='wash-hands');
  const next=available.filter(target=>target.id!=='put-tool-away'&&
    ['place','vacuum','pet','daily'].includes(target.kind));
  return next.length?next:available.filter(target=>target.id==='put-tool-away');
}
