import type {Aabb} from '../world/format';

/** Full-stick speeds shared by movement and gait playback (PlayCanvas MovementPace.ts). */
export const RUN_SPEED = 3.15;
export const WALK_SPEED = 1.65;

export interface Walkable { minX: number; maxX: number; minZ: number; maxZ: number }
export interface MovementArea { walkable?: Walkable[]; obstacles: Aabb[]; halfWidth: number; halfDepth: number }

/**
 * Player movement on the floor plane with PlayCanvas-identical collision: radius 0.24,
 * axis-separated sub-steps of at most 8 cm, the player's four corners tested against the
 * union of walkable floors, and blockers inflated by the radius in X and Z (their Y span
 * still has to contain the player's height, as PlayCanvas BoundingBox.containsPoint does).
 *
 * Upgrade: velocity eases toward the stick (about 55 ms), so starts and stops read as
 * steps rather than teleports while controls stay immediate.
 */
export class PlayerMovement {
  readonly radius = .24;
  readonly position = {x: 0, y: .09, z: .9};
  readonly velocity = {x: 0, z: 0};
  speed = RUN_SPEED;
  response = 18;
  enabled = true;
  private blockers: {minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number}[] = [];
  private area!: MovementArea;
  /** Camera-relative input axes flattened to the floor (set once from the fixed camera). */
  constructor(private right: {x: number; z: number}, private forward: {x: number; z: number}, area: MovementArea) { this.setArea(area); }

  setArea(area: MovementArea) {
    this.area = area;
    this.blockers = area.obstacles.filter(b => b.active !== false).map(({center: c, half: h}) => ({
      minX: c[0] - h[0] - this.radius, maxX: c[0] + h[0] + this.radius, minY: c[1] - h[1], maxY: c[1] + h[1],
      minZ: c[2] - h[2] - this.radius, maxZ: c[2] + h[2] + this.radius}));
  }

  place(x: number, z: number) { this.position.x = x; this.position.z = z; this.velocity.x = this.velocity.z = 0; }

  /** input: stick/keyboard vector, |input| ≤ 1, x right and y up the screen. */
  update(dt: number, input: {x: number; y: number}) {
    const ix = this.enabled ? this.right.x * input.x + this.forward.x * input.y : 0;
    const iz = this.enabled ? this.right.z * input.x + this.forward.z * input.y : 0;
    const k = 1 - Math.exp(-this.response * dt);
    this.velocity.x += (ix * this.speed - this.velocity.x) * k;
    this.velocity.z += (iz * this.speed - this.velocity.z) * k;
    if (Math.hypot(this.velocity.x, this.velocity.z) < .01 && !ix && !iz) { this.velocity.x = this.velocity.z = 0; return; }
    const dx = this.velocity.x * dt, dz = this.velocity.z * dt, p = this.position;
    const startX = p.x, startZ = p.z, {halfWidth, halfDepth} = this.area, r = this.radius;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / .08));
    for (let i = 0; i < steps; i++) {
      const x = p.x; p.x = Math.max(-halfWidth + r, Math.min(halfWidth - r, x + dx / steps)); if (this.blocked(p.x, p.z)) p.x = x;
      const z = p.z; p.z = Math.max(-halfDepth + r, Math.min(halfDepth - r, z + dz / steps)); if (this.blocked(p.x, p.z)) p.z = z;
    }
    // Report the achieved velocity, so animation matches wall slides and stops.
    this.velocity.x = (p.x - startX) / Math.max(dt, .001);
    this.velocity.z = (p.z - startZ) / Math.max(dt, .001);
  }

  blocked(x: number, z: number) {
    const walkable = this.area.walkable, r = this.radius, y = this.position.y;
    if (walkable) for (const cx of [x - r, x + r]) for (const cz of [z - r, z + r])
      if (!walkable.some(f => cx >= f.minX && cx <= f.maxX && cz >= f.minZ && cz <= f.maxZ)) return true;
    return this.blockers.some(b => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y >= b.minY && y <= b.maxY);
  }
}
