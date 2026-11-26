// Esporta i valori del modello JavaScript (physics.js) per la verifica in Python.
const P = require('../../physics.js');
const out = {};
const base = { circuit: 'rc', r: 2200, c: 82e-9, cable: 1, ext: 'none',
  channels: [{ node: 'in', probe: 1 }, { node: 'out', probe: 1 }] };
const gen = (o) => ({ on: true, freq: 1000, amp: 1, offset: 0, wave: 'SINE', mode: 'CONT', term: 'HIGH Z', duty: 50,
  modFreq: 100, fmFreq: 10, depth: 100, deviation: 100, settings: { amSource: 'INT', amShape: 'SINE', fmShape: 'SINE' }, arbs: {}, arb: 'SINC', ...o });
// 1. Funzione di trasferimento ai nodi
const freqs = Array.from({ length: 61 }, (_, i) => 10 * 10 ** (i / 10)); // 10 Hz – 10 MHz
out.loads = { in: P.load(base, 'in'), out: P.load(base, 'out') };
out.transfer = freqs.map((f) => ({ f, h: P.transfer(base, f) }));
out.response870 = P.response(base, 870);
// 2. Onda quadra in regime periodico (100 Hz e 1 kHz), nodi IN/OUT
out.square = [100, 1000].map((f) => { const fn = P.signal(gen({ wave: 'SQUARE', freq: f, amp: 2 }), base, 0, 1, () => 0);
  const T = 1 / f; return { f, t: Array.from({ length: 400 }, (_, i) => i * T / 400), v: Array.from({ length: 400 }, (_, i) => fn(i * T / 400)) }; });
// 3. Stadio d'ingresso
out.frontEnd = [1, 3, 10, 30, 100, 1e3, 1e6, 20e6, 150e6, 500e6].flatMap((f) => [
  { f, ac: true, bw: 150e6, h: P.frontEndGain({ ac: true, bw: 150e6 }, f) },
  { f, ac: false, bw: 20e6, h: P.frontEndGain({ ac: false, bw: 20e6 }, f) }]);
const direct = { ...base, circuit: 'direct', channels: [{ node: 'in', probe: 1 }, { node: 'none', probe: 1 }] };
const acsq = P.analog(gen({ wave: 'SQUARE', freq: 10, amp: 2 }), direct, [{ node: 'in', ac: true, bw: 150e6 }, { node: 'none', ac: false, bw: 150e6 }], 0, 1, () => 0);
out.acSquare = { t: Array.from({ length: 1000 }, (_, i) => i * 1e-4), v: Array.from({ length: 1000 }, (_, i) => acsq(i * 1e-4)[0]) };
// 4. Cavi: fronte della quadra 100 kHz, collegamento diretto, 0,5–2 m
out.cable = [0, 0.5, 1, 1.5, 2].map((len) => { const lab = { ...direct, cable: len };
  const fn = P.analog(gen({ wave: 'SQUARE', freq: 1e5, amp: 2 }), lab, [{ node: 'in', ac: false, bw: 150e6 }, { node: 'none', ac: false, bw: 150e6 }], 0, 1e-5, () => 0);
  const dt = 0.05e-9, v = Float64Array.from({ length: 6000 }, (_, i) => fn(i * dt)[0]);
  const s = P.analog(gen({ freq: 15e6, amp: 2 }), lab, [{ node: 'in', ac: false, bw: 150e6 }, { node: 'none', ac: false, bw: 150e6 }], 0, 1, () => 0);
  let pk = 0; for (let i = 0; i < 3000; i++) pk = Math.max(pk, s(i * 1e-10)[0]);
  return { len, cin: P.load(lab, 'in').cap, rise: P.measures(v, dt).Risetime, peak15: pk }; });
// 5. Spettro: 500 punti, toni su bin intero e fuori bin, quattro finestre
out.spectrum = ['Rectangular', 'Hanning', 'Blackman', 'Flattop'].flatMap((w) => [20, 20.37].map((k) => {
  const x = Array.from({ length: 500 }, (_, i) => 1.5 * Math.sin(2 * Math.PI * k * i / 500) + 0.2);
  return { window: w, k, x, bins: Array.from(P.spectrum(Float64Array.from(x), w)) }; }));
// 6. Misure automatiche su forme note
const N = 2000, dtm = 1e-6;
const shapes = { sine: (p) => Math.sin(2 * Math.PI * p), square: (p) => (p % 1 < 0.3 ? 1 : -1), triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5) };
out.measures = Object.entries(shapes).map(([name, fn]) => { const x = Float64Array.from({ length: N }, (_, i) => 0.5 * fn(i * dtm * 1000 + 0.13));
  return { name, x: Array.from(x), dt: dtm, m: P.measures(x, dtm) }; });
const tau = 20e-6, ex = Float64Array.from({ length: 4000 }, (_, i) => (i < 500 ? 0 : 1 - Math.exp(-(i - 500) * 1e-7 / tau)));
out.riseExp = { tau, rise: P.measures(ex, 1e-7).Risetime };
// 7. Campionamento: 870 Hz campionati a 250 Sa/s dal modello
const fn870 = P.signal(gen({ freq: 870 }), direct, 0, 1, () => 0);
out.alias = { fs: 250, x: Array.from({ length: 500 }, (_, i) => fn870(i / 250 + 0.0123)[0]) };
// 8. AM al 100 % e 0 %
out.am = [100, 0].map((d) => { let hi = -1e9, lo = 1e9; const g = gen({ mode: 'AM', depth: d, amp: 1 });
  for (let i = 0; i < 40000; i++) { const v = P.source(g, i * 2.5e-6, () => 0); hi = Math.max(hi, v); lo = Math.min(lo, v); } return { depth: d, vpp: hi - lo }; });
out.constants = P.constants;
require('fs').writeFileSync(process.argv[2], JSON.stringify(out));
console.log('esportato', Object.keys(out).join(', '));
