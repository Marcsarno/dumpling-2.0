export const TORNADO_SECONDS=55;
export type Interruption='none'|'dog'|'basket';
export const INTERRUPTIONS={dog:{icon:'💩',bonus:10},basket:{icon:'🧺',bonus:10}} as const;
/** At most one cameo per round; most rounds have none. */
export function chooseInterruption(random=Math.random()):Interruption{return random<.2?'dog':random<.4?'basket':'none';}
export class TornadoScore {
  score=0;cleaned=0;streak=0;bestStreak=0;lastClean=-Infinity;
  clean(at:number,special:Interruption='none'){
    this.streak=at-this.lastClean<=8?Math.min(3,this.streak+1):1;this.lastClean=at;
    this.bestStreak=Math.max(this.bestStreak,this.streak);this.cleaned++;
    const points=10+(this.streak-1)*2+(special==='none'?0:INTERRUPTIONS[special].bonus);this.score+=points;return points;
  }
  get stars(){return this.score>=70?3:this.score>=30?2:1;}
  get reward(){return this.stars;}
}
