/**
 * TEMPORARY type shim. The vendored InteractionSystem and InteractionGuidance import
 * these types from '../game/cleanupProps'. Field-for-field copy of the PlayCanvas
 * declarations (src/game/cleanupProps.ts at the reference commit); replaced by the
 * real port of the cleanup props in phase P2.
 */
import type { Entity, Vec3 } from 'playcanvas';
import type { TaskId } from '../systems/MissionSystem';

export type Triple = [number, number, number];
export type ItemId = string;
export interface Interaction {
  id: string;
  name: string;
  icon: string;
  kind: 'pickup' | 'place' | 'crayons' | 'vacuum' | 'pet' | 'daily';
  duration?: number;
  hold?: boolean;
  mess?: Entity;
  actionLabel?: string;
  available?: (carried: ItemId | null) => boolean;
  anchor: Vec3;
  marker: Vec3;
  range: number;
  item?: ItemId;
  task?: TaskId;
  placement?: Triple;
  placedStyle?: 'hide' | 'hang';
}
