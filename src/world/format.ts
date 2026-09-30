/** Types for the files written by tools/convert-editor-scene.mjs (format dumpling-world/1). */
export type Vec3Tuple = [number, number, number];
export type RGB = [number, number, number];

export type SurfaceKind = 'wood' | 'fabric' | 'rug' | 'checker' | 'terrazzo' | 'tile';

export interface MaterialDef {
  /** editor: authored material; code-primitive: primitives.ts material() painted; gltf-painted: glTF material cloned then painted. */
  source: 'editor' | 'code-primitive' | 'gltf-painted';
  name: string;
  color: RGB;
  workflow: 'metalness' | 'specular';
  metalness: number;
  specular?: RGB;
  gloss: number;
  glossInvert: boolean;
  emissive?: RGB;
  emissiveIntensity?: number;
  lamp?: boolean;
  opacity?: number;
  /** PlayCanvas blend type: 3 none, 2 normal. */
  blend?: number;
  depthWrite?: boolean;
  alphaTest?: number;
  /** PlayCanvas cull mode: 0 none, 1 back, 2 front. */
  cull?: number;
  twoSided?: boolean;
  vertexColors?: boolean;
  map?: string;
  mapTiling?: [number, number];
  mapOffset?: [number, number];
  opacityMap?: string;
  normalMap?: string;
  surface?: {kind: SurfaceKind; tiling: number};
}

interface Shadowing { castShadow: boolean; receiveShadow: boolean; enabled?: boolean }
export interface WorldNode {
  name: string;
  parent: number;
  p: Vec3Tuple;
  q: [number, number, number, number];
  s: Vec3Tuple;
  enabled?: false;
  /** The code-built original was disabled at runtime (its Editor record may still be enabled). */
  codeEnabled?: false;
  key?: string;
  tags?: string[];
  shape?: Shadowing & {type: 'box' | 'sphere' | 'cylinder' | 'cone' | 'plane' | 'capsule'; material: number};
  mesh?: Shadowing & {model: number; mesh: number; materials: (number | null)[]; vertices: number[]};
  model?: Shadowing & {model: number; materials: (number | null)[]; vertices: number[]};
}

export interface Aabb { center: Vec3Tuple; half: Vec3Tuple; index?: number; active?: false }
export interface RegionSemantics {
  colliders: Aabb[];
  walkable: {index: number; minX: number; maxX: number; minZ: number; maxZ: number}[];
  lights: {name: string; position: Vec3Tuple; type: string; color: RGB; intensity: number; range: number; enabled: boolean}[];
  interactions?: {id: string; anchor?: Vec3Tuple; marker?: Vec3Tuple; placement?: Vec3Tuple}[];
  propSpaces?: {key: string; origin: Vec3Tuple; world: number[]}[];
  sites?: {id: string; anchor?: Vec3Tuple; marker?: Vec3Tuple}[];
  exit?: Vec3Tuple;
  stock?: {site: number; slot: number; parentProp: string; position: Vec3Tuple; rotation: Vec3Tuple; scale: Vec3Tuple}[];
  propGroups?: {index: number; origin: Vec3Tuple; world: number[]}[];
}

export interface RegionFile {
  format: 'dumpling-world/1';
  region: string;
  scope: string;
  obsolete?: boolean;
  materials: MaterialDef[];
  models: {src: string; sha256: string}[];
  nodes: WorldNode[];
  semantics: RegionSemantics;
}

export interface SceneSettings {
  camera: {position: Vec3Tuple; rotation: Vec3Tuple; forward: Vec3Tuple; orthoHeight: number; near: number; far: number; clearColor: RGB};
  sun: {direction: Vec3Tuple; color: RGB; intensity: number; castShadows: boolean; shadowResolution: number; shadowDistance: number; shadowBias: number; normalOffsetBias: number};
  ambient: RGB;
}

export interface WorldIndex {
  regions: Record<string, {file: string; scope: string; obsolete?: boolean; nodes: number; renders: number}>;
  census: Record<string, number>;
  converted: Record<string, number>;
}
