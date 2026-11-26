// Fuzzing dell'interfaccia: azioni casuali riproducibili (seme fisso) e
// controllo delle invarianti dopo ogni azione: nessuna eccezione, nessun
// NaN/undefined sui display, parametri validi, acquisizione mai bloccata.
// Uso: node tests/fuzz.mjs [seme] [azioni]   (Chrome su --remote-debugging-port=9238)
import {fileURLToPath} from 'node:url';
const [,, seedArg = '1', stepsArg = '300'] = process.argv;
const page = fileURLToPath(new URL('../index.html', import.meta.url));
const cdp = process.env.BANCO_RC_CDP_URL ?? 'http://localhost:9238';
const target=(await (await fetch(cdp+'/json/list')).json()).find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map(); const errors=[]; const console_=[];
ws.onmessage=e=>{const d=JSON.parse(e.data);
  if(d.method==='Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n').slice(0,4).join(' | '));
  if(d.method==='Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog',{accept:true,promptText:Math.random()<0.5?'HP033120':'X'});
  if(d.method==='Runtime.consoleAPICalled' && d.params.type==='error') console_.push(JSON.stringify(d.params.args.map(a=>a.value??a.description)).slice(0,200));
  if(pend.has(d.id)){pend.get(d.id)(d.result||{error:d.error});pend.delete(d.id);}};
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true}); if(r.exceptionDetails) return {__err:r.exceptionDetails.exception?.description}; return r.result?.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1410,height:950,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'file://'+page}); await wait(800);
await js("try{localStorage.clear()}catch{}; window.__long=0; new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__long=Math.max(window.__long,e.duration)}).observe({type:'longtask',buffered:true}); true");
let seed=Number(seedArg)||1; const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
const pick=a=>a[Math.floor(rnd()*a.length)];
const buttons=await js("[...document.querySelectorAll('button[id]')].map(b=>b.id).filter(i=>!['csv','s-hardcopy'].includes(i))");
const dials=await js("[...document.querySelectorAll('.dial')].map(d=>d.id)");
const selects=await js("[...document.querySelectorAll('select[id]')].map(s=>({id:s.id,opts:[...s.options].map(o=>o.value)}))");
const inputs=['resistance','capacitance','cable','gen-edge'];
const weird=['0','-5','1e9','abc','','0.0001','1e-12','99999999','3.3','1','50','0.5'];
const log=[]; const steps=Number(stepsArg)||500;
const invariants=`(()=>{const p=[];
 const txt=['g-reading','g-status','g-bottom','screen-menu','lcd-status','response','trigger-state'].map(i=>document.getElementById(i)?.innerText||'').join(' ');
 if(/NaN|undefined|Infinity|\\[object/.test(txt)) p.push('testo: '+txt.match(/.{0,30}(NaN|undefined|Infinity|\\[object).{0,30}/)[0]);
 for(const k of ['freq','amp','offset','duty','modFreq','fmFreq','depth','deviation']) if(!Number.isFinite(g[k])) p.push('g.'+k+'='+g[k]);
 if(g.amp<0) p.push('g.amp<0');
 for(const [i,c] of s.channels.entries()){ if(!voltSteps.includes(c.scale)) p.push('scale CH'+(i+1)+'='+c.scale); if(!Number.isFinite(c.pos)) p.push('pos CH'+(i+1)); }
 if(!timeSteps.includes(s.time)) p.push('time='+s.time);
 if(!Number.isFinite(s.pos)||!Number.isFinite(s.level)) p.push('pos/level');
 if(!Number.isFinite(lab.r)||!Number.isFinite(lab.c)||!(lab.r>0)||!(lab.c>0)) p.push('lab r/c '+lab.r+' '+lab.c);
 if(capture){ const v=capture.values[0]; if(!v||v.length!==capture.length) p.push('capture length'); if(!capture.equivalent&&!capture.roll&&v.some(x=>!Number.isFinite(x))) p.push('capture NaN');
   if(!(capture.dt>0)) p.push('capture dt'); }
 if(s.on&&s.running&&pending&&now()-pending.armedAt>60) p.push('acquisizione bloccata da '+(now()-pending.armedAt).toFixed(0)+' s');
 if(document.querySelectorAll('dialog[open]').length>1) p.push('dialoghi multipli');
 return p;})()`;
let failures=[];
for(let n=0;n<steps;n++){
  const r=rnd(); let a;
  if(r<0.45){ const b=pick(buttons); a='click '+b; await js(`document.getElementById('${b}')?.click()`); }
  else if(r<0.75){ const d=pick(dials), k=rnd()<0.5?'ArrowUp':'ArrowDown', c=1+Math.floor(rnd()*(rnd()<0.2?40:4)); a=`dial ${d} ${k}×${c}`;
    await js(`for(let i=0;i<${c};i++)document.getElementById('${d}').dispatchEvent(new KeyboardEvent('keydown',{key:'${k}',bubbles:true}))`); }
  else if(r<0.85){ const s=pick(selects), v=pick(s.opts); a=`select ${s.id}=${v}`; await js(`(()=>{const e=document.getElementById('${s.id}');e.value='${v}';e.dispatchEvent(new Event('change'));e.dispatchEvent(new Event('input'))})()`); }
  else if(r<0.92){ const i=pick(inputs), v=pick(weird); a=`input ${i}=${v}`; await js(`(()=>{const e=document.getElementById('${i}');e.value='${v}';e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('blur'))})()`); }
  else if(r<0.97){ const digits=['g-sine','g-square','g-triangle','g-ramp','g-noise','g-arb','g-freq','g-ampl','g-offset','g-single','g-recall','g-enter-number'];
    const seq=['g-enter-number',...Array.from({length:1+Math.floor(rnd()*6)},()=>pick(digits)), pick(['g-up','g-down','g-right','g-left','g-enter','g-shift'])]; a='entry '+seq.join(',');
    for(const b of seq) await js(`document.getElementById('${b}').click()`); }
  else if(r<0.985){ a='dialog close'; await js("document.querySelectorAll('dialog[open]').forEach(d=>{const f=d.querySelector('form'); if(Math.random()<0.5&&f) f.requestSubmit(); else d.close();})"); }
  else { a='time travel'; await wait(400); }
  log.push(a); if(log.length>25) log.shift();
  if(n%3===0) await wait(30);
  const p=await js(invariants);
  if(p?.__err) failures.push({n,problem:['eccezione nel controllo: '+p.__err],last:[...log]});
  else if(p.length) failures.push({n,problem:p,last:[...log]});
  if(errors.length){ failures.push({n,problem:['ECCEZIONE JS: '+errors.join(' || ')],last:[...log]}); errors.length=0; }
  if(failures.length>=3) break;
}
const long=await js('window.__long');
ws.close();
if (failures.length || console_.length) {
  console.log(JSON.stringify({seed:seedArg,failures:failures.slice(0,3),consoleErrors:console_.slice(0,5)},null,1));
  process.exit(1);
}
console.log(`Fuzz: ${steps} azioni casuali (seme ${seedArg}) senza errori; compito più lungo ${Math.round(long)} ms`);
