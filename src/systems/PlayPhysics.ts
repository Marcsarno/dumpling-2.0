export type PlayBody={x:number;y:number;z:number;vx:number;vy:number;vz:number;radius:number};
/** Small fixed-step toy simulation: gravity, elastic impacts and rolling drag. */
export function stepToy(b:PlayBody,dt:number,floor:number,bounds=2.25){
 const steps=Math.max(1,Math.ceil(dt/.012));
 for(let n=0;n<steps;n++){
  const h=dt/steps;b.vy-=9.8*h;b.x+=b.vx*h;b.y+=b.vy*h;b.z+=b.vz*h;
  if(b.y<floor+b.radius){b.y=floor+b.radius;b.vy=Math.abs(b.vy)>.55?-b.vy*.38:0;const drag=Math.exp(-1.0*h);b.vx*=drag;b.vz*=drag;}
  for(const axis of ['x','z'] as const){const v=axis==='x'?'vx':'vz',edge=bounds-b.radius;if(Math.abs(b[axis])>edge){b[axis]=Math.sign(b[axis])*edge;b[v]*=-.55;}}
 }
}
export function touchesCircle(a:{x:number;z:number},b:{x:number;z:number},radius:number){return Math.hypot(a.x-b.x,a.z-b.z)<radius;}
