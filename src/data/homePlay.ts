export type Point = [number,number,number];
export type ToyKind = 'ball'|'cup'|'beanbag'|'teddy'|'plate'|'cake'|'pitcher'|'wagon'|'block'|'car'|'ramp'|'cushion'|'blanket'|'paper'|'plane'|'book'|'hat'|'flamingo'|'jack'|'duck'|'boat'|'basin'|'bubbles'|'can'|'flower'|'pinwheel'|'rake'|'marker'|'fetch'|'basket'|'bed'|'board'|'surface'|'sofa';
export type ToyDefinition={id:string;name:string;kind:ToyKind;home:Point;color:string;fixed?:boolean};
const toy=(id:string,name:string,kind:ToyKind,home:Point,color='#d4addb',fixed=false):ToyDefinition=>({id,name,kind,home,color,fixed});
// Small sets share identities between bowling, building, pretend food and cargo.
export const HOME_TOYS:ToyDefinition[]=[
 toy('sofa','Sofa','sofa',[-2,.72,6],'#96b5a5',true),toy('desk-surface','Bedroom desk','surface',[2.2,1.19,1.3],'#fff0d5',true),
 toy('basket','Toy basket','basket',[1.8,.48,8.55],'#d4b18a',true),
 toy('ball','Soft ball','ball',[1.48,.67,8.45],'#c68cc5'),
 ...[0,1,2].map(i=>toy('cup'+i,['Mint cup','Rose cup','Honey cup'][i],'cup',[1.78+i*.19,.7,8.48],['#96c7b5','#ebafbd','#e8c16f'][i])),
 toy('beanbag','Beanbag','beanbag',[2.05,.7,8.69],'#de9c85'),toy('teddy','Teddy','teddy',[1.46,.7,8.72],'#bd8e63'),
 toy('picnic-plate','Toy plate','plate',[2.4,.10,8.2],'#d698bf'),toy('cake','Pretend cake','cake',[2.4,.16,8.2],'#eea0bb'),toy('pitcher','Tea pitcher','pitcher',[2.65,.1,8.25],'#96c7b5'),
 toy('wagon','Toy wagon','wagon',[2.6,.08,7.75],'#dc9385'),
 ...[0,1,2,3,4].map(i=>toy('block'+i,'Wooden block','block',[2.7+(i%2)*.23,.13+Math.floor(i/2)*.20,8.8],['#edc577','#a8c5d8','#cbaccf'][i%3])),
 toy('car','Little car','car',[3.1,.08,8.1],'#96c7b5'),toy('ramp0','Wooden ramp','ramp',[3.3,.08,8.55],'#d4b18a'),toy('ramp1','Wooden ramp','ramp',[3.3,.08,8.85],'#d4b18a'),
 toy('cushion0','Play cushion','cushion',[-1.25,.09,7.4],'#b5a1ce'),toy('cushion1','Play cushion','cushion',[-1.25,.09,8.15],'#dfa7b7'),toy('blanket','Den blanket','blanket',[-1.1,.12,8.75],'#99bdc7'),toy('toy-bed','Teddy’s bed','bed',[2.85,.08,7.0],'#d4b18a',true),
 toy('paper','Drawing paper','paper',[2.22,1.19,1.35],'#fff0d5'),toy('book','Picture book','book',[.81,.99,-2.99],'#a9bbd4'),toy('hat','Dress-up hat','hat',[2.45,.91,-1.5],'#e9b9d5'),toy('pinwheel','Pinwheel','pinwheel',[-4.44,.27,5.8],'#e5b271'),toy('board','Picture board','board',[1.7,1.55,-3.22],'#c09b73',true),
 toy('jack','Jack-in-the-box','jack',[2.35,.1,7.1],'#a6c8b1'),toy('duck','Wind-up duck','duck',[5.15,.1,5.2],'#f2ca66'),toy('fetch','Sunny’s soft toy','fetch',[1.85,.7,8.78],'#a3cbd2'),
 toy('basin','Toy basin','basin',[4.85,.09,12.0],'#a0c6d3'),toy('boat','Paper boat','boat',[5.65,.99,12.5],'#f3d698'),
 toy('bubbles','Bubble bottle','bubbles',[1.97,.75,8.75],'#95c9bd'),
 toy('flower','Doorstep flowers','flower',[-4.4,.07,5.75],'#dfa0bb',true),toy('can','Watering can','can',[-4.8,.08,5.5],'#9bbab8'),toy('flamingo','Garden flamingo','flamingo',[-4.45,.07,4.8],'#df9ead',true),toy('rake','Little rake','rake',[-4.5,.08,3.9],'#d1ae80'),
 toy('marker0','Garden goal marker','marker',[-4.5,.08,3.2],'#ead3a2'),toy('marker1','Garden goal marker','marker',[-4.5,.08,2.6],'#ead3a2'),
];
export const HOME_PLAY_IDS=['goal','bowling','cans','cart','boat','duck','bubbles','flower','pinwheel','jack','puddles','leaves','plane','flamingo','picnic'] as const;
