import type {RegionSemantics} from './format';

/**
 * Authored coordinates relative to a saved Editor prop (PlayCanvas PropSpace.ts): gameplay
 * points such as Marc's chair were written against the prop's original spot; if the owner
 * moved the prop in the Editor, the points follow it.
 */
export function propSpace(semantics: RegionSemantics, key: string) {
  const s = semantics.propSpaces?.find(p => p.key === key);
  const m = s?.world, o = s?.origin ?? [0, 0, 0];
  return {
    point(x: number, z: number) {
      if (!m) return {x, z};
      const dx = x - o[0], dz = z - o[2];
      return {x: m[0] * dx + m[8] * dz + m[12], z: m[2] * dx + m[10] * dz + m[14]};
    },
    /** Authored height above the prop's base, following the prop's own height and scale. */
    height(y: number) { return m ? m[13] + y * Math.hypot(m[4], m[5], m[6]) : y; },
    /** Authored yaw in degrees plus the prop's own yaw, returned in radians. */
    yaw(degrees: number) { return (degrees * Math.PI / 180) + (m ? Math.atan2(m[8], m[10]) : 0); },
  };
}
