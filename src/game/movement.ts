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

  place(x: number, z: number) { this.position.x = x; this.position.z = z; this.velocity.x = this.velocity.z = 0; this.approach = null; }

  private approach: {x: number; z: number; arrived: () => void; cancelled: () => void} | null = null;
  get approaching() { return this.approach !== null; }
  /**
   * Walk up to a prop (PlayCanvas PlayerController.approachProp): the best reachable standing
   * spot on rings 0.32-1.8 m around it, within 2.2 m, on free floor with a clear straight
   * line, preferring spots close to the prop. Any stick or key input cancels the walk-up.
   */
  approachProp(point: {x: number; z: number}, arrived: () => void, cancelled: () => void) {
    const start = {x: this.position.x, z: this.position.z}, candidates: {x: number; z: number; score: number}[] = [];
    const clear = (x: number, z: number) => {
      const n = Math.ceil(Math.hypot(x - start.x, z - start.z) / .06);
      for (let i = 1; i <= n; i++) if (this.blocked(start.x + (x - start.x) * i / n, start.z + (z - start.z) * i / n)) return false;
      return true;
    };
    for (let radius = .32; radius <= 1.8; radius += .06) for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
      const x = point.x + Math.sin(a) * radius, z = point.z + Math.cos(a) * radius, d = Math.hypot(x - start.x, z - start.z);
      if (d < 2.2 && !this.blocked(x, z) && clear(x, z)) candidates.push({x, z, score: Math.hypot(x - point.x, z - point.z) * 3 + d});
    }
    candidates.sort((a, b) => a.score - b.score);
    if (!candidates.length) { cancelled(); return; }
    this.approach = {x: candidates[0].x, z: candidates[0].z, arrived, cancelled};
  }
  cancelApproach() { const a = this.approach; this.approach = null; a?.cancelled(); }

  /** input: stick/keyboard vector, |input| ≤ 1, x right and y up the screen. */
  update(dt: number, input: {x: number; y: number}) {
    let ix = this.enabled ? this.right.x * input.x + this.forward.x * input.y : 0;
    let iz = this.enabled ? this.right.z * input.x + this.forward.z * input.y : 0;
    const k = 1 - Math.exp(-this.response * dt);
    if (this.approach) {
      if (input.x * input.x + input.y * input.y > .04 || document.hidden) this.cancelApproach();
      else {
        const dx = this.approach.x - this.position.x, dz = this.approach.z - this.position.z, d = Math.hypot(dx, dz);
        if (d < .045) { const a = this.approach; this.approach = null; this.velocity.x = this.velocity.z = 0; a.arrived(); return; }
        // Steer straight to the spot at full speed, easing into the last step (no input easing).
        const m = Math.min(1, d / (this.speed * Math.max(dt, 1e-3)));
        ix = dx / d * m; iz = dz / d * m;
        this.velocity.x = ix * this.speed; this.velocity.z = iz * this.speed;
      }
    }
    if (!this.approach) {
      this.velocity.x += (ix * this.speed - this.velocity.x) * k;
      this.velocity.z += (iz * this.speed - this.velocity.z) * k;
    }
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
