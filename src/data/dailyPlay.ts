export const PLAY_ACTIVITIES = [
 {id:'goal',name:'Backyard champion',icon:'⚽',hint:'Kick the ball into the little goal.',verb:'Kick',clip:'PlayKick'},
 {id:'bowling',name:'Wobbly bowling',icon:'🎳',hint:'Roll the ball and topple the wobbling pins.',verb:'Roll',clip:'PlayRoll'},
 {id:'cans',name:'Tin-can tumble',icon:'🥫',hint:'Pick up the beanbag, then toss it at the cans.',verb:'Pick up',clip:'PlayReach'},
 {id:'cart',name:'Special delivery',icon:'📦',hint:'Push the trolley into its yellow delivery bay.',verb:'Push',clip:'CarryIdle'},
 {id:'boat',name:'Captain Paperboat',icon:'⛵',hint:'Carry the paper boat to the little water trough.',verb:'Pick up',clip:'PlayReach'},
 {id:'duck',name:'Waddle parade',icon:'🦆',hint:'Wind the duck three times. Watch who follows!',verb:'Wind',clip:'PlayInteract'},
 {id:'bubbles',name:'Bubble trouble',icon:'🫧',hint:'Make bubbles, then walk into them to pop them.',verb:'Make bubbles',clip:'PlayUse'},
 {id:'flower',name:'The sneezing flower',icon:'🌼',hint:'Bring the watering can to the droopy flower.',verb:'Pick up',clip:'PlayReach'},
 {id:'pinwheel',name:'Whirlwind wishes',icon:'💨',hint:'Blow three times and send the ribbons flying.',verb:'Blow',clip:'PlayInteract'},
 {id:'jack',name:'Surprise, ribbit!',icon:'🐸',hint:'Turn the handle three times. Who is inside?',verb:'Turn handle',clip:'PlayInteract'},
 {id:'puddles',name:'Puddle piano',icon:'🎵',hint:'Step in all four puddles to play a little tune.',verb:'Splash',clip:'PlayJump'},
 {id:'leaves',name:'Leaf-pile surprise',icon:'🍂',hint:'Jump into the leaves. Something is hiding!',verb:'Jump in',clip:'PlayJump'},
 {id:'plane',name:'Loop-de-loop post',icon:'✈️',hint:'Pick up the paper plane and send it through the hoops.',verb:'Pick up',clip:'PlayReach'},
 {id:'flamingo',name:'A very fancy flamingo',icon:'🎩',hint:'Give the garden flamingo a splendid hat.',verb:'Pick up',clip:'PlayReach'},
 {id:'picnic',name:'Teddy is hungry',icon:'🧸',hint:'Bring three treats from the basket to Teddy’s plates.',verb:'Pick up',clip:'PlayReach'},
] as const;
export type PlayId=typeof PLAY_ACTIVITIES[number]['id'];
export const playDefinition=(id:PlayId)=>PLAY_ACTIVITIES.find(a=>a.id===id)!;

/** A shuffled bag gives five random, unique activities per game day and lets
 * every activity appear within three days. Reloads never reroll the selection. */
export function selectDailyPlay(seed:number,day:number):PlayId[]{
 let state=(seed^Math.imul(Math.floor((Math.max(1,day)-1)/3)+1,0x9e3779b9))>>>0;
 const random=()=>{state=(state+0x6d2b79f5)>>>0;let n=Math.imul(state^(state>>>15),1|state);n^=n+Math.imul(n^(n>>>7),61|n);return((n^(n>>>14))>>>0)/4294967296;};
 const bag:PlayId[]=PLAY_ACTIVITIES.map(a=>a.id);
 for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
 const offset=((Math.max(1,day)-1)%3)*5;return bag.slice(offset,offset+5);
}

