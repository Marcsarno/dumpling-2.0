export const RARITIES = {
  Common: { weight: 65, color: '#c4b7d1', sparkles: 5, pitch: 1 },
  Rare: { weight: 25, color: '#78b8ec', sparkles: 10, pitch: 1.12 },
  Epic: { weight: 8, color: '#be87e6', sparkles: 16, pitch: 1.26 },
  Legendary: { weight: 2, color: '#f2c661', sparkles: 24, pitch: 1.5 },
} as const;
export type Rarity = keyof typeof RARITIES;
export interface DumplingDefinition {
  id: string; name: string; rarity: Rarity; color: string; accent: string;
  special?: 'frog' | 'panda' | 'bunny' | 'cat';
  face: 'smile' | 'sleepy' | 'wink'; accessory: 'none' | 'leaf' | 'bow' | 'star' | 'crown';
}
export const DUMPLINGS: readonly DumplingDefinition[] = [
  { id: 'mochi', name: 'Mochi', rarity: 'Common', color: '#fff0d7', accent: '#edafbd', face: 'smile', accessory: 'none' },
  { id: 'rosie', name: 'Rosie', rarity: 'Common', color: '#f2bed1', accent: '#d679a5', face: 'wink', accessory: 'bow' },
  { id: 'minty', name: 'Minty', rarity: 'Common', color: '#b6d9bd', accent: '#7da887', face: 'sleepy', accessory: 'leaf' },
  { id: 'blueberry', name: 'Blueberry', rarity: 'Rare', color: '#b5d5f3', accent: '#829ecd', face: 'smile', accessory: 'leaf' },
  { id: 'sunny', name: 'Sunny', rarity: 'Rare', color: '#f5dfa1', accent: '#e2ae76', face: 'wink', accessory: 'bow' },
  { id: 'lavendream', name: 'Lavendream', rarity: 'Rare', color: '#d5baf1', accent: '#aa80d0', face: 'sleepy', accessory: 'star' },
  { id: 'peachy', name: 'Peachy', rarity: 'Rare', color: '#f4c3aa', accent: '#db9c8c', face: 'smile', accessory: 'star' },
  { id: 'stardrop', name: 'Stardrop', rarity: 'Rare', color: '#ffe6a0', accent: '#d6a540', face: 'wink', accessory: 'crown' },
  { id:'shortcake',name:'Shortcake',rarity:'Common',color:'#f5bfd0',accent:'#df729b',face:'smile',accessory:'bow' },
  { id:'custard',name:'Custard',rarity:'Common',color:'#f5dea0',accent:'#d9ae6a',face:'sleepy',accessory:'none' },
  { id:'cocoa',name:'Cocoa Puff',rarity:'Rare',color:'#b88570',accent:'#f3cfb1',face:'wink',accessory:'bow' },
  { id:'macaron',name:'Macaron',rarity:'Rare',color:'#b5d4be',accent:'#f5c2d9',face:'smile',accessory:'leaf' },
  { id:'sorbet',name:'Sorbet',rarity: 'Rare',color:'#e4b9ef',accent:'#fdc5ac',face:'wink',accessory:'star' },
  { id:'sugarstar',name:'Sugar Star',rarity: 'Rare',color:'#fff1c0',accent:'#e6b867',face:'smile',accessory:'crown' },
  { id:'bunny',name:'Bunny Bun',rarity:'Common',color:'#fae8dd',accent:'#e8aec5',face:'smile',accessory:'bow' },
  { id:'kitten',name:'Peaches the Kitten',rarity:'Common',color:'#eec0a1',accent:'#d89594',face:'sleepy',accessory:'none' },
  { id:'panda',name:'Panda Puff',rarity:'Rare',color:'#eee7ec',accent:'#77748a',face:'smile',accessory:'none' },
  { id:'fox',name:'Little Fox',rarity:'Rare',color:'#d99c79',accent:'#fff1df',face:'wink',accessory:'leaf' },
  { id:'sleepykoala',name:'Sleepy Koala',rarity: 'Rare',color:'#bac0da',accent:'#f0c5d6',face:'sleepy',accessory:'star' },
  { id:'goldenbear',name:'Honey Bear',rarity: 'Rare',color:'#efcf83',accent:'#b59162',face:'smile',accessory:'crown' },
  { id:'moonbean',name:'Moonbean',rarity:'Common',color:'#c6c4e4',accent:'#f5e4ad',face:'sleepy',accessory:'star' },
  { id:'comet',name:'Comet',rarity:'Common',color:'#a8c6de',accent:'#c9a8e4',face:'wink',accessory:'star' },
  { id:'nebula',name:'Nebula',rarity:'Rare',color:'#d2a5d9',accent:'#99c9dc',face:'smile',accessory:'bow' },
  { id:'orbit',name:'Orbit',rarity:'Rare',color:'#a5d7d1',accent:'#edcde9',face:'wink',accessory:'star' },
  { id:'aurora',name:'Aurora',rarity: 'Rare',color:'#bbb0f2',accent:'#b0ead7',face:'sleepy',accessory:'crown' },
  { id:'supernova',name:'Supernova',rarity: 'Rare',color:'#fae3a1',accent:'#b6a4ed',face:'smile',accessory:'crown' },
  // Stable IDs preserve earlier preview receipts; the rejected designs are replaced.
  {id:'dewdrop-unicorn',name:'Matcha Frog',rarity:'Epic',color:'#b6d48b',accent:'#8eae67',face:'smile',accessory:'none',special:'frog'},
  {id:'sunbeam-unicorn',name:'Lotus Frog',rarity:'Legendary',color:'#acd6c5',accent:'#729f91',face:'smile',accessory:'none',special:'frog'},
  {id:'sugarplum-bunny',name:'Peach Blossom Bunny',rarity:'Epic',color:'#ffdac4',accent:'#eeabb4',face:'smile',accessory:'none',special:'bunny'},
  {id:'opal-bunny',name:'Lilac Blossom Bunny',rarity:'Legendary',color:'#e9dff5',accent:'#c79fc8',face:'smile',accessory:'none',special:'bunny'},
  {id:'starlight-panda',name:'Lavender Panda',rarity:'Epic',color:'#ffe2ca',accent:'#8b7891',face:'smile',accessory:'none',special:'panda'},
  {id:'moonwish-panda',name:'Honey Panda',rarity:'Legendary',color:'#fff0d6',accent:'#b59272',face:'smile',accessory:'none',special:'panda'},
  {id:'nebula-dragon',name:'Biscuit Kitty',rarity:'Epic',color:'#ffe4c7',accent:'#c49172',face:'smile',accessory:'none',special:'cat'},
  {id:'solstice-dragon',name:'Lilac Kitty',rarity:'Legendary',color:'#f3eafa',accent:'#aa94c2',face:'smile',accessory:'none',special:'cat'},
];
export const STORE_INVENTORY = {
  id: 'little-surprises', name: 'Dumpling blind box', price: 4, tripLimit: 3,
} as const;
export function randomUnit(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
}
/** Weighted tier roll, then equal chance among that tier's configured characters. */
export function rollDumpling(random: () => number = randomUnit): DumplingDefinition {
  const tiers = Object.entries(RARITIES) as [Rarity, { weight: number }][];
  const draw = random(), choice = random();
  if (![draw, choice].every(value => Number.isFinite(value) && value >= 0 && value < 1)) throw new Error('Random values must be in [0, 1).');
  let remaining = draw * tiers.reduce((sum, [, data]) => sum + data.weight, 0);
  for (const [tier, data] of tiers) {
    if (remaining < data.weight) {
      const options = DUMPLINGS.filter(dumpling => dumpling.rarity === tier);
      if (!options.length) throw new Error(`No dumplings configured for ${tier}.`);
      return options[Math.floor(choice * options.length)];
    }
    remaining -= data.weight;
  }
  throw new Error('Invalid rarity configuration.');
}
