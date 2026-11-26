"use strict";

const Physics = (() => {
  const TAU = 2 * Math.PI;
  const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
  const frac = (x) => x - Math.floor(x);
  const mix = (a, b, f) => a + (b - a) * f;

  // Costanti fisiche del banco.
  // GDS-820C: ingresso 1 MΩ ±2 % con circa 22 pF (manuale, cap. 8).
  // Cavo coassiale RG-58 C/U: circa 101 pF/m (valore nominale di catalogo).
  // Sonda ×10 compensata: 10 MΩ con 10–15 pF alla punta (dispense del corso).
  // Accoppiamento AC: banda da 10 Hz a −3 dB (manuale, cap. 8).
  // Cavo RG-58: 50 Ω, fattore di velocità 0,66, cioè circa 5 ns/m.
  const SCOPE_R = 1e6,
    SCOPE_C = 22e-12,
    CABLE_C_PER_M = 101e-12,
    CABLE_DELAY_PER_M = 1 / (0.66 * 299792458),
    PROBE_TIP_C = 13e-12,
    AC_CORNER_HZ = 10;
  // Fronti del generatore (User's Guide, cap. 8): quadra < 20 ns,
  // triangolo, rampa e arbitrarie 40 ns tipici. La sinusoide è piatta.
  const EDGE_DEFAULT = 20e-9,
    EDGE_SLOW = 40e-9;
  const cableDelay = (lab) => (lab.cable ?? 1) * CABLE_DELAY_PER_M;
  function edgeTau(g, lab) {
    if (g.wave === "SQUARE") return (lab.genEdge ?? EDGE_DEFAULT) / 2.2;
    if (["TRIANGLE", "RAMP", "ARB"].includes(g.wave)) return EDGE_SLOW / 2.2;
    return 0;
  }

  const defaults = {
    "EXP RISE": (p) => Math.exp(5 * (p - 1)),
    "EXP FALL": (p) => Math.exp(-5 * p),
    "NEG RAMP": (p) => 1 - 2 * p,
    SINC: (p) => {
      const x = 6 * (2 * p - 1) * Math.PI;
      return Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x;
    },
    CARDIAC: (p) => {
      const peaks = [
        [0.18, 0.13, 0.038],
        [0.38, -0.14, 0.017],
        [0.41, 1, 0.014],
        [0.44, -0.24, 0.02],
        [0.68, 0.25, 0.065],
      ];
      return peaks.reduce(
        (sum, [center, height, width]) =>
          sum + height * Math.exp(-((p - center) ** 2) / (2 * width ** 2)),
        0,
      );
    },
  };
  const factoryArbs = Object.fromEntries(
    Object.entries(defaults).map(([name, fn]) => [
      name,
      Array.from({ length: 512 }, (_, i) => fn(i / 511)),
    ]),
  );
  const normalizations = new WeakMap();
  function arbValue(points, p) {
    if (!normalizations.has(points)) {
      const lo = Math.min(...points),
        hi = Math.max(...points);
      normalizations.set(points, [lo, hi]);
    }
    const [lo, hi] = normalizations.get(points);
    const i = p * points.length;
    return hi === lo
      ? 0
      : (2 *
          (mix(
            points[Math.floor(i)],
            points[(Math.floor(i) + 1) % points.length],
            frac(i),
          ) -
            lo)) /
          (hi - lo) -
          1;
  }
  function noise(i) {
    let n = (i | 0) ^ 0x11fb972c;
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return ((n ^ (n >>> 16)) >>> 0) / 2147483648 - 1;
  }
  function shape(name, phase, duty = 50, points = factoryArbs["EXP RISE"]) {
    const p = frac(phase);
    switch (name) {
      case "SINE":
        return Math.sin(TAU * p);
      case "SQUARE":
        return p < duty / 100 ? 1 : -1;
      case "TRIANGLE":
        return 1 - 4 * Math.abs(p - 0.5);
      case "RAMP":
        return 2 * p - 1;
      case "ARB":
        return arbValue(points, p);
      case "NOISE":
        return noise(Math.floor(phase));
      default:
        return 0;
    }
  }
  function source(g, t, external) {
    if (!g.on) return 0;
    const { freq, amp, offset, wave, mode, settings } = g;
    const scale = g.term === "50 Ω" ? 2 : 1;
    const modTime = g.singleMode ? t - g.firedAt : t;
    const fmFreq = g.fmFreq ?? g.modFreq;
    let phase = t * freq,
      amplitude = amp / 2;
    if (mode === "AM") {
      const m =
        settings.amSource === "INT"
          ? shape(settings.amShape, t * g.modFreq)
          : external(t);
      // Profondità 0 %: metà dell'ampiezza impostata; 100 %: l'ampiezza
      // impostata al picco della modulante (User's Guide, «Modulation Depth»).
      amplitude *= (1 + (g.depth / 100) * m) / 2;
    }
    if (mode === "FM") {
      // Integrale della modulante: la fase resta continua.
      const cycles = t * fmFreq;
      const integral = periodicPrimitive(settings.fmShape, cycles);
      phase += (g.deviation * integral) / fmFreq;
    }
    if (mode === "FSK") {
      if (settings.fskSource === "INT") {
        const elapsed = t * settings.fskRate;
        const high =
          (Math.floor(elapsed / 2) + Math.max(0, frac(elapsed / 2) * 2 - 1)) /
          settings.fskRate;
        phase += (settings.fskFreq - freq) * high;
      } else {
        const elapsed = t * (external.periodHz ?? 0);
        if (elapsed) {
          const high =
            (Math.floor(elapsed) / 2 + Math.min(0.5, frac(elapsed))) /
            external.periodHz;
          phase += (settings.fskFreq - freq) * high;
        }
      }
    }
    if (mode === "BURST") {
      const elapsed = g.singleMode
        ? modTime
        : frac(t * settings.burstRate) / settings.burstRate;
      const start = settings.burstPhase / 360;
      if (settings.burstSource === "EXT") {
        phase = t * freq + start;
        if (external(t) <= 0) phase = start;
      } else {
        phase =
          elapsed < 0 || elapsed * freq >= settings.burstCount
            ? start
            : elapsed * freq + start;
      }
    }
    if (mode === "SWEEP") {
      const { startFreq, stopFreq, sweepTime, sweepMode } = settings;
      const x = g.singleMode
        ? clamp(modTime, 0, sweepTime)
        : frac(t / sweepTime) * sweepTime;
      const logRatio = Math.log(stopFreq / startFreq);
      phase =
        sweepMode === "LOG" && Math.abs(logRatio) > 1e-10
          ? (startFreq * sweepTime * Math.expm1((logRatio * x) / sweepTime)) /
            logRatio
          : startFreq * x + ((stopFreq - startFreq) * x * x) / (2 * sweepTime);
      const totalPhase =
        sweepMode === "LOG" && Math.abs(logRatio) > 1e-10
          ? (sweepTime * (stopFreq - startFreq)) / logRatio
          : (sweepTime * (startFreq + stopFreq)) / 2;
      phase += g.singleMode
        ? Math.min(0, modTime) * startFreq +
          Math.max(0, modTime - sweepTime) * stopFreq
        : Math.floor(t / sweepTime) * totalPhase;
    }
    if (wave === "NOISE") phase = t * 20e6;
    return (
      scale *
      (offset +
        amplitude *
          shape(wave, phase, g.duty, g.arbs[g.arb] ?? factoryArbs[g.arb]))
    );
  }
  const primitives = {};
  function periodicPrimitive(name, phase) {
    if (name === "SINE") return (1 - Math.cos(TAU * phase)) / TAU;
    if (!primitives[name]) {
      const values = [0];
      for (let i = 0; i < 1024; i++)
        values.push(values.at(-1) + shape(name, (i + 0.5) / 1024) / 1024);
      primitives[name] = values;
    }
    const values = primitives[name];
    const pos = 1024 * frac(phase),
      i = Math.floor(pos);
    return (
      Math.floor(phase) * values.at(-1) +
      mix(values[i], values[i + 1], frac(pos))
    );
  }

  const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const cMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cDiv = (a, b) => {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };
  const polar = (z) => ({
    gain: Math.hypot(...z),
    phase: Math.atan2(z[1], z[0]),
  });

  // Carico di un ingresso: cavo BNC diretto (×1) oppure sonda compensata.
  function inputLoad(probe) {
    return probe === 1
      ? { conductance: 1 / SCOPE_R, cap: SCOPE_C, cable: true }
      : { conductance: 1 / (probe * SCOPE_R), cap: PROBE_TIP_C, cable: false };
  }
  function load(lab, node) {
    const cable = CABLE_C_PER_M * (lab.cable ?? 1);
    const direct = lab.circuit === "direct";
    const here = (n) => n === node || (direct && node === "in" && n === "out");
    // Nel collegamento diretto il cavo del generatore entra nel primo canale.
    let shared = direct && node === "in";
    let conductance = 0,
      cap = 0;
    for (const c of lab.channels) {
      if (!here(c.node)) continue;
      const input = inputLoad(c.probe);
      conductance += input.conductance;
      cap += input.cap;
      if (input.cable) {
        if (shared) shared = false;
        else cap += cable;
      }
    }
    if (here(lab.ext)) {
      conductance += 1 / SCOPE_R;
      cap += SCOPE_C + cable;
    }
    // Il cavo del generatore è una linea adattata (Rs = Z0 = 50 Ω): al suo
    // capo il nodo vede di nuovo 50 Ω con la tensione ritardata, senza la
    // capacità del cavo. I cavi verso l'oscilloscopio sono tronchi aperti:
    // fino a circa 20 MHz per 1–2 m equivalgono alla loro capacità.
    return { conductance, cap };
  }

  function transfer(lab, hz) {
    if (lab.circuit === "open")
      return [
        [0, 0],
        [0, 0],
      ];
    const delay = TAU * hz * cableDelay(lab);
    const lag = [Math.cos(delay), -Math.sin(delay)];
    return nodeTransfer(lab, hz).map((h) => cMul(h, lag));
  }
  function nodeTransfer(lab, hz) {
    const input = load(lab, "in"),
      output = load(lab, "out");
    const w = TAU * hz;
    const yi = [input.conductance, w * input.cap];
    if (lab.circuit === "direct") {
      const h = cDiv([1, 0], cAdd([1, 0], cMul([50, 0], yi)));
      return [h, h];
    }
    const yo = [output.conductance, w * (output.cap + lab.c)];
    const ratio = cDiv([1, 0], cAdd([1, 0], cMul([lab.r, 0], yo)));
    const h1 = cDiv(
      [1, 0],
      cAdd([1, 0], cMul([50, 0], cAdd(yi, cMul(yo, ratio)))),
    );
    return [h1, cMul(h1, ratio)];
  }

  function response(lab, hz) {
    const pair = transfer(lab, hz);
    const ratio = pair[0][0] || pair[0][1] ? cDiv(pair[1], pair[0]) : [0, 0];
    const out = load(lab, "out");
    return {
      ...polar(ratio),
      cutoff:
        lab.circuit === "rc"
          ? (1 / lab.r + out.conductance) / (TAU * (lab.c + out.cap))
          : Infinity,
    };
  }

  // Integratore esatto del circuito per un ingresso costante su ogni passo.
  function stepper(lab, dt) {
    const input = load(lab, "in"),
      output = load(lab, "out");
    if (lab.circuit === "open") return () => [0, 0];
    const dc = nodeTransfer(lab, 0).map((z) => z[0]);
    if (lab.circuit === "direct") {
      const q = input.cap
        ? Math.exp((-dt * (0.02 + input.conductance)) / input.cap)
        : 0;
      return (state, u) => {
        const v = dc[0] * u + q * (state[0] - dc[0] * u);
        return [v, v];
      };
    }
    const gr = 1 / lab.r,
      gi = 0.02 + input.conductance + gr;
    const go = gr + output.conductance,
      co = output.cap + lab.c;
    if (!input.cap) {
      const q = Math.exp((-dt * (go - (gr * gr) / gi)) / co);
      return (state, u) => {
        const v = dc[1] * u + q * (state[1] - dc[1] * u);
        return [(0.02 * u + gr * v) / gi, v];
      };
    }
    const a = -gi / input.cap,
      b = gr / input.cap,
      c = gr / co,
      d = -go / co;
    const distance = Math.hypot(a - d, 2 * Math.sqrt(b * c));
    const fast = (a + d - distance) / 2;
    const slow = (gi * go - gr * gr) / (input.cap * co * fast);
    const fastFactor = Math.exp(dt * fast),
      slowFactor = Math.exp(dt * slow);
    const k = (slowFactor - fastFactor) / (slow - fast);
    const e00 = fastFactor + k * (a - fast),
      e11 = fastFactor + k * (d - fast);
    return (state, u) => {
      const x = state[0] - dc[0] * u,
        y = state[1] - dc[1] * u;
      return [dc[0] * u + e00 * x + k * b * y, dc[1] * u + k * c * x + e11 * y];
    };
  }

  // Costante di tempo più rapida del circuito, per scegliere il passo.
  function fastestTau(lab) {
    if (lab.circuit === "open") return Infinity;
    const cap = load(lab, "in").cap;
    return cap ? 50 * cap : Infinity;
  }

  // Regime periodico ai nodi IN e OUT su un periodo del generatore.
  function steadyTable(g, lab, minTau = Infinity) {
    const period = 1 / g.freq;
    const tau = Math.min(minTau, fastestTau(lab));
    const wanted = Number.isFinite(tau) ? period / (tau / 4) : 0;
    const points = clamp(2 ** Math.ceil(Math.log2(Math.max(1, wanted))), 2048, 131072);
    const dt = period / points;
    const advance = stepper(lab, dt);
    const delay = cableDelay(lab);
    let forcing = Float64Array.from({ length: points }, (_, i) =>
      source(g, (i + 0.5) * dt - delay, () => 0),
    );
    const tg = edgeTau(g, lab);
    if (tg && dt < 20 * tg) forcing = firstOrder(forcing, dt, tg, false, null);
    const run = (state) => {
      for (const value of forcing) state = advance(state, value);
      return state;
    };
    const v = run([0, 0]),
      x = run([1, 0]),
      y = run([0, 1]);
    const a = 1 - (x[0] - v[0]),
      b = -(y[0] - v[0]),
      c = -(x[1] - v[1]),
      d = 1 - (y[1] - v[1]);
    const det = a * d - c * b;
    let state =
      Math.abs(det) > 1e-14
        ? [(d * v[0] - b * v[1]) / det, (a * v[1] - c * v[0]) / det]
        : [0, 0];
    const values = [new Float64Array(points), new Float64Array(points)];
    for (let i = 0; i < points; i++) {
      values[0][i] = state[0];
      values[1][i] = state[1];
      state = advance(state, forcing[i]);
    }
    return { period, dt, values };
  }

  // Evoluzione non periodica (modulazioni, rumore) su un intervallo.
  function transientTable(g, lab, t0, t1, external, minTau = Infinity) {
    const highest =
      g.wave === "NOISE"
        ? 20e6
        : Math.max(
            g.freq,
            g.freq + g.deviation * (g.mode === "FM"),
            g.mode === "FSK" ? g.settings.fskFreq : 0,
            g.mode === "SWEEP" ? g.settings.startFreq : 0,
            g.mode === "SWEEP" ? g.settings.stopFreq : 0,
          );
    const warm = Math.min(lab.r * lab.c * 5, t1 - t0);
    const start = t0 - warm;
    const tau = Math.min(minTau, fastestTau(lab));
    const byEdges = Number.isFinite(tau) ? (t1 - start) / (tau / 2) : 0;
    const n = clamp(
      Math.ceil(Math.max((t1 - start) * highest * 36, byEdges)),
      1024,
      40000,
    );
    const dt = (t1 - start) / n;
    const advance = stepper(lab, dt);
    const dc = nodeTransfer(lab, 0).map((z) => z[0]);
    const delay = cableDelay(lab);
    // Stato iniziale: punto di lavoro in continua per il valor medio della
    // sorgente, così anche le costanti di tempo lunghe partono a regime.
    let mean = 0;
    for (let i = 0; i < 4096; i++)
      mean += source(g, start + ((i + 0.5) * (t1 - start)) / 4096, external) / 4096;
    let state = dc.map((h) => h * mean);
    const values = [new Float64Array(n + 1), new Float64Array(n + 1)];
    const tg = edgeTau(g, lab),
      edge = tg && dt < 20 * tg ? Math.exp(-dt / tg) : 0;
    let u = mean;
    for (let i = 0; i <= n; i++) {
      if (i) {
        const raw = source(g, start + (i - 0.5) * dt - delay, external);
        u = edge ? edge * u + (1 - edge) * raw : raw;
        state = advance(state, u);
      }
      values[0][i] = state[0];
      values[1][i] = state[1];
    }
    return { start, dt, values };
  }

  const periodicLookup = (values, period) => {
    const n = values.length;
    return (t) => {
      const p = frac(t / period) * n,
        i = Math.floor(p) % n;
      return mix(values[i], values[(i + 1) % n], p - Math.floor(p));
    };
  };
  const linearLookup = (values, start, dt) => (t) => {
    const p = clamp((t - start) / dt, 0, values.length - 1 - 1e-9);
    const i = Math.floor(p);
    return mix(values[i], values[i + 1], p - i);
  };

  function steady(g, lab) {
    const scale = g.term === "50 Ω" ? 2 : 1;
    if (!g.on || lab.circuit === "open") return () => [0, 0];
    if (g.wave === "SINE") {
      const dc = transfer(lab, 0).map((z) => scale * g.offset * z[0]);
      const ac = transfer(lab, g.freq).map(polar);
      return (t) =>
        ac.map(
          ({ gain, phase }, i) =>
            dc[i] +
            ((scale * g.amp) / 2) * gain * Math.sin(TAU * g.freq * t + phase),
        );
    }
    const table = steadyTable(g, lab);
    const a = periodicLookup(table.values[0], table.period),
      b = periodicLookup(table.values[1], table.period);
    return (t) => [a(t), b(t)];
  }

  function signal(g, lab, t0, t1, external) {
    if (g.mode === "CONT" && g.wave !== "NOISE") return steady(g, lab);
    if (!g.on) return () => [0, 0];
    const table = transientTable(g, lab, t0, t1, external);
    const a = linearLookup(table.values[0], table.start, table.dt),
      b = linearLookup(table.values[1], table.start, table.dt);
    return (t) => [a(t), b(t)];
  }

  // Stadio d'ingresso dell'oscilloscopio: accoppiamento AC (passa-alto a
  // 10 Hz) e banda analogica (passa-basso del primo ordine a 150 MHz o al
  // limite di 20 MHz). Il primo ordine dà un tempo di salita 0,35/B: 2,3 ns.
  function frontEndGain(spec, hz) {
    let h = [1, 0];
    if (spec.ac) {
      const x = hz / AC_CORNER_HZ;
      h = cDiv([0, x], [1, x]);
    }
    return cDiv(h, [1, hz / spec.bw]);
  }
  function firstOrder(u, dt, tau, highpass, init) {
    const n = u.length,
      out = new Float64Array(n);
    const a = Math.exp(-dt / tau);
    let x = init;
    if (init === null) {
      // Regime periodico: x(0) = x(T).
      let r = 0;
      for (let i = 0; i < n; i++) r = a * r + (1 - a) * u[i];
      x = r / -Math.expm1((-n * dt) / tau);
    }
    for (let i = 0; i < n; i++) {
      x = a * x + (1 - a) * u[i];
      out[i] = highpass ? u[i] - x : x;
    }
    return out;
  }
  function frontEndTable(u, dt, spec, periodic, bias = 0) {
    let y = u;
    if (spec.ac)
      y = firstOrder(y, dt, 1 / (TAU * AC_CORNER_HZ), true, periodic ? null : bias);
    const tl = 1 / (TAU * spec.bw);
    if (dt < 20 * tl) y = firstOrder(y, dt, tl, false, periodic ? null : y[0]);
    return y;
  }

  const videoStandards = {
    ntsc: { lines: 525, fields: 60000 / 1001 },
    pal: { lines: 625, fields: 50 },
    secam: { lines: 625, fields: 50 },
  };
  function videoAt(kind, t) {
    const { lines, fields } = videoStandards[kind];
    const lineTime = 2 / (lines * fields);
    const phase = frac(t / lineTime);
    if (phase < 0.074) return -0.3;
    if (phase < 0.18 || phase > 0.97) return 0;
    return 0.1 + 0.55 * Math.sin((Math.PI * (phase - 0.18)) / 0.79) ** 2;
  }
  // Uscita di compensazione sonde: onda quadra 0–2 V a 1 kHz.
  const calibrationAt = (t) => (frac(1000 * t) < 0.5 ? 2 : 0);

  function periodicNode(fn, period, spec, points = 4096) {
    const dt = period / points;
    const u = Float64Array.from({ length: points }, (_, i) => fn(i * dt));
    return periodicLookup(frontEndTable(u, dt, spec, true), period);
  }

  // Tensione all'ingresso BNC di ogni canale dopo lo stadio analogico.
  // specs[i] = { node, ac, bw }. Restituisce t → [v0, v1, ...].
  function analog(g, lab, specs, t0, t1, external) {
    const scale = g.term === "50 Ω" ? 2 : 1;
    const minTau = Math.min(...specs.map((spec) => 1 / (TAU * spec.bw)));
    const on = g.on && lab.circuit !== "open";
    const periodic = g.mode === "CONT" && g.wave !== "NOISE";
    const dc = transfer(lab, 0).map((z) => scale * g.offset * z[0]);
    let table = null,
      transient = null;
    const fns = specs.map((spec) => {
      const node = spec.node;
      if (node === "cal")
        return periodicNode(calibrationAt, 1e-3, spec);
      if (node in videoStandards) {
        const { lines, fields } = videoStandards[node];
        return periodicNode((t) => videoAt(node, t), 2 / (lines * fields), spec, 2048);
      }
      if (node !== "in" && node !== "out") return () => 0;
      if (!on) return () => 0;
      const k = node === "in" ? 0 : 1;
      if (periodic && g.wave === "SINE") {
        const h = cMul(transfer(lab, g.freq)[k], frontEndGain(spec, g.freq));
        const { gain, phase } = polar(h);
        const a = ((scale * g.amp) / 2) * gain,
          w = TAU * g.freq,
          d = spec.ac ? 0 : dc[k];
        return (t) => d + a * Math.sin(w * t + phase);
      }
      if (periodic) {
        table ??= steadyTable(g, lab, minTau);
        const y = frontEndTable(table.values[k], table.dt, spec, true);
        return periodicLookup(y, table.period);
      }
      transient ??= transientTable(g, lab, t0, t1, external, minTau);
      const u = transient.values[k];
      const y = frontEndTable(u, transient.dt, spec, false, u.reduce((a, b) => a + b, 0) / u.length);
      return linearLookup(y, transient.start, transient.dt);
    });
    return (t) => fns.map((fn) => fn(t));
  }

  function crossings(values, level, rising, dt, start = 0) {
    const result = [];
    for (let i = 1; i < values.length; i++) {
      const a = values[i - 1],
        b = values[i];
      if (rising ? a < level && b >= level : a > level && b <= level)
        result.push(start + (i - 1 + (level - a) / (b - a)) * dt);
    }
    return result;
  }
  // Passaggi per un livello con isteresi: un nuovo passaggio conta solo dopo
  // che il segnale è tornato oltre la banda dal lato opposto.
  function crossingsWithHysteresis(values, level, rising, dt, band) {
    const result = [];
    let armed = false;
    for (let i = 1; i < values.length; i++) {
      const a = values[i - 1],
        b = values[i];
      if (rising ? b < level - band : b > level + band) armed = true;
      if (armed && (rising ? a < level && b >= level : a > level && b <= level)) {
        result.push((i - 1 + (level - a) / (b - a)) * dt);
        armed = false;
      }
    }
    return result;
  }
  function measures(values, dt, measuredPeriod) {
    if (values.length < 2) return {};
    let lo = Infinity,
      hi = -Infinity,
      sum = 0,
      square = 0;
    for (const v of values) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      sum += v;
      square += v * v;
    }
    const vpp = hi - lo,
      middle = (hi + lo) / 2;
    // Vhi e Vlo: livello più frequente di ciascuna metà (media dei campioni
    // della classe). Se l'istogramma non ha un picco netto, come in una rampa,
    // si usano il massimo e il minimo.
    const bins = new Uint32Array(64),
      sums = new Float64Array(64);
    if (vpp)
      for (const v of values) {
        const k = Math.min(63, Math.floor(((v - lo) / vpp) * 64));
        bins[k]++;
        sums[k] += v;
      }
    const level = (from, to, fallback) => {
      let index = from,
        total = 0;
      for (let i = from; i < to; i++) {
        total += bins[i];
        if (bins[i] > bins[index]) index = i;
      }
      const distinct = bins[index] >= Math.max(3, (2.5 * total) / (to - from));
      return distinct ? sums[index] / bins[index] : fallback;
    };
    const vhi = vpp ? level(32, 64, hi) : hi,
      vlo = vpp ? level(0, 32, lo) : lo;
    const hysteresis = 0.1 * vpp;
    const up = crossingsWithHysteresis(values, middle, true, dt, hysteresis),
      down = crossingsWithHysteresis(values, middle, false, dt, hysteresis);
    const period = measuredPeriod ?? up[1] - up[0];
    const positiveEnd = down.find((t) => t > up[0]);
    const negativeEnd = up.find((t) => t > down[0]);
    function transition(rising) {
      const a = crossings(
        values,
        vlo + (rising ? 0.1 : 0.9) * (vhi - vlo),
        rising,
        dt,
      )[0];
      const b = crossings(
        values,
        vlo + (rising ? 0.9 : 0.1) * (vhi - vlo),
        rising,
        dt,
      ).find((t) => t >= a);
      return b - a;
    }
    const first = Math.ceil(up[0] / dt),
      last = Math.ceil(up[1] / dt);
    const average =
      last > first
        ? values.slice(first, last).reduce((a, b) => a + b, 0) / (last - first)
        : sum / values.length;
    return {
      Vpp: vpp,
      Vamp: vhi - vlo,
      Vavg: average,
      Vrms: Math.sqrt(square / values.length),
      Vhi: vhi,
      Vlo: vlo,
      Vmax: hi,
      Vmin: lo,
      Freq: 1 / period,
      Period: period,
      Risetime: transition(true),
      Falltime: transition(false),
      "+Width": positiveEnd - up[0],
      "−Width": negativeEnd - down[0],
      Duty: ((positiveEnd - up[0]) / period) * 100,
    };
  }

  // Spettro di ampiezza (valore efficace per bin) su N campioni qualsiasi,
  // con il guadagno coerente della finestra compensato.
  function spectrum(data, window) {
    const n = data.length;
    if (n < 2) return new Float64Array(1);
    const x = new Float64Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const p = (TAU * i) / (n - 1);
      const weight =
        {
          Hanning: 0.5 - 0.5 * Math.cos(p),
          Blackman: 0.42 - 0.5 * Math.cos(p) + 0.08 * Math.cos(2 * p),
          Flattop:
            0.21557895 -
            0.41663158 * Math.cos(p) +
            0.277263158 * Math.cos(2 * p) -
            0.083578947 * Math.cos(3 * p) +
            0.006947368 * Math.cos(4 * p),
        }[window] ?? 1;
      x[i] = (Number.isFinite(data[i]) ? data[i] : 0) * weight;
      sum += weight;
    }
    const cos = Float64Array.from({ length: n }, (_, i) => Math.cos((TAU * i) / n));
    const sin = Float64Array.from({ length: n }, (_, i) => Math.sin((TAU * i) / n));
    const half = Math.floor(n / 2);
    const out = new Float64Array(half + 1);
    for (let k = 0; k <= half; k++) {
      let re = 0,
        im = 0,
        index = 0;
      for (let i = 0; i < n; i++) {
        re += x[i] * cos[index];
        im -= x[i] * sin[index];
        index += k;
        if (index >= n) index -= n;
      }
      out[k] =
        (Math.hypot(re, im) / sum) *
        (k === 0 || (n % 2 === 0 && k === half) ? 1 : Math.SQRT2);
    }
    return out;
  }

  return {
    clamp,
    mix,
    shape,
    factoryArbs,
    load,
    transfer,
    nodeTransfer,
    response,
    signal,
    analog,
    frontEndGain,
    source,
    crossings,
    measures,
    spectrum,
    videoStandards,
    videoAt,
    calibrationAt,
    constants: { SCOPE_R, SCOPE_C, CABLE_C_PER_M, CABLE_DELAY_PER_M, PROBE_TIP_C, AC_CORNER_HZ, EDGE_DEFAULT },
  };
})();

if (typeof module !== "undefined") module.exports = Physics;
