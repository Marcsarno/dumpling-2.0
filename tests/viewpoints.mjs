/**
 * Fixed camera framings shared by the PlayCanvas baseline and the three.js capture.
 * `focus` is the point the follow camera centres on (the player position in play);
 * `height` is the orthographic half-height. 5.7346 is what the game computes for a
 * 390x844 portrait viewport: max(5.1, 2.65 / aspect) × (Editor orthoHeight 7 / 7).
 */
export const VIEWPORT={width:390,height:844,deviceScaleFactor:3};
export const PLAY_HEIGHT=Math.max(5.1,2.65/(VIEWPORT.width/VIEWPORT.height));

export const VIEWPOINTS=[
 {id:'house-overview',scene:'house',focus:[3.85,6.35],height:14},
 {id:'house-bedroom',scene:'house',focus:[0,0],height:PLAY_HEIGHT},
 {id:'house-landing-bathroom',scene:'house',focus:[4.9,.4],height:PLAY_HEIGHT},
 {id:'house-living',scene:'house',focus:[1.6,6.5],height:PLAY_HEIGHT},
 {id:'house-kitchen',scene:'house',focus:[-.3,12.9],height:PLAY_HEIGHT},
 {id:'house-utility',scene:'house',focus:[4.5,11.3],height:PLAY_HEIGHT},
 {id:'house-nursery',scene:'house',focus:[8.75,0],height:PLAY_HEIGHT},
 {id:'house-marc',scene:'house',focus:[8.75,8.4],height:PLAY_HEIGHT},
 ...[['corner','Clover Corner',6.55],['toys','Peachy Playroom',8.35],['collector','Moonbeam Finds',7.75]].flatMap(([store,name,exitZ])=>[
  {id:`store-${store}-overview`,scene:'store',store,storeName:name,focus:[0,0],height:11},
  {id:`store-${store}-entry`,scene:'store',store,storeName:name,focus:[0,exitZ-.4],height:PLAY_HEIGHT},
  {id:`store-${store}-back`,scene:'store',store,storeName:name,focus:[0,-exitZ*.55],height:PLAY_HEIGHT},
 ]),
];
