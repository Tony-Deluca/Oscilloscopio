"use strict";

const Physics = (() => {
  const TAU = 2 * Math.PI;
  const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
  const frac = (x) => x - Math.floor(x);
  const mix = (a, b, f) => a + (b - a) * f;
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
    let phase = t * freq,
      amplitude = amp / 2;
    if (mode === "AM") {
      const m =
        settings.amSource === "INT"
          ? shape(settings.amShape, t * g.modFreq)
          : external(t);
      amplitude *= 1 + (g.depth / 100) * m;
    }
    if (mode === "FM") {
      // Integral of the modulating waveform. Tables preserve continuous phase.
      const cycles = t * g.modFreq;
      const integral = periodicPrimitive(settings.fmShape, cycles);
      phase += (g.deviation * integral) / g.modFreq;
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

  function load(lab, node) {
    let conductance = 0,
      cap = 0;
    for (const c of lab.channels) {
      if (
        c.node !== node &&
        !(lab.circuit === "direct" && node === "in" && c.node === "out")
      )
        continue;
      conductance += 1 / (c.probe * 1e6);
      cap += 22e-12 / c.probe;
    }
    if (
      lab.ext === node ||
      (lab.circuit === "direct" && node === "in" && lab.ext === "out")
    ) {
      conductance += 1e-6;
      cap += 22e-12;
    }
    return { conductance, cap };
  }

  function transfer(lab, hz) {
    if (lab.circuit === "open")
      return [
        [0, 0],
        [0, 0],
      ];
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

  function stepper(lab, dt) {
    const input = load(lab, "in"),
      output = load(lab, "out");
    if (lab.circuit === "open") return () => [0, 0];
    const dc = transfer(lab, 0).map((z) => z[0]);
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
    const points = 2048,
      dt = 1 / (g.freq * points);
    const advance = stepper(lab, dt);
    const forcing = Float64Array.from({ length: points }, (_, i) =>
      source(g, (i + 0.5) * dt, () => 0),
    );
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
    const table = Array.from(forcing, (value) => {
      const prior = state;
      state = advance(state, value);
      return prior;
    });
    return (t) => {
      const index = frac(t * g.freq) * points;
      const i = Math.min(points - 1, Math.floor(index));
      const next = table[(i + 1) % points];
      return table[i].map((value, j) => mix(value, next[j], frac(index)));
    };
  }

  function signal(g, lab, t0, t1, external) {
    if (g.mode === "CONT" && g.wave !== "NOISE") return steady(g, lab);
    if (!g.on) return () => [0, 0];
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
    const n = clamp(Math.ceil((t1 - start) * highest * 36), 1024, 24000);
    const dt = (t1 - start) / n;
    const advance = stepper(lab, dt);
    const sourceAt = (t) => source(g, t, external);
    const dc = transfer(lab, 0).map((z) => z[0]);
    let state = dc.map((h) => h * g.offset * (g.term === "50 Ω" ? 2 : 1));
    const table = Array.from({ length: n + 1 }, (_, i) => {
      if (i) state = advance(state, sourceAt(start + (i - 0.5) * dt));
      return state;
    });
    return (t) => {
      const p = clamp((t - start) / dt, 0, n - 1e-9);
      return table[Math.floor(p)].map((v, j) =>
        mix(v, table[Math.floor(p) + 1][j], frac(p)),
      );
    };
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
    const bins = new Uint32Array(64);
    if (vpp)
      for (const v of values)
        bins[Math.min(63, Math.floor(((v - lo) / vpp) * 64))]++;
    const peak = (from, to) => {
      let index = from;
      for (let i = from + 1; i < to; i++) if (bins[i] > bins[index]) index = i;
      return lo + ((index + 0.5) / 64) * vpp;
    };
    const vhi = vpp ? peak(32, 64) : hi,
      vlo = vpp ? peak(0, 32) : lo;
    const up = crossings(values, middle, true, dt),
      down = crossings(values, middle, false, dt);
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

  function spectrum(data, window) {
    const n = 2 ** Math.floor(Math.log2(Math.min(data.length, 2048)));
    const a = new Float64Array(n),
      b = new Float64Array(n);
    let sum = 0;
    for (let i = 0, j = 0; i < n; i++) {
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
      a[j] = data[i] * weight;
      sum += weight;
      let bit = n >> 1;
      while (bit && j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
    }
    for (let len = 2; len <= n; len *= 2) {
      const half = len / 2;
      for (let i = 0; i < n; i += len)
        for (let j = 0; j < half; j++) {
          const angle = (-TAU * j) / len,
            c = Math.cos(angle),
            s = Math.sin(angle),
            k = i + j,
            l = k + half;
          const re = a[l] * c - b[l] * s,
            im = a[l] * s + b[l] * c;
          a[l] = a[k] - re;
          b[l] = b[k] - im;
          a[k] += re;
          b[k] += im;
        }
    }
    return Float64Array.from(
      { length: n / 2 + 1 },
      (_, i) =>
        (Math.hypot(a[i], b[i]) / sum) *
        (i === 0 || i === n / 2 ? 1 : Math.SQRT2),
    );
  }

  return {
    clamp,
    mix,
    shape,
    factoryArbs,
    transfer,
    response,
    signal,
    source,
    crossings,
    measures,
    spectrum,
  };
})();

if (typeof module !== "undefined") module.exports = Physics;
