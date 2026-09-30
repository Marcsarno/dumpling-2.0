/**
 * Dumpling Three has no PlayCanvas runtime. A few vendored core files keep their
 * original type-only imports from 'playcanvas'; these structural types satisfy them.
 * There are no values here, so a value import from 'playcanvas' cannot build.
 */
declare module 'playcanvas' {
  export interface Vec3 { x: number; y: number; z: number }
  /** Opaque scene node reference carried through core types; never dereferenced by core code. */
  export interface Entity { readonly name: string }
}
