export type BallBody={x:number;z:number;vx:number;vz:number};
export type BallRect={minX:number;maxX:number;minZ:number;maxZ:number};
export const BALL_RADIUS=.23;

export function ballFits(x:number,z:number,floors:BallRect[],solids:BallRect[]){
 for(const dx of [-BALL_RADIUS,BALL_RADIUS])for(const dz of [-BALL_RADIUS,BALL_RADIUS])
  if(!floors.some(r=>x+dx>=r.minX&&x+dx<=r.maxX&&z+dz>=r.minZ&&z+dz<=r.maxZ))return false;
 return !solids.some(r=>x>r.minX-BALL_RADIUS&&x<r.maxX+BALL_RADIUS&&z>r.minZ-BALL_RADIUS&&z<r.maxZ+BALL_RADIUS);
}

/** Small substeps keep fast kicks on the same side of thin school walls. */
export function stepSchoolBall(b:BallBody,dt:number,floors:BallRect[],solids:BallRect[]){
 let impacts=0;const count=Math.max(1,Math.ceil(Math.min(.1,Math.max(0,dt))/.008)),h=Math.min(.1,Math.max(0,dt))/count;
 for(let i=0;i<count;i++){
  const nx=b.x+b.vx*h;
  if(ballFits(nx,b.z,floors,solids))b.x=nx;else if(Math.abs(b.vx)>.08){b.vx*=-.76;impacts++;}else b.vx=0;
  const nz=b.z+b.vz*h;
  if(ballFits(b.x,nz,floors,solids))b.z=nz;else if(Math.abs(b.vz)>.08){b.vz*=-.76;impacts++;}else b.vz=0;
  const drag=Math.exp(-.72*h);b.vx*=drag;b.vz*=drag;
 }
 if(Math.hypot(b.vx,b.vz)<.055){b.vx=0;b.vz=0;}
 return impacts;
}

export function kickSchoolBall(b:BallBody,dx:number,dz:number,speed:number){
 const length=Math.hypot(dx,dz);if(length<.001)return false;
 const v=Math.min(5.4,Math.max(.2,speed));b.vx=dx/length*v;b.vz=dz/length*v;return true;
}

/** Direction follows the approach. A narrow cone helps a deliberate pass. */
export function playerKick(b:BallBody,player:{x:number;z:number},friend:{x:number;z:number},assist=true){
 let dx=b.x-player.x,dz=b.z-player.z;const length=Math.hypot(dx,dz);if(length<.05){dx=0;dz=-1;}else{dx/=length;dz/=length;}
 const fx=friend.x-b.x,fz=friend.z-b.z,fd=Math.hypot(fx,fz);
 const passing=assist&&fd>.8&&fd<6&&(dx*fx+dz*fz)/fd>.88;
 if(passing){dx=dx*.3+fx/fd*.7;dz=dz*.3+fz/fd*.7;}
 kickSchoolBall(b,dx,dz,passing?Math.min(4.6,fd*.75+1.05):4.35);
 return passing;
}
