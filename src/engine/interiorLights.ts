import {Float32BufferAttribute, ShaderChunk, type BufferGeometry} from 'three';

/**
 * Two small shader patches that make the house's lamps behave as in PlayCanvas. They must
 * run before the first material compiles (renderer.ts imports this module).
 *
 * 1. Linear falloff. PlayCanvas's default omni falloff is max((range - d) / range, 0).
 *    three.js has only inverse-power decay with a smooth window, which is harsher near the
 *    bulb and dimmer across a room. A point light with `decay = LINEAR_FALLOFF` (a negative
 *    decay, which three.js never uses) gets the PlayCanvas curve; other lights are unchanged.
 *
 * 2. Indoor-only lamps. PlayCanvas masks the lamps and the warm interior bounce to indoor
 *    geometry, so the garden is lit by the sun and sky alone and falls dark at night. three.js
 *    has no light masks, so garden geometry carries an `exterior` vertex flag (1 outdoors,
 *    absent or 0 indoors), and where it is set, standard materials skip the point lights and
 *    every directional light but the first (the shadow-casting sun, which three.js always
 *    orders first). A flag rather than separate materials keeps garden and house in the same
 *    batches (about 20 fewer draw calls), and whole garden triangles take the same branch,
 *    so skipping the lamps there is cheap.
 */
export const LINEAR_FALLOFF = -1;
export const EXTERIOR_ATTRIBUTE = 'exterior';

/**
 * Rewrite a chunk once. `find` must match exactly once; `insert` receives the matched text.
 * (Blank lines differ between three.js's source and its bundled build, so patterns allow any
 * whitespace.)
 */
const patch = (chunk: keyof typeof ShaderChunk, find: RegExp, insert: (match: string) => string, marker: string) => {
  const source = ShaderChunk[chunk];
  if (source.includes(marker)) return;
  const all = new RegExp(find.source, 'g');
  if ((source.match(all)?.length ?? 0) !== 1) throw Error(`three.js ${chunk} changed; update interiorLights.ts`);
  (ShaderChunk as Record<string, string>)[chunk] = source.replace(find, insert);
};

patch('lights_pars_begin', /float getDistanceAttenuation\( const in float lightDistance, const in float cutoffDistance, const in float decayExponent \) \{/,
  m => `${m}
	// PlayCanvas linear falloff (see src/engine/interiorLights.ts).
	if ( decayExponent < 0.0 ) return saturate( 1.0 - lightDistance / max( cutoffDistance, 0.0001 ) );`, 'PlayCanvas linear falloff');

// The flag travels from the vertex to the fragment shader, in standard materials only.
const head = /#if defined\( USE_UV \) \|\| defined\( USE_ANISOTROPY \)/;
patch('uv_pars_vertex', head, m => `#ifdef STANDARD // indoor-only lamps
	attribute float ${EXTERIOR_ATTRIBUTE};
	varying float vExterior;
#endif
${m}`, 'indoor-only lamps');
patch('uv_vertex', head, m => `#ifdef STANDARD // indoor-only lamps
	vExterior = ${EXTERIOR_ATTRIBUTE};
#endif
${m}`, 'indoor-only lamps');
patch('uv_pars_fragment', head, m => `#ifdef STANDARD // indoor-only lamps
	varying float vExterior;
	#define INDOORS ( vExterior < 0.5 )
#else
	#define INDOORS true
#endif
${m}`, 'indoor-only lamps');

// Point lights: the whole block runs indoors only; it closes just before the spot lights.
patch('lights_fragment_begin', /#if \( NUM_POINT_LIGHTS > 0 \) && defined\( RE_Direct \)/,
  m => `${m}
	if ( INDOORS ) { // lamps light indoors only`, 'lamps light indoors only');
patch('lights_fragment_begin', /#pragma unroll_loop_end\s*#endif\s*#if \( NUM_SPOT_LIGHTS > 0 \)/,
  () => `#pragma unroll_loop_end
	} // end of indoor lamps
#endif
#if ( NUM_SPOT_LIGHTS > 0 )`, 'end of indoor lamps');
// Directional lights: outdoors, only the first (the sun).
patch('lights_fragment_begin', /getDirectionalLightInfo\( directionalLight, directLight \);/,
  m => `${m}
		if ( UNROLLED_LOOP_INDEX > 0 && ! ( INDOORS ) ) directLight.color = vec3( 0.0 ); // outdoors: the sun only`, 'outdoors: the sun only');

/** Flag every vertex of a geometry as outdoors (1) or indoors (0). */
export function setExterior(geometry: BufferGeometry, outdoors: boolean) {
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute(EXTERIOR_ATTRIBUTE, new Float32BufferAttribute(new Float32Array(count).fill(outdoors ? 1 : 0), 1));
}
