/**
 * Code-side material behaviour the PlayCanvas runtime layers under Editor paint.
 *
 * At runtime LayoutBridge clones each code-built material and copies only diffuse,
 * specular, gloss, metalness and (if present) diffuseMap from the Editor "paint"
 * material (PlayCanvas src/editor/LayoutBridge.ts paintMaterial). Everything else
 * comes from the code: workflow, gloss inversion, procedural surface maps, glass
 * blending and lamp emissive. This table ports exactly that, keyed by the code
 * material name recorded in migration/layout-source.json. The parity test checks
 * every resolved material against the PlayCanvas runtime dump.
 */

/** primitives.ts material(): specular workflow, gloss 0.15, specular (.08,.07,.09). */
export const PRIMITIVE_DEFAULTS={useMetalness:false,glossInvert:false};

/** SurfaceTextures.apply calls on primitive materials (kind, tiling). */
export const PRIMITIVE_SURFACES={
 'Honey birch':['wood',2],                // bedroom.ts m.wood; house.ts:13 surfaces.apply(m.wood,'wood')
 'Lilac rug':['rug',4],                   // bedroom.ts m.rug; house.ts:13
 'Living oatmeal rug':['rug',4],          // house.ts:110
 'Nursery butter rug':['rug',4],          // house.ts:170
 'Marc ivory bedside rug':['rug',4],      // house.ts:190
 'Marc slate woven carpet':['fabric',12], // house.ts:35
 'Shop woven rug':['rug',2],              // store.ts:17
 'Clover Corner floor':['tile',8],        // store.ts:16 (layout 0)
 'Peachy Playroom floor':['checker',8],   // store.ts:16 (layout 1)
 'Moonbeam Finds floor':['rug',5],        // store.ts:16 (layout 2)
};

/** HouseLighting shades: emissive (1,.67,.3) × nightAmount×0.8, i.e. 0 by day. */
export const LAMP_SHADES=new Set(['Bedside lamp shade','Warm household light glass']);
export const LAMP_EMISSIVE={color:[1,.67,.3],dayIntensity:0,nightIntensity:.8};

/**
 * HouseArt palette materials (names 'Cottage <pack>/<gltf material>/<colour>/<finish>'):
 * clone of the glTF material (metalness workflow, gloss stored as roughness), then
 * metalness 0, gloss .15, optional surface map. HouseArt.ts:40-52.
 */
export function houseArtRule(runtimeName){
 const m=/^Cottage ([^/]+)\/([^/]+)\/([^/]+)\/(natural|paint)$/.exec(runtimeName);
 if(!m)return null;
 const [,pack,original,,finish]=m;
 let surface=null;
 if(pack==='furniture'&&/^carpet/.test(original))surface=['fabric',.12];
 else if(pack==='furniture'&&finish==='natural'&&/^(wood|woodDark)$/.test(original))surface=['wood',.12];
 return {pack,original,surface,lamp:original==='lamp'};
}

/** SurfaceTextures.ts pixel program, reproduced so three.js can build identical canvases. */
export const SURFACE_KINDS=['wood','fabric','rug','checker','terrazzo','tile'];
