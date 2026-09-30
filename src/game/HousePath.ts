import type {Aabb} from '../world/format';
import type {Walkable} from './movement';

export interface FloorPoint { x: number; z: number }
export interface PathArea { walkable?: Walkable[]; obstacles: Aabb[] }

/**
 * Floor-grid route planner shared by autonomous household characters (PlayCanvas
 * src/components/HousePath.ts): a character square of half-size `radius` must sit on the
 * walkable floors and clear every active blocker's X/Z footprint; routes are 8-way A* on a
 * 0.25 m grid, then shortcut to the furthest visible waypoint.
 */
export class HousePath {
  private readonly blockers: {x: number; z: number; hx: number; hz: number}[];
  constructor(private readonly area: PathArea, readonly radius = .17) {
    this.blockers = area.obstacles.filter(o => o.active !== false).map(o => ({x: o.center[0], z: o.center[2], hx: o.half[0], hz: o.half[2]}));
  }

  /** A copy that also avoids extra circular-ish blockers (e.g. Arianna standing in the way). */
  withObstacles(extra: {x: number; z: number; half: number}[], radius = this.radius) {
    return new HousePath({walkable: this.area.walkable, obstacles: [...this.area.obstacles,
      ...extra.map(e => ({center: [e.x, 0, e.z], half: [e.half, 2, e.half]} as Aabb))]}, radius);
  }

  free(x: number, z: number) {
    const r = this.radius, floors = this.area.walkable;
    if (floors) for (const a of [x - r, x + r]) for (const b of [z - r, z + r])
      if (!floors.some(w => a >= w.minX && a <= w.maxX && b >= w.minZ && b <= w.maxZ)) return false;
    return !this.blockers.some(o => Math.abs(x - o.x) <= o.hx + r && Math.abs(z - o.z) <= o.hz + r);
  }

  line(a: FloorPoint, b: FloorPoint) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .02);
    for (let i = 1; i <= n; i++) if (!this.free(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n)) return false;
    return true;
  }

  route(start: FloorPoint, end: FloorPoint): FloorPoint[] {
    if (!this.free(end.x, end.z)) return [];
    if (this.line(start, end)) return [{x: end.x, z: end.z}];
    const step = .25, key = (x: number, z: number) => x + ',' + z, d = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
    type Node = {x: number; z: number; g: number; f: number; parent?: Node};
    const open: Node[] = [], cost = new Map<string, number>(); let finish: Node | undefined;
    // Connect the actual position to a reachable grid cell; rounding into a chair
    // footprint must not create an invalid first segment.
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const x = Math.round(start.x / step) + dx, z = Math.round(start.z / step) + dz, p = {x: x * step, z: z * step};
      if (!this.free(p.x, p.z) || !this.line(start, p)) continue;
      const g = d(start, p) / step; cost.set(key(x, z), g); open.push({x, z, g, f: g + d(p, end) / step});
    }
    for (let iterations = 0; open.length && iterations < 5000; iterations++) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!, p = {x: current.x * step, z: current.z * step};
      if (d(p, end) < .4 && this.line(p, end)) { finish = current; break; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const x = current.x + dx, z = current.z + dz, v = {x: x * step, z: z * step}, g = current.g + Math.hypot(dx, dz), k = key(x, z);
        if (g >= (cost.get(k) ?? Infinity) || !this.free(v.x, v.z) || !this.line(p, v)) continue;
        cost.set(k, g); open.push({x, z, g, f: g + d(v, end) / step, parent: current});
      }
    }
    if (!finish) return [];
    const path: FloorPoint[] = [{x: end.x, z: end.z}];
    while (finish) { path.unshift({x: finish.x * step, z: finish.z * step}); finish = finish.parent; }
    path.unshift({x: start.x, z: start.z});
    const result: FloorPoint[] = [];
    for (let i = 0; i < path.length - 1;) { let j = path.length - 1; while (j > i + 1 && !this.line(path[i], path[j])) j--; result.push(path[j]); i = j; }
    return result;
  }
}
