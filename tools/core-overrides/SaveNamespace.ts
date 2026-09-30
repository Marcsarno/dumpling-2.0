/**
 * Dumpling Three keeps its own saves. Precedence matches the PlayCanvas game
 * (preview modes first), but every branch resolves inside `dumpling.three`, so the
 * rebuild never reads or writes the established PlayCanvas production keys. Changing this is
 * the save cutover and needs explicit owner approval.
 */
export const SCHOOL_REVIEW = new URLSearchParams(globalThis.location?.search??'').get('preview')==='school';
const OPENING_REVIEW = new URLSearchParams(globalThis.location?.search??'').get('preview')==='opening';
export const OUTDOOR_REVIEW = new URLSearchParams(globalThis.location?.search??'').get('preview')==='outdoors';
export const SAVE_PREFIX = new URLSearchParams(globalThis.location?.search??'').get('preview')==='home-play' ? 'dumpling.three.homePlayReview' : OUTDOOR_REVIEW ? 'dumpling.three.outdoorReview' : OPENING_REVIEW ? 'dumpling.three.openingReview' : SCHOOL_REVIEW ? 'dumpling.three.schoolReview' : 'dumpling.three';
export const saveKey = (suffix: string) => `${SAVE_PREFIX}.${suffix}`;
