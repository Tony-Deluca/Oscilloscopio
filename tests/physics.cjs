const assert=require('node:assert/strict');
const P=require('../physics.js');
const lab={circuit:'rc',r:2200,c:82e-9,channels:[{node:'in',probe:1},{node:'out',probe:1}],ext:'none'};
const f=870, r=lab.r, c=lab.c+22e-12, dc=1+r/1e6;
const close=(a,b,d,msg)=>assert.ok(Math.abs(a-b)<d,`${msg}: ${a} vs ${b}`);
const expected = Math.hypot(dc,2*Math.PI*f*r*c);
const transfer = P.response(lab,f);
close(transfer.gain,1/expected,1e-13,'RC gain');
close(transfer.phase,-Math.atan(2*Math.PI*f*r*c/dc),1e-13,'RC phase');
close(P.response(lab,transfer.cutoff).gain,1/dc/Math.SQRT2,1e-13,'-3dB');
const gen={on:true,freq:f,amp:1,offset:0,wave:'SINE',mode:'CONT',term:'HIGH Z',duty:50,settings:{},arbs:{}};
const v=P.signal(gen,lab,0,.01,()=>0);
const dt=1/(f*4000);
const a=Float64Array.from({length:8001},(_,i)=>v(i*dt)[0]);
const b=Float64Array.from({length:8001},(_,i)=>v(i*dt)[1]);
const ma=P.measures(a,dt),mb=P.measures(b,dt);
close(mb.Vpp/ma.Vpp,transfer.gain,1e-6,'sample ratio');
close(mb.Freq,f,1e-4,'sample frequency');
const delay=P.crossings(b,0,true,dt)[0]-P.crossings(a,0,true,dt)[0];
close(delay,-transfer.phase/(2*Math.PI*f),1e-9,'sample delay');
for (const circuit of ['direct','open']) {
 const path={...lab,circuit};
 const load=P.signal(gen,path,0,.01,()=>0)(1/(4*f));
 assert.ok(load.every(Number.isFinite));
 close(load[0],load[1],1e-14,circuit);
 if(circuit==='open') close(load[0],0,1e-14,circuit);
}
const square=P.signal({...gen,wave:'SQUARE',freq:100},lab,0,.01,()=>0);
const probeTime=50e-6,tau=(50+r)*c;
const ideal=.5*(1-2*Math.exp(-probeTime/tau));
close(square(probeTime)[1],ideal,.005,'square step');
const bins=P.spectrum(Float64Array.from({length:512},(_,i)=>Math.sin(2*Math.PI*24*i/512)), 'Rectangular');
close(bins[24],1/Math.SQRT2,1e-12,'FFT amplitude');
assert.equal(bins.indexOf(Math.max(...bins)),24);
for (const wave of ['SQUARE','TRIANGLE','RAMP','DC','ARB','NOISE']) {
 const fn=P.signal({...gen,wave,arb:'SINC'},lab,0,.002,()=>0);
 for (let i=0;i<50;i++) assert.ok(fn(i/50000).every(Number.isFinite));
}
console.log('RC analitico -3 dB, fase, misura campionata, gradino, FFT, forme e cablaggio: OK');
