import type { Rarity } from './collection.ts';

/** Presentation only. These settings never change odds, rewards or character colors. */
export const SQUISHY_PRESENTATION = {
  Common: { color:'#dacbdf', spark:'#ab92b7', ink:'#665070', wash:'#f4edf5', symbol:'♡', roughness:.52, coat:.06, accentCoat:.12, sparkles:0, rays:0, halo:.08, burst:.16, rim:.0, punch:0, intensity:.85, hold:.30, notes:[659.25,783.99] },
  Rare: { color:'#81c8ff', spark:'#479fed', ink:'#225784', wash:'#e4f3ff', symbol:'✧', roughness:.50, coat:.28, accentCoat:.20, sparkles:10, rays:0, halo:.13, burst:.32, rim:.10, punch:.008, intensity:1, hold:.50, notes:[659.25,830.61,987.77] },
  Epic: { color:'#c19af6', spark:'#a36ed6', ink:'#674091', wash:'#f0e6ff', symbol:'✦', roughness:.49, coat:.65, accentCoat:.30, sparkles:18, rays:0, halo:.32, burst:.43, rim:.40, punch:.013, intensity:1.15, hold:.70, notes:[659.25,830.61,987.77,1318.51] },
  Legendary: { color:'#f6cd68', spark:'#dea52e', ink:'#775215', wash:'#fff3cb', symbol:'✹', roughness:.48, coat:.90, accentCoat:.40, sparkles:28, rays:12, halo:.48, burst:.55, rim:.70, punch:.018, intensity:1.3, hold:.95, notes:[523.25,659.25,783.99,1046.50,1318.51] },
} as const satisfies Record<Rarity, object>;

export type SquishyPresentation = typeof SQUISHY_PRESENTATION[Rarity];
export const REVEAL_POP_TIME = .98;
export const REVEAL_SETTLE_TIME = 2.85;
export const revealDuration = (rarity:Rarity) => REVEAL_SETTLE_TIME + SQUISHY_PRESENTATION[rarity].hold;
