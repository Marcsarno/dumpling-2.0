import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stepSchoolBall,kickSchoolBall,playerKick,ballFits} from '../src/systems/SchoolBallPhysics.ts';
const floor=[{minX:-10,maxX:10,minZ:-10,maxZ:10}],wall=[{minX:-4,maxX:4,minZ:-2,maxZ:-1.8}];
test('A strong kick rebounds from a thin wall instead of tunnelling through it',()=>{
 const b={x:0,z:-1.3,vx:0,vz:-5.4};let impacts=0;for(let i=0;i<18;i++){impacts+=stepSchoolBall(b,1/30,floor,wall);assert(b.z>=-1.57);}
 assert(impacts>0);assert(b.vz>0);
});
test('Real-time frame rate does not materially change the ball route',()=>{
 const roll=hz=>{const b={x:0,z:0,vx:2.3,vz:-3.2};for(let i=0;i<hz*2;i++)stepSchoolBall(b,1/hz,floor,wall);return b;};
 const a=roll(30),b=roll(120);assert(Math.hypot(a.x-b.x,a.z-b.z)<.075);
});
test('Passing assistance respects approach direction; sideways kicks stay sideways',()=>{
 const b={x:0,z:0,vx:0,vz:0};assert(playerKick(b,{x:0,z:1},{x:.2,z:-3}));assert(b.vz<0);
 assert.equal(playerKick(b,{x:-1,z:0},{x:.2,z:-3}),false);assert(b.vx>0);assert.equal(b.vz,0);
});
test('An idle ball settles without perpetual drift and cannot roll beyond a floor edge',()=>{
 const b={x:9.6,z:0,vx:5,vz:0};for(let i=0;i<2000;i++){stepSchoolBall(b,1/60,floor,[]);assert(ballFits(b.x,b.z,floor,[]));}
 assert.equal(b.vx,0);assert.equal(b.vz,0);
});
test('Zero direction does not inject NaN and kick speed is bounded',()=>{
 const b={x:0,z:0,vx:0,vz:0};assert.equal(kickSchoolBall(b,0,0,10),false);kickSchoolBall(b,100,-100,99);assert(Math.hypot(b.vx,b.vz)<=5.400001);
});
