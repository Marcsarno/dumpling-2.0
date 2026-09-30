/** Visual traits describe the actual 2D sprites, not the unfinished world models. */
export const POP_IDENTITY:Record<string,{shape:string;tone:string}>={
  mochi:{shape:'dumpling',tone:'cream'},rosie:{shape:'dumpling',tone:'pink'},minty:{shape:'dumpling',tone:'green'},blueberry:{shape:'dumpling',tone:'blue'},peachy:{shape:'dumpling',tone:'pink'},
  sunny:{shape:'pudding',tone:'yellow'},custard:{shape:'pudding',tone:'yellow'},
  lavendream:{shape:'bunny',tone:'purple'},bunny:{shape:'bunny',tone:'cream'},moonbean:{shape:'bunny',tone:'cream'},
  stardrop:{shape:'star',tone:'yellow'},sugarstar:{shape:'star',tone:'yellow'},comet:{shape:'star',tone:'blue'},supernova:{shape:'star',tone:'yellow'},
  shortcake:{shape:'cake',tone:'pink'},cocoa:{shape:'cake',tone:'brown'},sorbet:{shape:'cake',tone:'pink'},macaron:{shape:'macaron',tone:'green'},
  kitten:{shape:'cat',tone:'cream'},fox:{shape:'cat',tone:'orange'},aurora:{shape:'cat',tone:'purple'},
  panda:{shape:'bear',tone:'cream'},sleepykoala:{shape:'bear',tone:'blue'},goldenbear:{shape:'bear',tone:'yellow'},
  nebula:{shape:'cloud',tone:'pink'},orbit:{shape:'planet',tone:'green'},
  'dewdrop-unicorn':{shape:'frog',tone:'green'},'sunbeam-unicorn':{shape:'frog',tone:'green'},
  'sugarplum-bunny':{shape:'bunny',tone:'cream'},'opal-bunny':{shape:'bunny',tone:'purple'},
  'starlight-panda':{shape:'bear',tone:'cream'},'moonwish-panda':{shape:'bear',tone:'yellow'},
  'nebula-dragon':{shape:'cat',tone:'cream'},'solstice-dragon':{shape:'cat',tone:'purple'},
};
export const visuallyDistinct=(a:string,b:string)=>POP_IDENTITY[a].shape!==POP_IDENTITY[b].shape&&POP_IDENTITY[a].tone!==POP_IDENTITY[b].tone;
