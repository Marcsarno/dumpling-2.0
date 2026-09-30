/** Camera-relative desired direction, with a small, damped lateral slip.
 * Pure simulation: independent of rendering and stable across frame rates. */
export class ScooterDynamics {
 vx=0;vz=0;heading=0;lean=0;steer=0;
 reset(heading=0){this.vx=this.vz=this.lean=this.steer=0;this.heading=heading;}
 step(dt:number,x:number,z:number){
  dt=Math.max(0,Math.min(dt,.05));const input=Math.min(1,Math.hypot(x,z)),speed=Math.hypot(this.vx,this.vz);
  const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
  const delta=input>.06?wrap(Math.atan2(x,z)-this.heading):0;
  // Turn quickly at walking speed; broad, readable arcs when moving faster.
  const turn=Math.max(-1,Math.min(1,delta*1.8));
  const rate=3.6/(1+speed*.17);
  this.heading=wrap(this.heading+Math.max(-rate*dt,Math.min(rate*dt,delta)));
  this.steer+=(turn*.40-this.steer)*(1-Math.exp(-10*dt));
  this.lean+=(turn*Math.min(.17,speed*.035)-this.lean)*(1-Math.exp(-7*dt));
  const fX=Math.sin(this.heading),fZ=Math.cos(this.heading),rX=fZ,rZ=-fX;
  let forward=this.vx*fX+this.vz*fZ,lateral=this.vx*rX+this.vz*rZ;
  const target=input>.06?4.8*input*Math.max(.25,Math.cos(delta*.5)):0;
  forward+=(target-forward)*(1-Math.exp(-(input>.06?3.2:6.5)*dt));
  lateral*=Math.exp(-5.5*dt); // Gentle snow-like slip, quickly recovered.
  this.vx=fX*forward+rX*lateral;this.vz=fZ*forward+rZ*lateral;
  if(input<=.06&&Math.hypot(this.vx,this.vz)<.025)this.vx=this.vz=0;
 }
}
