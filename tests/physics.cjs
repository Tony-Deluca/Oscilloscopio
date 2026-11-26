const assert=require('node:assert/strict');
const P=require('../physics.js');
const lab={circuit:'rc',r:2200,c:82e-9,channels:[{node:'in',probe:1},{node:'out',probe:1}],ext:'none'};
const f=870, r=lab.r, c=lab.c+P.load(lab,'out').cap, dc=1+r/1e6;
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
// Cavo coassiale: 101 pF/m caricano l'uscita a 50 Ω del generatore.
const direct={...lab,circuit:'direct',channels:[{node:'in',probe:1},{node:'none',probe:1}]};
const spec={node:'in',ac:false,bw:150e6}, none={node:'none',ac:false,bw:150e6};
const edge=(cable)=>{
 const h=P.analog({...gen,wave:'SQUARE',freq:1e5,amp:2},{...direct,cable,genEdge:20e-9},[spec,none],0,1e-5,()=>0);
 const step=.05e-9, v=Float64Array.from({length:4000},(_,i)=>h(i*step)[0]);
 return P.measures(v,step).Risetime;
};
// Cavo del generatore adattato: nessuna capacità al nodo, solo ritardo (circa 5 ns/m).
close(P.load({...direct,cable:2},'in').cap,22e-12,1e-18,'cavo adattato senza capacità concentrata');
const lag=P.transfer({...direct,cable:1},15e6)[0], lag0=P.transfer({...direct,cable:0},15e6)[0];
close(Math.atan2(lag0[1],lag0[0])-Math.atan2(lag[1],lag[0]),2*Math.PI*15e6*P.constants.CABLE_DELAY_PER_M,1e-9,'ritardo del cavo');
// Fronte della quadra: generatore 20 ns, nodo 50 Ω × 22 pF e banda 150 MHz.
const expectedRise=2.2*Math.hypot(20e-9/2.2,50*22e-12,1/(2*Math.PI*150e6));
close(edge(2),expectedRise,1e-9,'tempo di salita con 2 m di cavo');
close(edge(0.5),edge(2),0.3e-9,'tempo di salita indipendente dal cavo adattato');
// Stadio d'ingresso: AC a 10 Hz e banda a 150 MHz (−3 dB).
close(Math.hypot(...P.frontEndGain({ac:true,bw:150e6},10)),Math.SQRT1_2,1e-6,'AC −3 dB a 10 Hz');
close(Math.hypot(...P.frontEndGain({ac:false,bw:150e6},150e6)),Math.SQRT1_2,1e-12,'banda 150 MHz');
const ac=P.analog({...gen,wave:'SQUARE',freq:10},direct,[{node:'in',ac:true,bw:150e6},none],0,1,()=>0);
assert.ok(ac(.001)[0]>.85 && ac(.049)[0]<.06,'onda quadra a 10 Hz deformata in AC');
// FFT su 500 punti: risoluzione fs/500.
const fft=P.spectrum(Float64Array.from({length:500},(_,i)=>Math.sin(2*Math.PI*20*i/500)),'Rectangular');
assert.equal(fft.length,251); close(fft[20],Math.SQRT1_2,1e-12,'FFT 500 punti');
console.log('RC analitico -3 dB, fase, misura campionata, gradino, FFT, forme, cablaggio, cavi e stadio d’ingresso: OK');
