// Verifica di conformità ai manuali: tabella 5-2 completa, ADC, misure, FFT,
// cursori, Autoset, trigger, sonde, memoria, tempo di salita e limiti del
// generatore. Richiede Chrome con --remote-debugging-port=9238.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const page = fileURLToPath(new URL(process.argv[2] ?? '../index.html', import.meta.url));
const table = fs.readFileSync(new URL('./tabella-5-2.json', import.meta.url),'utf8');
const cdpUrl=process.env.BANCO_RC_CDP_URL ?? 'http://localhost:9238';
const target=(await (await fetch(new URL('/json/list',cdpUrl))).json()).find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let seq=0; const inflight=new Map(), errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.slice(0,300)); const it=inflight.get(m.id); if(it){inflight.delete(m.id); m.error?it.rej(m.error):it.res(m.result);}};
const send=(method,params={})=>new Promise((res,rej)=>{const id=++seq; inflight.set(id,{res,rej}); ws.send(JSON.stringify({id,method,params}));});
const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails).slice(0,500)); return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1410,height:950,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'file://'+page}); await wait(700);
const R=[]; const check=(name,ok,detail)=>R.push((ok?'OK   ':'FAIL ')+name+' — '+JSON.stringify(detail));
const reset=async()=>{await js("document.getElementById('reset-lab').click()"); await wait(150);};
const fresh=async(ms=400)=>{await js("capture=null; pending=null; nextArm=0;"); await wait(ms);};

// 1. Tabella 5-2 completa
const t52=await js(`(()=>{const rows=${table}; const L=[500,1250,2500,5000,12500,25000,50000,125000]; const bad=[]; let n=0;
 for(const r of rows) r.cells.forEach((c,i)=>{ s.recordLength=L[i]; const avail=lengthAvailable(L[i],r.time); n++;
  if(c===null){ if(avail) bad.push([r.time,L[i],'NA ma disponibile']); return; }
  if(!avail){bad.push([r.time,L[i],'disponibile ma NA']); return;}
  const p=acquisitionPlan(r.time); if(Math.abs(p.fs-c.fs)/c.fs>1e-9||p.et!==c.et) bad.push([r.time,L[i],c.fs,p.fs,c.et,p.et]); });
 s.recordLength=500; return {n,bad};})()`);
check('Tabella 5-2: tutte le celle', t52.bad.length===0, t52);

// 2. Misure su sinusoide 1 kHz 1 Vpp HIGH Z, collegamento diretto
await reset();
await js("lab.circuit='direct'; g.freq=1000; s.time=0.0005; s.acq='Sample'; s.channels[1].on=false; changed();"); await fresh(500);
let m=await js("({...metricCache[0], hz:capture.hz})");
check('Vpp sinusoide 1 Vpp (±3% + 0,05 div + 0,8 mV)', Math.abs(m.Vpp-1)<=0.03+0.05*0.2+0.0008+0.02, m.Vpp);
check('Freq 1 kHz', Math.abs(m.Freq-1000)<5, m.Freq);
check('Period 1 ms', Math.abs(m.Period-1e-3)<5e-6, m.Period);
check('Vrms 0,3536 V', Math.abs(m.Vrms-0.35355)<0.01, m.Vrms);
check('Frequenzimetro di trigger 1 kHz', Math.abs(m.hz-1000)<1, m.hz);
// 3. Terminazione 50 Ω su carico ad alta impedenza: lo schermo mostra il doppio
await js("g.term='50 Ω'; changed();"); await fresh(400);
m=await js("metricCache[0].Vpp"); check('50 Ω impostato su 1 MΩ: Vpp raddoppia', Math.abs(m-2)<0.06, m);
// 4. ADC: passo e saturazione
await js("g.term='HIGH Z'; g.amp=4; s.channels[0].scale=0.2; s.channels[0].pos=0; changed();"); await fresh(400);
m=await js("({max:Math.max(...capture.values[0]), min:Math.min(...capture.values[0]), step:(()=>{const v=[...new Set(capture.values[0])].sort((a,b)=>a-b); return v[1]-v[0];})()})");
check('Saturazione ADC a ±5,12 div (codici −128…+127)', Math.abs(m.max-127*0.008)<1e-9 && Math.abs(m.min+128*0.008)<1e-9, m);
await js("s.channels[0].coupling='GND'; s.acq='Sample'; changed();"); await fresh(400);
const codes=await js("[...new Set(capture.values[0])].sort((a,b)=>a-b)");
check('Passo ADC 1/25 div = 8 mV a 200 mV/div (rumore a massa)', codes.length>1 && codes.slice(1).every((v,i)=>Math.abs(v-codes[i]-0.008)<1e-9), codes);
// 5. Media: rumore ridotto
await js("g.amp=1; g.freq=1000; s.acq='Sample'; s.channels[0].scale=0.005; s.channels[0].coupling='GND'; changed();"); await fresh(400);
const sd=async()=>js("(()=>{const v=capture.values[0]; const mu=v.reduce((a,b)=>a+b,0)/v.length; return Math.sqrt(v.reduce((a,b)=>a+(b-mu)**2,0)/v.length);})()");
const sample=await sd(); await js("s.acq='Average'; s.avg=16; changed();"); await fresh(1500); const avg=await sd();
check('Average 16 riduce il rumore (GND, 5 mV/div)', avg < sample/2.5, {sample, avg});
// Media mobile: più medie, assestamento più lento; il cambio di segnale non azzera la media
const settle=async(n)=>{await reset(); await js("lab.circuit='direct'; s.channels[1].on=false; g.amp=1; s.acq='Average'; s.avg="+n+"; changed();"); await wait(n*20+600);
 const v0=await js('metricCache[0].Vpp'); await js('g.amp=2; changed();'); const t0=Date.now();
 while(Date.now()-t0<6000){ const v=await js('metricCache[0].Vpp'); if((v-v0)/(2-v0)>=0.63) return Date.now()-t0; await wait(40);} return Infinity;};
const s16=await settle(16), s64=await settle(64);
check('Average: assestamento più lento con più medie (16 < 64, ordine dei secondi)', s16<700 && s64>2*s16 && s64<3000, {s16,s64});
// 6. FFT: 1 Vrms → 0 dB con Flattop
await reset();
await js("lab.circuit='direct'; g.freq=1000; g.amp=2*Math.SQRT2; s.channels[0].scale=1; s.channels[1].on=false; s.time=0.0025; s.acq='Sample'; s.math=true; s.operation='FFT'; s.fftWindow='Flattop'; changed();"); await fresh(500);
m=await js("(()=>{const f=fftData(); let k=1; for(let i=1;i<f.bins.length;i++) if(f.bins[i]>f.bins[k]) k=i; return {hz:k*f.fs/500, db:20*Math.log10(f.bins[k]), res:f.fs/500}})()");
check('FFT: 1 Vrms = 0 dB (Flattop)', Math.abs(m.db)<0.3, m);
check('FFT: risoluzione fs/500', Math.abs(m.res-20)<1e-6 && Math.abs(m.hz-1000)<=m.res, m);
// 7. Cursori a passi di 1/25 div
await reset();
m=await js("(()=>{s.menu='Cursor'; preferredRow=1; s.cursorTMode='T1'; const a=s.cursorT[0]; scopeVariable(1); const b=s.cursorT[0]; s.cursorVMode='V1'; preferredRow=2; const c=s.cursorV[0]; scopeVariable(1); return {dt:(b-a)*visibleTime(), dv:(s.cursorV[0]-c)*s.channels[0].scale};})()");
check('Cursori: 20 µs e 8 mV per scatto (500 µs/div, 200 mV/div)', Math.abs(m.dt-20e-6)<1e-12 && Math.abs(m.dv-0.008)<1e-12, m);
// Cursori fissi sullo schermo: cambiando Volts/div e Time/div la lettura segue la scala
await reset();
m=await js("(()=>{s.menu='Cursor'; s.cursorVMode='Track'; s.cursorTMode='Track'; render(); const before=document.getElementById('screen-menu').innerText; const pos=[...s.cursorT, ...s.cursorV]; s.channels[0].scale=0.1; s.time=0.00025; changed(); const after=document.getElementById('screen-menu').innerText; return {same: JSON.stringify(pos)===JSON.stringify([...s.cursorT, ...s.cursorV]), before: /V1 496 mV/.test(before) && /T1 -800 µs/.test(before), after: /V1 248 mV/.test(after) && /T1 -400 µs/.test(after)};})()");
check('Cursori fermi sullo schermo, lettura secondo la nuova scala', m.same && m.before && m.after, m);
// 8. Autoset
await reset();
await js("lab.circuit='direct'; g.freq=1000; g.amp=1; changed(); autoset(); changed();"); await wait(300);
m=await js("({v:s.channels[0].scale, t:s.time, trig:s.trigSource, level:s.level})");
check('Autoset 1 kHz 1 Vpp → 200 mV/div e 250 µs/div', m.v===0.2 && Math.abs(m.t-250e-6)<1e-12, m);
// 9. Normal con livello fuori dal segnale → Trig?
await reset();
await js("s.trigMode='Normal'; s.level=2; changed();"); await fresh(500);
m=await js("({status:triggerStatus, capture:Boolean(capture)})");
check('Normal senza eventi: «Trig?» e nessuna traccia', m.status==='Trig?' && !m.capture, m);
// 10. Sonda ×10 fisica con menu ×1 → lettura 10 volte più bassa
await reset();
await js("lab.circuit='direct'; g.freq=1000; lab.channels[0].probe=10; s.channels[1].on=false; s.acq='Sample'; s.channels[0].scale=0.02; changed();"); await fresh(400);
const p1=await js("metricCache[0].Vpp"); await js("s.channels[0].probe=10; s.channels[0].scale=0.02; changed();"); await fresh(400);
const p10=await js("metricCache[0].Vpp*s.channels[0].probe");
check('Sonda ×10: menu ×1 legge 1/10, menu ×10 legge il valore vero', Math.abs(p1-0.1)<0.01 && Math.abs(p10-1)<0.05, {p1,p10});
// 11. Memoria lunga, stop e zoom massimo 7 scatti
await reset();
await js("s.recordLength=12500; changed();"); await fresh(400);
m=await js("({fs:capture.fs, len:capture.length})");
check('12 500 punti a 500 µs/div → 1 MSa/s', m.fs===1e6 && m.len===12500, m);
await js("document.getElementById('s-run').click()"); await wait(100);
for(let i=0;i<20;i++) await js("horizontalScale(1)");
m=await js("s.time"); check('Da fermo: zoom fino a 7 scatti oltre la riga 500 punti a 1 MSa/s (100 ns/div, manuale p. 21)', Math.abs(m-100e-9)<1e-18, m);
// 12. Tempo di salita: quadra 100 kHz, cavo 1 m, ET 10 ns/div
await reset();
await js("lab.circuit='direct'; lab.cable=1; lab.channels[1].node='none'; g.wave='SQUARE'; g.freq=1e5; g.amp=2; s.channels[0].scale=0.5; s.channels[1].on=false; s.time=10e-9; s.acq='Sample'; changed();"); await fresh(2500);
m=await js("({rise:metricCache[0].Risetime, et:capture.equivalent, filled:capture.values[0].filter(Number.isFinite).length})");
// Cavo adattato: conta il fronte del generatore (20 ns), non la lunghezza del cavo
const atteso=2.2*Math.hypot(20e-9/2.2,50*22e-12,1/(2*Math.PI*150e6));
check('Tempo di salita ≈ fronte del generatore (20 ns) con cavo adattato', Math.abs(m.rise-atteso)<2e-9, {...m, atteso});
// 13. Generatore: limiti del costruttore
await reset();
m=await js(`(()=>{const out={};
 g.term='50 Ω'; editGen('amp',20); out.ampMax50=g.amp; editGen('amp',0.01); out.ampMin50=g.amp;
 g.term='HIGH Z'; editGen('amp',30); out.ampMaxHZ=g.amp;
 g.amp=0.1; g.term='50 Ω'; editGen('offset',3); out.offsetWithSmallAmp=g.offset;
 g.offset=0; g.wave='TRIANGLE'; editGen('freq',1e6); out.triMax=g.freq;
 g.wave='SQUARE'; editGen('freq',1e6); editGen('duty',90); out.dutyMax=g.duty; editGen('freq',10e6); out.dutyAt10M=g.duty;
 return out;})()`);
check('Ampiezza su 50 Ω: 50 mVpp–10 Vpp', m.ampMax50===10 && m.ampMin50===0.05, m);
check('Ampiezza HIGH Z fino a 20 Vpp', m.ampMaxHZ===20, m.ampMaxHZ);
check('Offset ≤ 2 × Vpp (nota 3 delle specifiche)', Math.abs(m.offsetWithSmallAmp)<=0.2+1e-12, m.offsetWithSmallAmp);
check('Triangolo massimo 100 kHz', m.triMax===1e5, m.triMax);
check('Duty 20–80% fino a 5 MHz, 40–60% oltre', m.dutyMax===80 && m.dutyAt10M===60, m);
m=await js("(()=>{g.term='50 Ω'; g.offset=0; g.amp=1; chooseGenWave('ARB'); g.arb='SINC'; editGen('amp',10); const sinc=g.amp; g.arb='NEG RAMP'; editGen('amp',10); const ramp=g.amp; chooseGenWave('SINE'); g.amp=1; editGen('offset',3); const off=g.offset; const msg=genReadout; editGen('amp',0.1); return {sinc,ramp,off,msg,ampAfter:g.amp};})()");
check('Arb SINC max 6,084 Vpp, NEG RAMP 10 Vpp su 50 Ω', Math.abs(m.sinc-6.084)<0.01 && m.ramp===10, m);
check('Offset oltre il limite → MAX VALUE e offset massimo (2 V con 1 Vpp)', m.off===2 && m.msg==='MAX VALUE', m);
check('Ampiezza minima vincolata dall’offset (|Voff| ≤ 2·Vpp)', Math.abs(m.ampAfter-1)<1e-12, m);
// 15. Generatore: unità sulle frecce (V senza Shift, mV con Shift), AM, burst
await reset();
await js("['g-ampl','g-enter-number','g-square','g-up'].forEach(id=>document.getElementById(id).click())");
const vpp=await js("g.amp");
await js("['g-ampl','g-enter-number','g-ramp','g-noise','g-recall','g-shift','g-down'].forEach(id=>document.getElementById(id).click())");
m=await js("({amp:g.amp, unit:genUnit, text:document.getElementById('g-reading').textContent})");
check('Ampl, 2, ↑ = 2 Vpp; Ampl, 450, Shift ↓ = 450 mVrms (User’s Guide pp. 20–21)', vpp===2 && Math.abs(m.amp-0.45*2*Math.SQRT2)<1e-9 && /450\.0 mVRMS/.test(m.text), {vpp,...m});
m=await js("(()=>{g.mode='AM'; g.depth=100; g.amp=1; g.term='HIGH Z'; let hi=0, lo=0; for(let i=0;i<20000;i++){const v=Physics.source(g,i*5e-6,()=>0); hi=Math.max(hi,v); lo=Math.min(lo,v);} g.depth=0; let h0=0; for(let i=0;i<2000;i++) h0=Math.max(h0,Physics.source(g,i*5e-6,()=>0)); return {pp100:hi-lo, pp0:2*h0};})()");
check('AM: 100 % → picco pari all’ampiezza impostata, 0 % → metà', Math.abs(m.pp100-1)<0.02 && Math.abs(m.pp0-0.5)<0.01, m);
m=await js("(()=>{g.mode='CONT'; g.wave='SINE'; g.freq=10e6; ['g-shift','g-ramp'].forEach(id=>document.getElementById(id).click()); return {mode:g.mode, freq:g.freq, msg:genReadout};})()");
check('Burst: portante limitata a 5 MHz con FREQ LIMIT', m.mode==='BURST' && m.freq===5e6 && m.msg==='FREQ LIMIT', m);
m=await js("(()=>{const r=Physics.measures(Float64Array.from({length:500},(_,i)=>((i*7)%100)/100-0.5),1e-5); return {Vhi:r.Vhi, Vlo:r.Vlo};})()");
check('Vhi/Vlo su rampa = massimo/minimo', Math.abs(m.Vhi-0.49)<1e-9 && Math.abs(m.Vlo+0.5)<1e-9, m);
await js("document.getElementById('lab-preset').click()"); await wait(300);
m=await js("({circuit:lab.circuit, ch2:lab.channels[1].node, term:g.term, freq:g.freq, amp:g.amp, scale:s.channels[0].scale})");
check('Assetto esperienze: diretto su CH1, generatore e oscilloscopio di fabbrica', m.circuit==='direct' && m.ch2==='none' && m.term==='50 Ω' && m.freq===1000 && m.scale===2, m);
// Robustezza: Peak Detect con 125 000 punti, dati salvati danneggiati, arb piatta
m=await js("(()=>{s.recordLength=125000; s.time=0.0005; s.acq='Peak'; changed(); armAcquisition(now()); pending.trigger=now()+0.01; pending.triggered=true; const a=performance.now(); try{ completeAcquisition(pending); updateMetrics(); viewSlice(); }catch(e){ return {errore:String(e)}; } const ms=performance.now()-a; pending=null; s.recordLength=500; s.acq='Average'; changed(); return {ms:Math.round(ms), vpp:metricCache[0].Vpp};})()");
check('Peak Detect con 125 000 punti senza errori e in meno di 400 ms', !m.errore && m.ms<400 && Number.isFinite(m.vpp), m);
m=await js("(()=>{localStorage.setItem('banco-rc-setups', JSON.stringify({3:{channels:null, time:'x', cursorT:[1]}})); try{ recallSetup(3); render(); }catch(e){ return {errore:String(e)}; } const ok=s.channels.length===2 && timeSteps.includes(s.time) && s.cursorT.length===2; localStorage.removeItem('banco-rc-setups'); return {ok};})()");
check('Configurazione salvata danneggiata richiamata senza errori', m.ok===true, m);
m=await js("(()=>{g.arbs.FLAT=Array(8).fill(0); g.arb='FLAT'; chooseGenWave('ARB'); editGen('amp',1); const a=g.amp; delete g.arbs.FLAT; chooseGenWave('SINE'); return {amp:a};})()");
check('Forma arbitraria piatta: ampiezza non azzerata', m.amp===1, m);
// 14. Prestazioni: durata di un’acquisizione con memorie lunghe
await reset();
m=await js(`(()=>{const out={}; for(const L of [500,12500,125000]){ s.recordLength=L; s.time=0.0005; s.acq='Sample'; changed(); armAcquisition(now()); pending.trigger=now()+0.01; pending.triggered=true; const a=performance.now(); completeAcquisition(pending); updateMetrics(); viewSlice(); out[L]=Math.round(performance.now()-a); pending=null;} s.recordLength=500; return out;})()`);
check('Tempo di calcolo di un’acquisizione (ms)', m[125000]<400, m);
console.log(R.join('\n'));
ws.close();
if (errors.length) console.log('Errori JavaScript:', JSON.stringify(errors));
const failed = R.filter(r=>r.startsWith('FAIL')).length;
console.log(failed || errors.length ? `Conformità: ${failed} controlli falliti` : `Conformità: ${R.length} controlli superati`);
process.exit(failed || errors.length ? 1 : 0);
