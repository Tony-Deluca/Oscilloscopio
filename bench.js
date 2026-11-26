"use strict";
const $ = (id) => document.getElementById(id);
const { clamp, mix } = Physics;
const copy = (value) => structuredClone(value);
const next = (items, value, delta = 1) =>
  items[
    (Math.max(0, items.indexOf(value)) +
      (delta % items.length) +
      items.length) %
      items.length
  ];
const palette = ["#ffd26c", "#76deec", "#f0a5ef", "#aada91", "#f3a77d"];
const timeSteps = Array.from({ length: 11 }, (_, i) =>
  [1, 2.5, 5].map((v) => Number((v * 10 ** (i - 9)).toPrecision(3))),
)
  .flat()
  .filter((v) => v <= 10);
const voltSteps = Array.from({ length: 4 }, (_, i) =>
  [1, 2, 5].map((v) => v * 10 ** (i - 3)),
)
  .flat()
  .filter((v) => v >= 0.002);
const lengths = [500, 1250, 2500, 5000, 12500, 25000, 50000, 125000];
const measureNames = [
  "—",
  "Vpp",
  "Vamp",
  "Vavg",
  "Vrms",
  "Vhi",
  "Vlo",
  "Vmax",
  "Vmin",
  "Freq",
  "Period",
  "Risetime",
  "Falltime",
  "+Width",
  "−Width",
  "Duty",
];
const channel = () => ({
  on: true,
  scale: 0.2,
  pos: 0,
  coupling: "DC",
  invert: false,
  bw: false,
  probe: 1,
});
const scopeDefault = () => ({
  on: true,
  running: true,
  menu: "Cursor",
  menuOn: true,
  channels: [channel(), { ...channel(), coupling: "AC" }],
  time: 0.0005,
  pos: 60e-6,
  horizontal: "Main",
  zoom: 0.00025,
  trigType: "Edge",
  trigSource: "CH1",
  trigMode: "Auto",
  level: 0,
  slope: "Rising",
  trigCoupling: "DC",
  reject: "Off",
  noiseReject: false,
  videoStandard: "NTSC",
  videoField: "Line",
  videoLine: 1,
  pulseWhen: "<",
  pulseWidth: 0.0005,
  delayType: "Time",
  delayTime: 0.001,
  delayEvents: 2,
  delayLevel: "USER",
  startLevel: 0,
  acq: "Average",
  avg: 16,
  recordLength: 500,
  draw: "Vector",
  persist: false,
  contrast: 75,
  grid: "Full",
  math: false,
  operation: "CH1+CH2",
  mathPos: 0,
  fftSource: 0,
  fftWindow: "Hanning",
  fftUnit: 20,
  fftPos: 0,
  fftCursorF: [1, 2],
  fftCursorM: [0, -1],
  selected: "CH1",
  cursorSource: 0,
  cursorTMode: "Off",
  cursorVMode: "Track",
  // Cursori in divisioni dal centro del reticolo: restano fermi sullo schermo
  // e la lettura segue la scala (T1 −800 µs, T2 2 ms, V1 496 mV, V2 352 mV
  // nella foto, a 500 µs/div e 200 mV/div).
  cursorT: [-1.6, 4],
  cursorV: [2.48, 1.76],
  metrics: ["Vpp", "Freq", "Vrms", "Period", "—"],
  slot: 1,
  saveType: "Setup",
  refSource: "CH1",
  refSlot: "A",
  refs: { A: false, B: false },
  refY: { A: 0, B: 0 },
  lang: "English",
  beep: "Off",
  printer: "HP",
  iface: "GPIB",
  addr: 1,
  baud: 9600,
  parity: "None",
  stopBits: 1,
  goSource: 0,
  goTolerance: 10,
  goTemplate: "Auto",
  goPosition: 0,
  goAction: "Continue",
  goWhen: "Violating",
  goActive: false,
  programMode: "Edit",
  programStep: 1,
  programItem: "Memory",
  programCycles: 1,
  programFrom: 1,
  programTo: 1,
  programBound: "From",
});
const genDefault = () => ({
  on: true,
  freq: 870,
  amp: 1,
  offset: 0,
  wave: "SINE",
  mode: "CONT",
  term: "HIGH Z",
  duty: 50,
  modFreq: 100,
  fmFreq: 10,
  depth: 100,
  deviation: 100,
  arb: "EXP RISE",
  arbs: {},
  singleMode: false,
  firedAt: 0,
  settings: {
    amShape: "SINE",
    amSource: "INT",
    fmShape: "SINE",
    burstCount: 1,
    burstRate: 100,
    burstPhase: 0,
    burstSource: "INT",
    fskFreq: 100,
    fskRate: 10,
    fskSource: "INT",
    startFreq: 100,
    stopFreq: 1000,
    sweepTime: 1,
    sweepMode: "LINEAR",
    powerOn: "DEFAULT",
    comma: "ON",
    hpib: 10,
    iface: "HP-IB",
    baud: 9600,
    parity: "NONE",
    calCount: 0,
  },
});
// Stato all'accensione del 33120A (User's Guide, p. 123). Le voci di sistema
// e di interfaccia restano in memoria non volatile.
function factoryGen(previous = genDefault()) {
  const base = genDefault();
  const kept = ["powerOn", "comma", "hpib", "iface", "baud", "parity", "calCount"];
  return {
    ...base,
    on: true,
    freq: 1000,
    amp: 0.1,
    term: "50 Ω",
    arbs: previous.arbs,
    settings: {
      ...base.settings,
      ...Object.fromEntries(kept.map((k) => [k, previous.settings[k]])),
    },
  };
}
const labDefault = () => ({
  circuit: "rc",
  r: 2200,
  c: 82e-9,
  channels: [
    { node: "in", probe: 1 },
    { node: "out", probe: 1 },
  ],
  ext: "none",
  mod: "none",
  cable: 1,
  // Fronti della quadra del 33120A: dichiarati < 20 ns (User's Guide, cap. 8).
  genEdge: 20e-9,
});
let g = genDefault(),
  s = scopeDefault(),
  lab = labDefault();
let menuGroup = 0,
  menuIndex = 0,
  menuLevel = -1,
  menuValue,
  genShift = false,
  digit = 0;
let genField = "amp",
  genUnit = "Vpp",
  genEntry = null,
  genArbDraft,
  genAction = null,
  genReadout = "";
let genQueue = [],
  calibrated = false,
  menuEdited = false;
let preferredRow = 0,
  help = null,
  undo = null,
  capture,
  clearScreen = false;
let cachedRows,
  menuSignature = "",
  noticeTimer,
  runningProgram,
  goCount = [0, 0];
// Lettura della posizione verticale mentre si gira POSITION (manuale,
// figura 5-2): resta a schermo per qualche secondo.
let positionReadout = null;
let lastFrame = 0,
  overlay = [],
  changeRevision = 0;
const epoch = performance.now();
const now = () => (performance.now() - epoch) / 1000;
const marks = {
  SINE: "∿",
  SQUARE: "▔▁",
  TRIANGLE: "△",
  RAMP: "⋰",
  NOISE: "Noise",
  ARB: "Arb",
  DC: "DC",
};

// Minimo e massimo con un ciclo: Math.max(...array) supera lo stack del
// browser con array lunghi (memoria da 125 000 punti).
function rangeOf(list) {
  let lo = Infinity,
    hi = -Infinity;
  for (const v of list) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}
// I dati salvati nel browser possono essere vecchi o danneggiati: si tengono
// solo i campi con il tipo atteso, gli altri tornano al valore predefinito.
function sanitize(defaults, value) {
  if (Array.isArray(defaults)) {
    if (!Array.isArray(value) || value.length !== defaults.length) return structuredClone(defaults);
    return defaults.map((d, i) => sanitize(d, value[i]));
  }
  if (defaults && typeof defaults === "object") {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.fromEntries(Object.keys(defaults).map((k) => [k, sanitize(defaults[k], source[k])]));
  }
  if (typeof defaults === "number") return Number.isFinite(value) ? value : defaults;
  return typeof value === typeof defaults ? value : defaults;
}
const finiteArray = (a, min = 1) =>
  Array.isArray(a) && a.length >= min && a.every((v) => Number.isFinite(v));
function storedArbs() {
  const raw = stored("arbs", {});
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([, points]) => finiteArray(points, 8) && points.length <= 16000)
      .slice(0, 4),
  );
}
function storedRefs() {
  const raw = stored("refs", {});
  const valid = (r) =>
    r && finiteArray(r.points, 2) && r.dt > 0 && Number.isFinite(r.start) && r.scale > 0;
  return Object.fromEntries(["A", "B"].filter((k) => valid(raw?.[k])).map((k) => [k, raw[k]]));
}
function storedGen(value) {
  const clean = sanitize(genDefault(), value);
  if (!["SINE", "SQUARE", "TRIANGLE", "RAMP", "NOISE", "ARB", "DC"].includes(clean.wave)) clean.wave = "SINE";
  if (!["CONT", "AM", "FM", "FSK", "BURST", "SWEEP"].includes(clean.mode)) clean.mode = "CONT";
  if (!["50 Ω", "HIGH Z"].includes(clean.term)) clean.term = "HIGH Z";
  return clean;
}
// Raccolte salvate (configurazioni, stati): sempre un oggetto semplice.
function storedObject(key) {
  const raw = stored(key, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}
function stored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem("banco-rc-" + key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem("banco-rc-" + key, JSON.stringify(value));
    return true;
  } catch {
    say("Memoria locale non disponibile");
    return false;
  }
}
function say(message) {
  $("notice").textContent = message;
  $("notice").hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    $("notice").hidden = true;
  }, 4200);
}
function changed(reacquire = true) {
  if (reacquire) {
    clearScreen = false;
    lastTrigger = -Infinity;
    changeRevision++;
    if (s.running) {
      pending = null;
      nextArm = 0;
    }
  }
  render();
}
function si(n, unit, digits = 4) {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0 " + unit;
  const scale = [
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
    [1e-12, "p"],
  ].find(([x]) => Math.abs(n) >= x) ?? [1e-12, "p"];
  return (
    Number((n / scale[0]).toPrecision(digits))
      .toString()
      .replace("e+", "e") +
    " " +
    scale[1] +
    unit
  );
}
function scaleStep(list, x, d) {
  if (!list.length) return x;
  const current = list.reduce(
    (best, value, i) =>
      Math.abs(Math.log(value / x)) < Math.abs(Math.log(list[best] / x))
        ? i
        : best,
    0,
  );
  return list[clamp(current + d, 0, list.length - 1)];
}
function button(label, action, options = {}) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "key " + (options.className ?? "");
  if (options.id) b.id = options.id;
  if (options.alt) {
    const alt = document.createElement("span");
    alt.className = "alt";
    alt.textContent = options.alt;
    b.append(alt);
  }
  b.append(label);
  if (options.digit) {
    const n = document.createElement("span");
    n.className = "digit";
    n.textContent = options.digit;
    b.append(n);
  }
  if (options.title) b.title = options.title;
  b.addEventListener("click", action);
  return b;
}
function dial(id, label, action, large = false) {
  const wrap = document.createElement("div");
  wrap.className = "knob-wrap";
  const cap = document.createElement("button");
  cap.type = "button";
  cap.id = id;
  cap.className = large ? "dial large" : "dial";
  cap.setAttribute("aria-label", label);
  cap.title = label + " · trascina, usa la rotella o premi le frecce";
  const caption = document.createElement("span");
  caption.textContent = label;
  wrap.append(cap, caption);
  let angle = -22,
    origin,
    travel = 0;
  const turn = (delta) => {
    angle += 15 * delta;
    cap.style.setProperty("--angle", angle + "deg");
    action(delta);
  };
  cap.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      turn(e.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
  cap.addEventListener("keydown", (e) => {
    if (
      [
        "ArrowUp",
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        " ",
        "Enter",
      ].includes(e.key)
    ) {
      e.preventDefault();
      turn(["ArrowDown", "ArrowLeft"].includes(e.key) ? -1 : 1);
    }
  });
  cap.addEventListener("pointerdown", (e) => {
    origin = [e.clientX, e.clientY];
    travel = 0;
    cap.setPointerCapture(e.pointerId);
  });
  cap.addEventListener("pointermove", (e) => {
    if (!origin) return;
    const total = Math.trunc(
      (e.clientX - origin[0] + origin[1] - e.clientY) / 8,
    );
    if (total !== travel) {
      turn(clamp(total - travel, -12, 12));
      travel = total;
    }
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    cap.addEventListener(type, () => {
      origin = null;
    });
  cap.addEventListener("click", (e) => {
    if (travel === 0 && e.detail > 0) turn(e.shiftKey ? -1 : 1);
  });
  return wrap;
}
const genGroups = [
  "A: MOD MENU",
  "B: SWP MENU",
  "C: EDIT MENU",
  "D: SYS MENU",
  "E: I/O MENU",
  "F: CAL MENU",
];
const numberItem = (name, key, min, max, unit, step) => ({
  name,
  key,
  min,
  max,
  unit,
  step,
});
const choice = (name, key, options) => ({ name, key, options });
const command = (name, fn) => ({ name, fn });
const waves = ["SINE", "SQUARE", "TRIANGLE", "RAMP"];
const modulationShapes = [...waves, "NOISE", "ARB"];
function genItems() {
  const arbNames = Object.keys(g.arbs);
  return [
    [
      choice("AM SHAPE", "amShape", modulationShapes),
      choice("AM SOURCE", "amSource", ["INT", "EXT"]),
      choice("FM SHAPE", "fmShape", modulationShapes),
      numberItem("BURST CNT", "burstCount", 1, 50000, "", 1),
      numberItem("BURST RATE", "burstRate", 0.01, 50000, "Hz", 1),
      numberItem("BURST PHAS", "burstPhase", -360, 360, "°", 1),
      choice("BURST SRC", "burstSource", ["INT", "EXT"]),
      numberItem("FSK FREQ", "fskFreq", 0.01, maxFrequency(), "Hz", 10),
      numberItem("FSK RATE", "fskRate", 0.01, 50000, "Hz", 1),
      choice("FSK SRC", "fskSource", ["INT", "EXT"]),
    ],
    [
      numberItem("START F", "startFreq", 0.01, maxFrequency(), "Hz", 10),
      numberItem("STOP F", "stopFreq", 0.01, maxFrequency(), "Hz", 10),
      numberItem("SWP TIME", "sweepTime", 0.001, 500, "s", 0.01),
      choice("SWP MODE", "sweepMode", ["LINEAR", "LOG"]),
    ],
    [
      command("NEW ARB", () => openArb()),
      ...(genArbDraft
        ? [
            command("POINTS", () => openArb("points")),
            command("LINE EDIT", () => openArb("line")),
            command("POINT EDIT", () => openArb("point")),
            command("INVERT", () => {
              genArbDraft = genArbDraft.map((x) => -x);
              say("Campioni invertiti");
            }),
            command("SAVE AS", () => openArb("save")),
          ]
        : []),
      command("DELETE", () =>
        arbNames.length
          ? openArb("delete")
          : say("Nessuna forma d’onda utente"),
      ),
    ],
    [
      choice("OUT TERM", "term", ["50 Ω", "HIGH Z"]),
      choice("POWER ON", "powerOn", ["DEFAULT", "LAST STATE"]),
      command("ERROR", () =>
        setGenMessage(genQueue.length ? genQueue.shift() : "0  NO ERROR"),
      ),
      command("TEST", () => setGenMessage("VIRTUAL TEST OK")),
      choice("COMMA", "comma", ["OFF", "ON"]),
      command("REVISION", () => setGenMessage("WEB · FW N/D")),
    ],
    [
      numberItem("HPIB ADDR", "hpib", 0, 30, "", 1),
      choice("INTERFACE", "iface", ["HP-IB", "RS-232"]),
      choice("BAUD RATE", "baud", [300, 600, 1200, 2400, 4800, 9600]),
      choice("PARITY", "parity", ["NONE", "EVEN", "ODD"]),
      command("LANGUAGE", () => setGenMessage("SCPI")),
    ],
    [
      command(calibrated ? "UNSECURED" : "SECURED", setCalibrationLock),
      ...(calibrated
        ? [
            command("CALIBRATE", () => {
              g.settings.calCount++;
              setGenMessage("VIRTUAL CAL");
            }),
          ]
        : []),
      command("CAL COUNT", () => setGenMessage(String(g.settings.calCount))),
      command("MESSAGE", () => setGenMessage("WEB SIM")),
    ],
  ];
}
function maxFrequency() {
  const points = g.arbs[g.arb]?.length ?? 0;
  const limit =
    {
      SINE: 15e6,
      SQUARE: 15e6,
      TRIANGLE: 1e5,
      RAMP: 1e5,
      ARB: points >= 12288 ? 200e3 : points >= 8193 ? 2.5e6 : 5e6,
    }[g.wave] ?? 15e6;
  // In burst la portante non supera 5 MHz (User's Guide, cap. 8).
  return g.mode === "BURST" ? Math.min(limit, 5e6) : limit;
}
// Le forme arbitrarie che non usano tutta la scala del DAC hanno un'ampiezza
// massima ridotta: la SINC arriva a 6,084 Vpp su 50 Ω (User's Guide, p. 59).
function arbAmplitudeFactor() {
  if (g.wave !== "ARB") return 1;
  const points = g.arbs[g.arb] ?? Physics.factoryArbs[g.arb];
  const [lo, hi] = rangeOf(points);
  // Una forma piatta non ha escursione da limitare: si usa la scala piena.
  return hi - lo > 1e-12 ? Math.min(1, (hi - lo) / 2) : 1;
}
// Vincoli fra ampiezza e offset: |Voffset| + Vpp/2 ≤ Vmax e |Voffset| ≤ 2·Vpp,
// con Vmax = 5 V su 50 Ω e 10 V ad alta impedenza (User's Guide, pp. 60–62).
function rangeG(field) {
  const half = g.term === "HIGH Z" ? 10 : 5;
  const offset = Math.abs(g.offset);
  const offsetLimit =
    g.wave === "DC" ? half : Math.min(half - g.amp / 2, 2 * g.amp);
  return {
    freq: [0.0001, maxFrequency()],
    amp: [
      Math.max(g.term === "HIGH Z" ? 0.1 : 0.05, offset / 2),
      // Arrotondato per difetto alla risoluzione del display (SINC: 6,084 Vpp).
      Math.min(Math.floor(2 * half * arbAmplitudeFactor() * 1000) / 1000, 2 * (half - offset)),
    ],
    offset: [-offsetLimit, offsetLimit],
    duty: g.freq <= 5e6 ? [20, 80] : [40, 60],
    modFreq: [0.01, 20000],
    fmFreq: [0.01, 10000],
    depth: [0, 120],
    deviation: [0.01, Math.max(0.01, Math.min(g.freq, 15e6 - g.freq))],
  }[field];
}
function editGen(field, value) {
  if (!Number.isFinite(value)) {
    genQueue.push("DATA OUT OF RANGE");
    return;
  }
  const [lo, hi] = rangeG(field);
  // Dal pannello lo strumento corregge il valore e mostra MAX o MIN VALUE.
  if (value > hi * (1 + 1e-12)) setGenMessage("MAX VALUE");
  else if (value < lo * (1 - 1e-12) - 1e-15) setGenMessage("MIN VALUE");
  g[field] = Number(clamp(value, lo, hi).toPrecision(10));
  if (field === "freq") {
    g.duty = clamp(g.duty, ...rangeG("duty"));
    g.deviation = clamp(g.deviation, ...rangeG("deviation"));
    g.settings.startFreq = Math.min(g.settings.startFreq, maxFrequency());
    g.settings.stopFreq = Math.min(g.settings.stopFreq, maxFrequency());
  }
}
function genUnits() {
  if (["freq", "modFreq", "fmFreq", "deviation"].includes(genField))
    return [
      ["MHz", 1e6],
      ["kHz", 1e3],
      ["Hz", 1],
    ];
  // Le frecce confermano in V; con Shift in mV (User's Guide, pp. 20–21:
  // 50 mVrms si ottengono con «Shift ↓»).
  const milli = genShift ? 0.001 : 1,
    m = genShift ? "m" : "";
  if (genField === "amp")
    return [
      [m + "Vpp", milli],
      [m + "Vrms", milli],
      ["dBm", 1],
    ];
  if (genField === "offset")
    return [
      [m + "V", milli],
      [m + "V", milli],
      [m + "V", milli],
    ];
  return [
    ["%", 1],
    ["%", 1],
    ["%", 1],
  ];
}
function waveRms() {
  switch (g.wave) {
    case "SINE":
      return 1 / (2 * Math.SQRT2);
    case "SQUARE":
      return 0.5;
    case "ARB": {
      const points = g.arbs[g.arb] ?? Physics.factoryArbs[g.arb];
      return (
        0.5 *
        Math.sqrt(
          points.reduce(
            (sum, _, i) =>
              sum +
              Physics.shape("ARB", i / points.length, g.duty, points) ** 2,
            0,
          ) / points.length,
        )
      );
    }
    default:
      return 1 / (2 * Math.sqrt(3));
  }
}
function commitNumber(index, current = false) {
  if (!genEntry) return;
  const unit = current ? genUnit : genUnits()[index][0];
  const factor = current ? 1 : genUnits()[index][1];
  const raw = Number(genEntry.replace(",", "."));
  if (genEntry.trim() && Number.isFinite(raw)) {
    let value = raw * factor;
    if (/rms/i.test(unit)) value /= waveRms();
    if (unit === "dBm") {
      if (g.term === "HIGH Z") {
        setGenMessage("dBm REQUIRES 50 Ω");
        genEntry = null;
        return;
      }
      value = Math.sqrt(50 * 0.001 * 10 ** (raw / 10)) / waveRms();
    }
    editGen(genField, value);
    if (genField === "amp") genUnit = unit.replace(/^m/, "");
  }
  genEntry = null;
}
function setGenMessage(message) {
  genReadout = message;
}
function chooseGenWave(wave) {
  g.wave = wave;
  if (["NOISE", "DC"].includes(wave)) {
    g.mode = "CONT";
    genField = wave === "DC" ? "offset" : "amp";
  }
  const before = [g.freq, g.amp];
  editGen("freq", g.freq);
  // Cambiando funzione ampiezza e offset si adattano ai nuovi limiti.
  if (wave !== "DC") {
    g.amp = clamp(g.amp, ...rangeG("amp"));
    g.offset = clamp(g.offset, ...rangeG("offset"));
  }
  const moved = (a, b) => Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(b));
  if (moved(g.freq, before[0])) setGenMessage("FREQ LIMIT");
  else if (moved(g.amp, before[1])) setGenMessage("AMPL LIMIT");
  else if (genReadout === "MAX VALUE") genReadout = "";
}
function currentGenItem() {
  return genItems()[menuGroup][menuIndex];
}
function enterGen() {
  if (genAction) {
    if (genAction.type === "state") {
      const states = storedObject("genStates");
      if (genAction.store) {
        states[genAction.slot] = g;
        if (save("genStates", states)) say("Stato generatore salvato");
      } else {
        const saved =
          genAction.slot === 0
            ? stored("genLast", null)
            : states[genAction.slot];
        if (saved) {
          const arbs = g.arbs;
          g = { ...storedGen(saved), on: true, arbs };
          if (
            !Object.hasOwn(arbs, g.arb) &&
            !Object.hasOwn(Physics.factoryArbs, g.arb)
          )
            g.arb = "SINC";
        } else say("Memoria vuota");
      }
    } else if (genAction.type === "arb") {
      g.arb = genAction.name;
      chooseGenWave("ARB");
    }
    genAction = null;
    return;
  }
  if (genEntry !== null) {
    commitNumber(2, true);
    return;
  }
  if (menuLevel < 0) return;
  if (menuLevel !== 2) {
    moveGenMenu(1);
    return;
  }
  const item = currentGenItem();
  if (item.fn) item.fn();
  else if (item.key === "term") {
    const factor = menuValue === g.term ? 1 : menuValue === "HIGH Z" ? 2 : 0.5;
    g.term = menuValue;
    g.amp *= factor;
    g.offset *= factor;
    if (g.term === "HIGH Z" && genUnit === "dBm") genUnit = "Vpp";
  } else g.settings[item.key] = menuValue;
  if (!item.fn) setGenMessage("ENTERED");
  menuEdited = false;
  menuLevel = -1;
}
function moveGenMenu(d) {
  menuLevel = clamp(menuLevel + d, 0, 2);
  if (menuLevel === 2) {
    const item = currentGenItem();
    menuValue = item.key === "term" ? g.term : g.settings[item.key];
  }
}
function genRotate(d) {
  if (!g.on) return;
  genReadout = "";
  if (genAction?.type === "state")
    genAction.slot = clamp(genAction.slot + d, genAction.store ? 1 : 0, 3);
  else if (genAction?.type === "arb")
    genAction.name = next(
      [...Object.keys(Physics.factoryArbs), ...Object.keys(g.arbs)],
      genAction.name,
      d,
    );
  else if (menuLevel === 0) {
    menuGroup = (menuGroup + (d % 6) + 6) % 6;
    menuIndex = 0;
  } else if (menuLevel === 1)
    menuIndex =
      (menuIndex +
        (d % genItems()[menuGroup].length) +
        genItems()[menuGroup].length) %
      genItems()[menuGroup].length;
  else if (menuLevel === 2) {
    const item = currentGenItem();
    menuEdited = true;
    if (item.options) menuValue = next(item.options, menuValue, d);
    if (item.step)
      menuValue = Number(
        clamp(
          menuValue + d * item.step * 10 ** digit,
          item.min,
          item.max,
        ).toPrecision(10),
      );
  } else if (genEntry === null) {
    const v = g[genField];
    const base = {
      freq: 1,
      amp: 0.01,
      offset: 0.01,
      duty: 1,
      modFreq: 1,
      fmFreq: 1,
      depth: 1,
      deviation: 1,
    }[genField];
    editGen(genField, v + d * base * 10 ** digit);
  }
  changed();
}
function genArrow(key) {
  if (!g.on) return;
  genReadout = "";
  if (genShift && key === "left" && genEntry === null) {
    genShift = false;
    menuLevel = 1;
    changed(false);
    return;
  }
  if (genEntry !== null) {
    if (key === "left") genEntry = genEntry.slice(0, -1);
    else {
      commitNumber(["up", "down", "right"].indexOf(key));
      genShift = false;
    }
  } else if (menuLevel >= 0 && ["up", "down"].includes(key))
    moveGenMenu(key === "up" ? -1 : 1);
  else if (
    (menuLevel >= 0 && (menuLevel < 2 || currentGenItem().options)) ||
    genAction
  ) {
    genRotate(["left", "up"].includes(key) ? -1 : 1);
    return;
  } else if (key === "left" || key === "right")
    digit = clamp(digit + (key === "left" ? 1 : -1), -4, 7);
  changed();
}
function genKey(key, digitKey) {
  if (key === "power") {
    if (g.on) {
      save("genLast", g);
      g.on = false;
    } else {
      const prior = stored("genLast", g);
      const arbs = g.arbs;
      g =
        g.settings.powerOn === "LAST STATE"
          ? { ...storedGen(prior), on: true, arbs }
          : factoryGen(g);
      genField = "freq";
      genUnit = "Vpp";
    }
    menuLevel = -1;
    genEntry = null;
    genShift = false;
    genAction = null;
    genReadout = "";
    changed();
    return;
  }
  if (!g.on) return;
  genReadout = "";
  if (key === "Shift") {
    genShift = !genShift;
    changed(false);
    return;
  }
  if (genShift && key === "Enter") {
    if (menuLevel >= 0) setGenMessage(menuEdited ? "NOT ENTERED" : "EXITING");
    menuEdited = false;
    menuLevel = menuLevel < 0 ? 0 : -1;
    genShift = false;
    genEntry = null;
    genAction = null;
    changed(false);
    return;
  }
  if (genShift && key === "Enter Number") {
    genEntry = null;
    genShift = false;
    genAction = null;
    menuLevel = -1;
    changed(false);
    return;
  }
  if (key === "Enter") {
    enterGen();
    changed();
    return;
  }
  if (genEntry !== null && digitKey) {
    if (digitKey === "±")
      genEntry = genEntry.startsWith("-") ? genEntry.slice(1) : "-" + genEntry;
    else if (
      genEntry.length < 14 &&
      (digitKey !== "." || !genEntry.includes("."))
    )
      genEntry += digitKey;
    changed(false);
    return;
  }
  menuLevel = -1;
  genAction = null;
  const shift = genShift;
  genShift = false;
  if ([...waves, "NOISE", "ARB"].includes(key)) {
    if (shift && key === "ARB") genAction = { type: "arb", name: g.arb };
    else if (shift) {
      const m = {
        SINE: "AM",
        SQUARE: "FM",
        TRIANGLE: "FSK",
        RAMP: "BURST",
        NOISE: "SWEEP",
      }[key];
      if (["DC", "NOISE"].includes(g.wave)) chooseGenWave("SINE");
      g.mode = g.mode === m ? "CONT" : m;
      g.singleMode = false;
      const carrier = g.freq;
      editGen("freq", g.freq);
      if (g.freq !== carrier) setGenMessage("FREQ LIMIT");
      // Il campo «AM/FM» segue la modulazione attiva.
      if (genField === "modFreq" || genField === "fmFreq")
        genField = g.mode === "FM" ? "fmFreq" : "modFreq";
      if (genField === "depth" || genField === "deviation")
        genField = g.mode === "FM" ? "deviation" : "depth";
    } else chooseGenWave(key);
  }
  if (key === "Freq") {
    genField = shift ? (g.mode === "FM" ? "fmFreq" : "modFreq") : "freq";
    digit = 0;
  }
  if (key === "Ampl") {
    genField = shift ? (g.mode === "FM" ? "deviation" : "depth") : "amp";
    digit = 0;
  }
  if (key === "Offset") {
    if (shift && g.wave !== "SQUARE") setGenMessage("SQUARE ONLY");
    else {
      genField = shift ? "duty" : "offset";
      digit = 0;
    }
  }
  if (key === "Single") {
    if (shift) g.singleMode = false;
    else if (["BURST", "SWEEP"].includes(g.mode)) {
      g.singleMode = true;
      g.firedAt = now();
    } else say("Single disponibile per burst e sweep");
  }
  if (key === "Recall")
    genAction = { type: "state", slot: shift ? 1 : 0, store: shift };
  if (key === "Enter Number" && genEntry === null) genEntry = "";
  changed();
}

const fieldLabels = {
  freq: "FREQUENCY",
  amp: "AMPLITUDE",
  offset: "DC OFFSET",
  duty: "% DUTY",
  modFreq: "AM FREQ",
  fmFreq: "FM FREQ",
  depth: "AM DEPTH",
  deviation: "FM DEVIATION",
};
function renderGenerator() {
  $("g-power").classList.toggle("live", g.on);
  $("g-power").setAttribute("aria-pressed", g.on);
  $("g-shift").classList.toggle("active", genShift);
  $("g-shift").setAttribute("aria-pressed", genShift);
  // Stato del pannello per i colori: legende blu con Shift, cifre verdi in
  // Enter Number.
  const panel = $("g-power").closest(".generator");
  panel.classList.toggle("shift", g.on && genShift);
  panel.classList.toggle("entry", g.on && genEntry !== null);
  const status = $("g-status"),
    reading = $("g-reading"),
    bottom = $("g-bottom");
  if (!g.on) {
    status.textContent = "";
    reading.textContent = "";
    bottom.textContent = "";
    return;
  }
  status.textContent = [
    genShift ? "SHIFT" : "",
    g.mode,
    g.singleMode ? "TRIG" : "",
    g.term,
  ]
    .filter(Boolean)
    .join("  ·  ");
  bottom.textContent =
    fieldLabels[genField] +
    "  ·  " +
    marks[g.wave] +
    (g.wave === "ARB" ? " " + g.arb : "");
  if (genReadout) {
    reading.textContent = genReadout;
    return;
  }
  if (genEntry !== null) {
    reading.textContent = genEntry || "0";
    bottom.textContent =
      genUnits()
        .map(([u], i) => ["↑", "↓", "→"][i] + " " + u)
        .join("   ") + (genShift ? "" : "   Shift: mV") + "   ← Cancella";
    return;
  }
  if (genAction?.type === "arb") {
    reading.textContent = genAction.name;
    bottom.textContent = "ARB LIST · ENTER";
    return;
  }
  if (genAction?.type === "state") {
    reading.textContent =
      (genAction.store ? "STORE " : "RECALL ") + genAction.slot;
    bottom.textContent = "STATE MEMORY · ENTER";
    return;
  }
  if (menuLevel >= 0) {
    const item = currentGenItem();
    reading.textContent =
      menuLevel === 0
        ? genGroups[menuGroup]
        : menuLevel === 1
          ? menuIndex + 1 + ": " + item.name
          : item.fn
            ? "ENTER"
            : item.step
              ? si(menuValue, item.unit)
              : String(menuValue);
    bottom.textContent =
      menuLevel === 0
        ? "MENU · ↓ comandi"
        : menuLevel === 1
          ? genGroups[menuGroup] + " · ↓ parametro"
          : item.name + " · ENTER";
    return;
  }
  showWithFlashingDigit(reading, genDisplay(genField, g[genField]));
}
// La cifra lampeggiante è quella che la manopola modifica (User's Guide,
// «Front-Panel Number Entry»): ← e → la spostano.
function showWithFlashingDigit(target, text) {
  const base = { freq: 1, modFreq: 1, fmFreq: 1, deviation: 1, amp: 0.01, offset: 0.01 }[genField];
  const v = Math.abs(g[genField]);
  let factor = null;
  if (base === 1) factor = v >= 1e6 ? 1e6 : v >= 1e3 ? 1e3 : v >= 1 ? 1 : 1e-3;
  else if (genField === "offset" || /pp$/i.test(genUnit)) factor = v >= 1 || v === 0 ? 1 : 1e-3;
  const place = factor && Math.round(Math.log10((base * 10 ** digit) / factor));
  const number = text.split(" ")[0];
  const whole = number.replace(/^[+-]/, "").split(".")[0].length;
  // Indice della cifra con quel peso, contando solo le cifre del numero.
  const target_ = place === null || !factor ? -1 : whole - 1 - place;
  let seen = -1,
    at = -1;
  for (let i = 0; i < number.length && at < 0; i++)
    if (/\d/.test(number[i]) && ++seen === target_) at = i;
  if (at < 0) {
    target.textContent = text;
    return;
  }
  const flash = document.createElement("span");
  flash.className = "flash";
  flash.textContent = text[at];
  target.replaceChildren(text.slice(0, at), flash, text.slice(at + 1));
}
// Formati del display a fluorescenza del 33120A (User's Guide, pp. 19–24):
// frequenza su 8 cifre con separatori «,» per le migliaia dopo il punto
// decimale (menu COMMA), ampiezza e offset su 4 cifre.
function genDisplay(field, v) {
  const group = g.settings.comma === "ON";
  const digits = (x, n) => {
    const whole = Math.max(1, Math.floor(Math.log10(Math.abs(x) || 1)) + 1);
    const text = Math.abs(x).toFixed(Math.max(0, n - whole));
    if (!group || !text.includes(".")) return text;
    const [a, b] = text.split(".");
    return a + "." + b.replace(/(\d{3})(?=\d)/g, "$1,");
  };
  const hz = (x) => {
    const [factor, unit] =
      x >= 1e6 ? [1e6, "MHz"] : x >= 1e3 ? [1e3, "KHz"] : x >= 1 ? [1, "Hz"] : [1e-3, "mHz"];
    return digits(x / factor, 8) + " " + unit;
  };
  const level = (x, suffix) =>
    Math.abs(x) >= 1
      ? digits(x, 4) + " V" + suffix
      : digits(x * 1000, 4) + " mV" + suffix;
  switch (field) {
    case "freq":
    case "modFreq":
    case "fmFreq":
    case "deviation":
      return hz(v);
    case "amp": {
      if (genUnit === "dBm") {
        const dbm = Number((10 * Math.log10((v * waveRms()) ** 2 / (50 * 0.001))).toFixed(2));
        return (dbm < 0 ? "-" : "+") + Math.abs(dbm).toFixed(2) + " dBm";
      }
      const rms = /rms/i.test(genUnit);
      return level(rms ? v * waveRms() : v, rms ? "RMS" : "PP");
    }
    case "offset": {
      const sign = v < 0 ? "-" : "+";
      if (v === 0 || Math.abs(v) >= 1) return sign + Math.abs(v).toFixed(3) + " VDC";
      const mv = Math.abs(v) * 1000;
      return sign + mv.toFixed(mv >= 100 ? 1 : 2).padStart(5, "0") + " mVDC";
    }
    default:
      return v + " %" + (field === "duty" ? " DUTY" : field === "depth" ? " DEPTH" : "");
  }
}
function setCalibrationLock() {
  if (calibrated) {
    calibrated = false;
    setGenMessage("SECURED");
    return;
  }
  const code = window.prompt("Codice di calibrazione virtuale · HP033120");
  if (code === null) return;
  if (code.trim().toUpperCase() !== "HP033120") {
    genQueue.push("CAL CODE INVALID");
    setGenMessage("CAL CODE INVALID");
    return;
  }
  calibrated = true;
  setGenMessage("UNSECURED");
}
function openArb(mode = "new") {
  const dlg = document.createElement("dialog"),
    form = document.createElement("form");
  form.method = "dialog";
  const title = document.createElement("h2");
  title.textContent = {
    new: "New Arb",
    points: "Points",
    line: "Line Edit",
    point: "Point Edit",
    save: "Save As",
    delete: "Delete Arb",
  }[mode];
  form.append(title);
  const field = (label, value, min, max) => {
    const l = document.createElement("label"),
      i = document.createElement("input");
    i.required = true;
    i.value = value;
    if (min !== undefined) {
      i.type = "number";
      i.min = min;
      i.max = max;
      i.step = "any";
    }
    l.append(label, i);
    form.append(l);
    return i;
  };
  const length = genArbDraft?.length ?? 8;
  let commit;
  if (mode === "new" || mode === "delete") {
    const select = document.createElement("select");
    const entries =
      mode === "new"
        ? ["NEW", ...Object.keys(Physics.factoryArbs), ...Object.keys(g.arbs)]
        : Object.keys(g.arbs);
    entries.forEach((n) => select.add(new Option(n, n)));
    form.append(select);
    commit = () => {
      const n = select.value;
      if (mode === "new")
        genArbDraft =
          n === "NEW"
            ? Array(8).fill(0)
            : [...(g.arbs[n] ?? Physics.factoryArbs[n])];
      else {
        delete g.arbs[n];
        if (g.arb === n) g.arb = "EXP RISE";
        save("arbs", g.arbs);
      }
    };
  }
  if (mode === "points") {
    const size = field("Numero di campioni", length, 8, 16000);
    commit = () => {
      const prev = genArbDraft;
      genArbDraft = Array.from(
        { length: Math.round(size.valueAsNumber) },
        (_, i) => prev[i] ?? 0,
      );
    };
  }
  if (mode === "line" || mode === "point") {
    const from = field("Punto iniziale", 1, 1, length),
      a = field("Valore iniziale", 0, -1, 1);
    const to =
      mode === "line" ? field("Punto finale", length, 1, length) : from;
    const b = mode === "line" ? field("Valore finale", 1, -1, 1) : a;
    commit = () => {
      const first = Math.floor(from.valueAsNumber) - 1,
        last = Math.floor(to.valueAsNumber) - 1;
      for (let i = Math.min(first, last); i <= Math.max(first, last); i++)
        genArbDraft[i] = mix(
          a.valueAsNumber,
          b.valueAsNumber,
          (i - first) / (last - first || 1),
        );
    };
  }
  if (mode === "save") {
    const name = field("Nome", "USER1");
    name.maxLength = 8;
    name.pattern = "[A-Za-z0-9_]+";
    commit = () => {
      const n = name.value.toUpperCase();
      if (
        Object.hasOwn(Physics.factoryArbs, n) ||
        (!Object.hasOwn(g.arbs, n) && Object.keys(g.arbs).length >= 4)
      ) {
        say("Nome riservato o memoria Arb piena");
        return;
      }
      g.arbs[n] = [...genArbDraft];
      g.arb = n;
      genArbDraft = null;
      chooseGenWave("ARB");
      save("arbs", g.arbs);
    };
  }
  const actions = document.createElement("div");
  actions.append(button("Annulla", () => dlg.close()));
  const ok = document.createElement("button");
  ok.className = "key slate";
  ok.textContent = "Enter";
  actions.append(ok);
  form.append(actions);
  dlg.append(form);
  document.body.append(dlg);
  form.addEventListener("submit", () => {
    commit();
    changed();
  });
  dlg.addEventListener("close", () => dlg.remove(), { once: true });
  dlg.showModal();
}
function setupGenerator() {
  $("g-power").onclick = () => genKey("power");
  for (const [key, label, alt, num] of [
    ["SINE", "Sine ∿", "AM", "1"],
    ["SQUARE", "Square ▔", "FM", "2"],
    ["TRIANGLE", "Triangle △", "FSK", "3"],
    ["RAMP", "Ramp ⋰", "Burst", "4"],
    ["NOISE", "Noise", "Sweep", "5"],
    ["ARB", "Arb", "Arb List", "±"],
    ["Enter", "Enter", "Menu On/Off"],
    ["Shift", "Shift", "Local"],
    ["Freq", "Freq", "AM/FM Freq", "6"],
    ["Ampl", "Ampl", "AM/FM Level", "7"],
    ["Offset", "Offset", "% Duty", "8"],
    ["Single", "Single", "Internal", "9"],
    ["Recall", "Recall", "Store", "0"],
    ["Enter Number", "Enter Number", "Cancel", "."],
  ])
    $("gen-keys").append(
      button(label, () => genKey(key, num), {
        id: "g-" + key.toLowerCase().replace(" ", "-"),
        alt,
        digit: num,
        title: alt ? key + " · Shift " + alt : key,
      }),
    );
  // Uscita DC: si tiene premuto Offset o un tasto di funzione della prima
  // fila per più di 2 s (User's Guide, p. 24). Non esiste un tasto DC.
  for (const id of ["g-sine", "g-square", "g-triangle", "g-ramp", "g-noise", "g-arb", "g-offset"]) {
    const key = $(id);
    let timer = null;
    const cancel = () => {
      clearTimeout(timer);
      timer = null;
    };
    key.title += " · tieni premuto 2 s per l’uscita DC";
    key.addEventListener("pointerdown", () => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        key.dataset.held = "1";
        if (!g.on) return;
        genShift = false;
        genEntry = null;
        genAction = null;
        menuLevel = -1;
        chooseGenWave("DC");
        changed();
      }, 2000);
    });
    for (const type of ["pointerup", "pointerleave", "pointercancel"])
      key.addEventListener(type, cancel);
    key.addEventListener(
      "click",
      (e) => {
        if (key.dataset.held) {
          delete key.dataset.held;
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  }
  const arrows = document.createElement("div");
  arrows.className = "arrowpad";
  for (const [key, label, title] of [
    ["up", "↑", "MHz / mVpp"],
    ["down", "↓", "kHz / mVrms"],
    ["left", "←", "Back Space / Recall Menu"],
    ["right", "→", "Hz / dBm"],
  ]) {
    arrows.append(
      button(label, () => genArrow(key), { id: "g-" + key, title }),
    );
  }
  $("gen-manual").append(
    dial("g-dial", "Regolazione", genRotate, true),
    arrows,
  );
}

const cursorLabels = {
  English: ["Cursor", "Source", "Horizontal", "Vertical"],
  Italiano: ["Cursore", "Sorgente", "Orizzontale", "Verticale"],
  繁體中文: ["游標", "訊號源", "水平", "垂直"],
  简体中文: ["光标", "信号源", "水平", "垂直"],
  Français: ["Curseur", "Source", "Horizontal", "Vertical"],
  Deutsch: ["Cursor", "Quelle", "Horizontal", "Vertikal"],
  한국어: ["커서", "소스", "수평", "수직"],
  Русский: ["Курсор", "Источник", "Горизонталь", "Вертикаль"],
  Suomi: ["Kohdistin", "Lähde", "Vaaka", "Pysty"],
  Español: ["Cursor", "Fuente", "Horizontal", "Vertical"],
  Polski: ["Kursor", "Źródło", "Poziomo", "Pionowo"],
};
const messages = {
  Acquire:
    "Sample acquisisce una misura per intervallo. Peak Detect conserva gli estremi. Average riduce il rumore ripetendo l’acquisizione.",
  Display: "Scegli vettori o punti, persistenza, contrasto e graticolo.",
  Cursor:
    "F1 sceglie la sorgente. F2 seleziona T1, T2 o entrambi. F3 seleziona V1, V2 o entrambi. Regola con VARIABLE.",
  Measure:
    "Ogni softkey seleziona una misura. Ripremi per scorrere o usa VARIABLE in entrambe le direzioni.",
  Utility:
    "Impostazioni di interfaccia, lingua, stampante, autocalibrazione e Go/No Go.",
  "Save/Recall":
    "Salva 15 configurazioni o due tracce di riferimento. Usa VARIABLE per regolare la voce selezionata.",
  Program:
    "Ogni passo richiama una configurazione salvata e apre un menu. F5 salva il programma in Edit e lo avvia in Play.",
  "Run/Stop":
    "Ferma o riavvia l’acquisizione. In Single riattiva l’attesa del prossimo trigger.",
  Trigger:
    "Seleziona Edge, Video, Pulse o Delay. Adatta il livello di trigger con LEVEL.",
  Horizontal:
    "Main, Window e Window Zoom controllano la scala temporale. XY mostra CH2 rispetto a CH1.",
  CH1: "Controlla accoppiamento, inversione, limite di banda e attenuazione di CH1.",
  CH2: "Controlla accoppiamento, inversione, limite di banda e attenuazione di CH2.",
  Math: "Somma, differenza o spettro FFT. La FFT visualizza il valore RMS per bin in dBV.",
  Erase: "Pulisce il display e le tracce accumulate.",
  Hardcopy: "Scarica una copia PNG del display.",
  "Auto Set":
    "Imposta scala verticale, scala orizzontale e trigger in base ai segnali presenti.",
  "Auto test/Stop": "Interrompe la riproduzione del programma.",
};
function scopeKey(name, action) {
  if (!s.on) return;
  if (help !== null) {
    help = name;
    render();
    return;
  }
  if (s.goActive && name !== "Utility") s.goActive = false;
  clearScreen = false;
  preferredRow = 0;
  s.menuOn = true;
  if (action) action();
  else s.menu = name;
  changed(
    ![
      "Display",
      "Cursor",
      "Measure",
      "Save/Recall",
      "Utility",
      "Program",
      "Erase",
      "Hardcopy",
    ].includes(name),
  );
}
function toggleChannel(i) {
  scopeKey("CH" + (i + 1), () => {
    const name = "CH" + (i + 1);
    if (s.menu === name || !s.channels[i].on)
      s.channels[i].on = !s.channels[i].on;
    s.menu = name;
    s.selected = name;
  });
}
function setHorizontal(mode) {
  s.horizontal = mode;
  if (mode === "Roll") s.time = Math.max(0.2, s.time);
  if (mode === "Window Zoom") s.zoom = Math.min(s.zoom, s.time / 2);
}
function scopeRows() {
  const row = (label, value, action, knob, acquire = true) => ({
    label,
    value,
    action,
    knob,
    acquire,
  });
  const select = (label, key, options, format = String, acquire = true) =>
    row(
      label,
      format(s[key]),
      () => {
        s[key] = next(options, s[key]);
      },
      (d) => {
        s[key] = next(options, s[key], d);
      },
      acquire,
    );
  const number = (
    label,
    key,
    min,
    max,
    step,
    format = String,
    acquire = true,
  ) =>
    row(
      label,
      format(s[key]),
      () => {},
      (d) => {
        s[key] = clamp(
          s[key] + d * (typeof step === "function" ? step() : step),
          min,
          max,
        );
      },
      acquire,
    );
  const toggle = (label, key, acquire = true) =>
    row(
      label,
      s[key] ? "On" : "Off",
      () => {
        s[key] = !s[key];
      },
      null,
      acquire,
    );
  const info = (label, value) => row(label, value, null);
  const back = (menu) =>
    row(
      "Previous",
      "",
      () => {
        s.menu = menu;
        preferredRow = 0;
      },
      null,
      false,
    );
  const openMenu = (label, menu) =>
    row(
      label,
      "",
      () => {
        s.menu = menu;
        preferredRow = 0;
      },
      null,
      false,
    );
  const volts2 = (x) => si(x, "V"),
    time2 = (x) => si(x, "s");
  const languages = [
    "English",
    "繁體中文",
    "简体中文",
    "Français",
    "Deutsch",
    "Italiano",
    "한국어",
    "Русский",
    "Suomi",
    "Español",
    "Polski",
  ];
  switch (s.menu) {
    case "CH1":
    case "CH2": {
      const ch = s.channels[Number(s.menu.at(-1)) - 1];
      return [
        row("Coupling", ch.coupling, () => {
          ch.coupling = next(["DC", "AC", "GND"], ch.coupling);
        }),
        row("Invert", ch.invert ? "On" : "Off", () => {
          ch.invert = !ch.invert;
        }),
        row("BW Limit", ch.bw ? "20 MHz" : "Full", () => {
          ch.bw = !ch.bw;
        }),
        row("Probe", "×" + ch.probe, () => {
          ch.probe = next([1, 10, 100], ch.probe);
        }),
        info("Impedance", "1 MΩ"),
      ];
    }
    case "Acquire":
      return [
        ["Sample", "Sample"],
        ["Peak Detect", "Peak"],
        ["Average", "Average"],
      ]
        .map(([label, key]) =>
          row(
            label,
            s.acq === key ? (key === "Average" ? "×" + s.avg : "●") : "",
            () => {
              // Già in Average, ogni pressione di F3 passa al numero di medie
              // successivo; VARIABLE lo regola nei due versi.
              if (key === "Average" && s.acq === "Average")
                s.avg = next([2, 4, 8, 16, 32, 64, 128, 256], s.avg);
              s.acq = key;
            },
            key === "Average"
              ? (d) => {
                  s.avg = scaleStep([2, 4, 8, 16, 32, 64, 128, 256], s.avg, d);
                }
              : null,
          ),
        )
        .concat([
          null,
          row(
            "Mem Leng",
            effectiveLength().toLocaleString("it-IT"),
            () => {
              const available = lengths.filter((n) => lengthAvailable(n, s.time));
              s.recordLength = next(available, effectiveLength());
            },
            (d) => {
              const available = lengths.filter((n) => lengthAvailable(n, s.time));
              s.recordLength = next(available, effectiveLength(), d);
            },
          ),
        ]);
    case "Display":
      return [
        select("Type", "draw", ["Vector", "Dot"], String, false),
        toggle("Accumulate", "persist", false),
        row(
          "Refresh",
          "",
          () => {
            overlay = [];
          },
          null,
          false,
        ),
        number("Contrast", "contrast", 0, 100, 2, (n) => n + "%", false),
        select("Graticule", "grid", ["Full", "Axes", "Frame"], String, false),
      ];
    case "Horizontal":
      return ["Main", "Window", "Window Zoom", "Roll", "XY"].map((name) =>
        row(name, s.horizontal === name ? "●" : "", () => setHorizontal(name)),
      );
    case "Trigger": {
      const type = select("Type", "trigType", [
        "Edge",
        "Video",
        "Pulse",
        "Delay",
      ]);
      const src = select(
        "Source",
        "trigSource",
        s.trigType === "Video" || s.trigType === "Delay"
          ? ["CH1", "CH2"]
          : ["CH1", "CH2", "EXT", "Line"],
      );
      const mode = select(
        "Mode",
        "trigMode",
        s.trigSource === "EXT"
          ? ["Auto", "Normal", "Single"]
          : ["Auto", "Auto Level", "Normal", "Single"],
      );
      const slope = select("Slope", "slope", ["Rising", "Falling"]);
      if (s.trigType === "Pulse")
        return [
          type,
          src,
          mode,
          row(
            "When " + s.pulseWhen,
            time2(s.pulseWidth),
            () => {
              s.pulseWhen = next(["<", ">", "=", "≠"], s.pulseWhen);
            },
            (d) => {
              s.pulseWidth = clamp(s.pulseWidth * 1.1 ** d, 20e-9, 10);
            },
          ),
          slope,
        ];
      if (s.trigType === "Video")
        return [
          type,
          src,
          select("Standard", "videoStandard", ["NTSC", "PAL", "SECAM"]),
          slope,
          row(
            s.videoField,
            s.videoField === "Line" ? "All" : s.videoLine,
            () => {
              s.videoField = next(["Line", "Field 1", "Field 2"], s.videoField);
              s.videoLine = 1;
            },
            (d) => {
              s.videoLine = clamp(
                s.videoLine + d,
                1,
                (s.videoStandard === "NTSC" ? 263 : 313) -
                  (s.videoField === "Field 2"),
              );
            },
          ),
        ];
      if (s.trigType === "Delay")
        return [
          type,
          row(
            "By Time",
            time2(s.delayTime),
            () => {
              s.delayType = "Time";
            },
            (d) => {
              s.delayType = "Time";
              s.delayTime = clamp(s.delayTime * 1.1 ** d, 1e-7, 1.3e-3);
            },
          ),
          row(
            "By Event",
            s.delayEvents,
            () => {
              s.delayType = "Event";
            },
            (d) => {
              s.delayType = "Event";
              s.delayEvents = clamp(s.delayEvents + d, 2, 65000);
            },
          ),
          row(
            "Start · " + s.delayLevel,
            s.delayLevel === "USER" ? volts2(s.startLevel) : "",
            () => {
              s.delayLevel = next(["USER", "TTL", "ECL"], s.delayLevel);
            },
            (d) => {
              s.startLevel = clamp(s.startLevel + d * 0.1, -12, 12);
            },
          ),
          row(
            "Main",
            s.trigSource + " · " + s.slope,
            () => {
              s.trigSource = next(["CH1", "CH2"], s.trigSource);
            },
            (d) => {
              if (d) s.slope = next(["Rising", "Falling"], s.slope);
            },
          ),
        ];
      return [type, src, mode, null, openMenu("Slope/Coupling", "Trig Detail")];
    }
    case "Trig Detail":
      return [
        select("Slope", "slope", ["Rising", "Falling"]),
        select("Coupling", "trigCoupling", ["DC", "AC"]),
        select("Rejection", "reject", ["Off", "LF", "HF"]),
        toggle("Noise Rej", "noiseReject"),
        back("Trigger"),
      ];
    case "Cursor": {
      const [, sourceLabel, horizontalLabel, verticalLabel] =
        cursorLabels[s.lang] ?? cursorLabels.English;
      if (s.cursorSource === 2 && !fftActive()) s.cursorSource = 0;
      const onMath = s.cursorSource === 2;
      const c = s.channels[Math.min(1, s.cursorSource)],
        factor = c.probe;
      const fft = onMath ? fftData() : null;
      const hzPerDiv = fft?.hzPerDiv ?? NaN;
      // Cursori a passi di un punto del display: 1/25 di divisione.
      const modeRow = (time) => {
        const key = time ? "cursorTMode" : "cursorVMode",
          values = onMath
            ? time
              ? s.fftCursorF
              : s.fftCursorM
            : time
              ? s.cursorT
              : s.cursorV,
          prefix = time ? "T" : "V";
        return row(
          time ? horizontalLabel : verticalLabel,
          s[key],
          () => {
            s[key] = next([prefix + "1", prefix + "2", "Track", "Off"], s[key]);
          },
          (d) => {
            // Un punto del display per scatto: 1/25 di divisione.
            const step = 1 / DISPLAY_POINTS_PER_DIV;
            for (const i of [0, 1])
              if (s[key] === prefix + (i + 1) || s[key] === "Track")
                values[i] = Number((values[i] + d * step).toPrecision(12));
          },
          false,
        );
      };
      const sources = fftActive() ? [0, 1, 2] : [0, 1];
      const sourceRow = select(
        sourceLabel,
        "cursorSource",
        sources,
        (i) => (i === 2 ? "MATH" : "CH" + (i + 1)),
        false,
      );
      if (onMath) {
        const [f1, f2] = s.fftCursorF.map((v) => v * hzPerDiv);
        const [m1, m2] = s.fftCursorM.map((v) => (v - s.fftPos) * s.fftUnit);
        return [
          sourceRow,
          modeRow(true),
          modeRow(false),
          info(
            "f1 " + si(f1, "Hz") + " · f2 " + si(f2, "Hz"),
            "Δ " + si(Math.abs(f2 - f1), "Hz") + " · Div " + si(hzPerDiv, "Hz"),
          ),
          info(
            "M1 " + m1.toFixed(2) + " dB · M2 " + m2.toFixed(2) + " dB",
            "Δ " + Math.abs(m2 - m1).toFixed(2) + " dB",
          ),
        ];
      }
      // Letture riferite al centro del reticolo (manuale, p. 59).
      const [t1, t2] = s.cursorT.map((v) => v * visibleTime());
      const [v1, v2] = s.cursorV.map((v) => v * c.scale);
      const dt = t2 - t1,
        dv = v2 - v1;
      return [
        sourceRow,
        modeRow(true),
        modeRow(false),
        info(
          "T1 " + time2(t1) + " · T2 " + time2(t2),
          "Δ " + time2(Math.abs(dt)) + " · " + si(1 / Math.abs(dt), "Hz"),
        ),
        info(
          "V1 " +
            volts2(v1 * factor) +
            " · V2 " +
            volts2(v2 * factor),
          "Δ " + volts2(Math.abs(dv * factor)),
        ),
      ];
    }
    case "Measure":
      return s.metrics.map((metric, i) =>
        row(
          metric,
          metric === "—" ? "" : metricsLabel(i),
          () => {
            s.metrics[i] = next(measureNames, metric);
          },
          (d) => {
            s.metrics[i] = next(measureNames, metric, d);
          },
          false,
        ),
      );
    case "Math":
      if (s.operation === "FFT")
        return [
          select("Operation", "operation", ["CH1+CH2", "CH1−CH2", "FFT"], String, false),
          select("Source", "fftSource", [0, 1], (i) => "CH" + (i + 1), false),
          select(
            "Window",
            "fftWindow",
            ["Rectangular", "Blackman", "Hanning", "Flattop"],
            String,
            false,
          ),
          number(
            "Position",
            "fftPos",
            -4,
            4,
            0.04,
            (n) => (n * s.fftUnit).toFixed(1) + " dB",
            false,
          ),
          select("Unit/div", "fftUnit", [20, 10, 5, 2, 1], (n) => n + " dB", false),
        ];
      return [
        select("Operation", "operation", ["CH1+CH2", "CH1−CH2", "FFT"], String, false),
        number(
          "Position",
          "mathPos",
          -8,
          8,
          0.04,
          (n) => n.toFixed(2) + " div",
          false,
        ),
        info("Scale", si(mathScale(), "V") + "/div"),
        null,
        null,
      ];
    case "Save/Recall":
      return s.saveType === "Setup"
        ? [
            select("Type", "saveType", ["Setup", "Waveform"], String, false),
            row("Default Setup", "", factoryScope),
            select(
              "Memory",
              "slot",
              Array.from({ length: 15 }, (_, i) => i + 1),
              (i) => "M" + String(i).padStart(2, "0"),
              false,
            ),
            row("Save", "", saveSetup, null, false),
            row("Recall", "", () => recallSetup(s.slot)),
          ]
        : [
            select("Type", "saveType", ["Setup", "Waveform"], String, false),
            select(
              "Source",
              "refSource",
              ["CH1", "CH2", "MATH"],
              String,
              false,
            ),
            select("Trace", "refSlot", ["A", "B"], (n) => "Ref " + n, false),
            row("Save", "", saveTrace, null, false),
            row(
              "Trace",
              s.refs[s.refSlot] ? "On" : "Off",
              () => {
                if (refData[s.refSlot]) s.refs[s.refSlot] = !s.refs[s.refSlot];
                else say("Traccia di riferimento vuota");
              },
              (d) => {
                s.refY[s.refSlot] += d * 0.1;
              },
              false,
            ),
          ];
    case "Utility":
      return [
        openMenu("Printer Menu", "Printer"),
        openMenu("Interface Menu", "Interface"),
        select("Beep", "beep", ["Off", "Low", "High", "Mixed"], String, false),
        select("Language", "lang", languages, String, false),
        openMenu("More", "Utility More"),
      ];
    case "Utility More":
      return [
        row(
          "Self Cal",
          "Virtual",
          () => say("Autocalibrazione virtuale completata"),
          null,
          false,
        ),
        openMenu("System Inform", "System"),
        openMenu("Go-No Go", "Go-No Go"),
        select("No Go When", "goWhen", ["Violating", "Inside"], String, false),
        back("Utility"),
      ];
    case "Printer":
      return [
        select("Type", "printer", ["HP"], String, false),
        row("Hardcopy", "PNG", hardcopy, null, false),
        null,
        null,
        back("Utility"),
      ];
    case "Interface":
      return [
        select("Type", "iface", ["RS232", "USB", "GPIB"], String, false),
        s.iface === "GPIB"
          ? number("Addr", "addr", 1, 30, 1, String, false)
          : s.iface === "RS232"
            ? select(
                "Baud",
                "baud",
                [2400, 4800, 9600, 19200, 38400],
                String,
                false,
              )
            : null,
        s.iface === "RS232"
          ? select("Stop bit", "stopBits", [1, 2], String, false)
          : null,
        s.iface === "RS232"
          ? select("Parity", "parity", ["Odd", "Even", "None"], String, false)
          : null,
        back("Utility"),
      ];
    case "System":
      return [
        info("Model", "GDS-820C"),
        info("Firmware", "N/D · Virtual"),
        info("Bandwidth", "150 MHz"),
        info("Memory", "125 kpts"),
        back("Utility More"),
      ];
    case "Go-No Go":
      return [
        openMenu("Template Edit", "Template"),
        select("Source", "goSource", [0, 1], (i) => "CH" + (i + 1), false),
        select(
          "No Go",
          "goAction",
          ["Stop", "Continue", "Beep+Stop", "Beep+Continue"],
          String,
          false,
        ),
        row("Go-No Go", s.goActive ? "On" : "Off", switchGo, null, false),
        row(
          "Ratio",
          goCount.join(" / "),
          () => {
            goCount = [0, 0];
          },
          null,
          false,
        ),
      ];
    case "Template": {
      const type = select(
        "Template",
        "goTemplate",
        ["Max", "Min", "Auto"],
        String,
        false,
      );
      if (s.goTemplate === "Auto")
        return [
          type,
          select("Source", "goSource", [0, 1], (i) => "CH" + (i + 1), false),
          number(
            "Tolerance",
            "goTolerance",
            0.4,
            40,
            0.4,
            (n) => n.toFixed(1) + "%",
            false,
          ),
          row("Save & Create", "", () => createTemplate("Auto"), null, false),
          back("Go-No Go"),
        ];
      const ref = s.goTemplate === "Max" ? "A" : "B";
      return [
        type,
        info("Source", "Ref " + ref),
        number(
          "Position",
          "goPosition",
          -4,
          4,
          0.04,
          (n) => n.toFixed(2) + " div",
          false,
        ),
        row("Save", "", () => createTemplate(ref), null, false),
        back("Go-No Go"),
      ];
    }
    case "Program":
      return programRows(row, select, number);
    case "Auto Set":
      return [
        null,
        null,
        null,
        null,
        row("Undo Autoset", "", () => {
          if (undo) {
            const previous = undo;
            undo = null;
            s = previous;
          } else say("Nessun Autoset da annullare");
        }),
      ];
    default:
      return [];
  }
}

const setupKeys = Object.keys(scopeDefault()).filter(
  (k) =>
    ![
      "on",
      "running",
      "slot",
      "goActive",
      "programMode",
      "programStep",
      "programItem",
      "programCycles",
      "programFrom",
      "programTo",
      "programBound",
    ].includes(k),
);
let refData = storedRefs(),
  template = null;
function scopeSetup() {
  return copy(Object.fromEntries(setupKeys.map((k) => [k, s[k]])));
}
function saveSetup() {
  const setups = storedObject("setups");
  setups[s.slot] = scopeSetup();
  if (save("setups", setups)) say("Configurazione salvata in M" + s.slot);
}
function recallSetup(slot) {
  const setup = storedObject("setups")[slot];
  if (!setup) {
    say("Configurazione M" + slot + " vuota");
    return false;
  }
  const defaults = scopeDefault();
  const clean = sanitize(
    Object.fromEntries(setupKeys.map((k) => [k, defaults[k]])),
    setup,
  );
  if (!timeSteps.includes(clean.time)) clean.time = defaults.time;
  if (!lengths.includes(clean.recordLength)) clean.recordLength = defaults.recordLength;
  for (const c of clean.channels) if (!voltSteps.includes(c.scale)) c.scale = 0.2;
  Object.assign(s, clean, { slot });
  return true;
}
function factoryScope() {
  const previous = s;
  s = {
    ...scopeDefault(),
    running: previous.running,
    menu: "Save/Recall",
    time: 0.001,
    acq: "Sample",
    cursorTMode: "Off",
    cursorVMode: "Off",
    channels: [
      { ...channel(), scale: 2 },
      { ...channel(), scale: 2, on: false },
    ],
  };
}
function saveTrace() {
  if (!capture) {
    say("Nessuna acquisizione");
    return;
  }
  const source = s.refSource;
  const view = viewSlice();
  let values =
    source === "MATH"
      ? mathValues(view)
      : view.values[Number(source.at(-1)) - 1];
  if (!values?.length) {
    say("Sorgente non disponibile");
    return;
  }
  const stride = Math.ceil(values.length / 2500);
  const points = Array.from(values.filter((_, i) => i % stride === 0));
  refData[s.refSlot] = {
    points,
    dt: view.dt * stride,
    start: view.start,
    scale:
      source === "MATH"
        ? mathScale()
        : s.channels[Number(source.at(-1)) - 1].scale,
  };
  if (save("refs", refData)) say("Traccia salvata in Ref " + s.refSlot);
}
function createTemplate(source) {
  if (source === "Auto") {
    const view = viewSlice();
    const v = view.values[s.goSource];
    const stride = Math.max(1, Math.ceil(v.length / 2500));
    const points = Array.from(v.filter((_, i) => i % stride === 0));
    if (points.length < 2) {
      say("Acquisisci un segnale per creare il template");
      return;
    }
    const scale = s.channels[s.goSource].scale;
    const radius = (scale * s.goTolerance) / 10;
    const record = { dt: view.dt * stride, start: view.start, scale };
    refData.A = { ...record, points: points.map((x) => x + radius) };
    refData.B = { ...record, points: points.map((x) => x - radius) };
    template = { A: refData.A.points, B: refData.B.points };
  } else if (refData[source]) {
    const ref = refData[source];
    refData[source] = {
      ...ref,
      points: ref.points.map((x) => x + s.goPosition * ref.scale),
    };
    template = { ...template, [source]: refData[source].points };
    s.goPosition = 0;
  } else {
    say("Registra prima la traccia di riferimento");
    return;
  }
  if (save("refs", refData)) say("Template aggiornato");
}
function switchGo() {
  if (!s.goActive && !(template?.A && template?.B)) {
    say("Crea un template Auto o due riferimenti");
    return;
  }
  s.goActive = !s.goActive;
}
function ratioTest() {
  if (!s.goActive || !template) return;
  const values = viewSlice().values[s.goSource];
  if (!values.length) return;
  const sampleAt = (list, i) =>
    list[Math.round((i * (list.length - 1)) / Math.max(1, values.length - 1))];
  const bad = values.some((v, i) => {
    return v < sampleAt(template.B, i) || v > sampleAt(template.A, i);
  });
  goCount[1]++;
  if (s.goWhen === "Inside" ? bad : !bad) return;
  goCount[0]++;
  if (s.goAction.includes("Stop")) s.goActive = false;
  if (s.goAction.includes("Beep")) playBeep();
}

const programMenus = ["Measure", "Cursor"];
// Passi del programma salvati: solo quelli con memoria, menu e tempo validi.
function storedProgram() {
  const raw = stored("program", {});
  return Object.fromEntries(
    Object.entries(raw && typeof raw === "object" ? raw : {}).filter(
      ([n, step]) =>
        Number(n) >= 1 &&
        Number(n) <= 15 &&
        Number.isInteger(step?.Memory) &&
        step.Memory >= 1 &&
        step.Memory <= 15 &&
        programMenus.includes(step.Menu) &&
        Number.isFinite(step.Time) &&
        step.Time >= 0 &&
        step.Time <= 99,
    ),
  );
}
let program = storedProgram(),
  audio;
function programListing() {
  const selected =
    s.programMode === "Edit" ? s.programStep : s["program" + s.programBound];
  const from = Math.min(10, Math.max(1, selected - 2));
  const lines = Array.from({ length: 6 }, (_, i) => {
    const n = from + i,
      step = program[n];
    const indicator =
      s.programMode === "Edit"
        ? n === s.programStep
          ? "›"
          : " "
        : n >= s.programFrom && n <= s.programTo
          ? "›"
          : " ";
    const columns = step
      ? [
          "M" + String(step.Memory).padStart(2, "0"),
          step.Menu.padEnd(9),
          step.Time ? step.Time + " s" : "Run/Stop",
        ]
      : ["—", "—".padEnd(9), "—"];
    return indicator + String(n).padStart(2, "0") + "   " + columns.join("   ");
  });
  return [
    "Program Setup",
    "",
    "Step Mem   Menu        StayTime",
    ...lines,
  ].join("\n");
}
function playBeep() {
  try {
    audio ??= new AudioContext();
    const tone = audio.createOscillator(),
      gain = audio.createGain();
    tone.frequency.value = s.beep === "Low" ? 480 : 1020;
    if (s.beep === "Mixed")
      tone.frequency.setValueAtTime(480, audio.currentTime + 0.04);
    gain.gain.value = 0.06;
    tone.connect(gain).connect(audio.destination);
    tone.start();
    tone.stop(audio.currentTime + 0.08);
  } catch {
    /* Audio is optional for local feedback. */
  }
}
function programRows(row, select, number) {
  const switchMode = select(
    "Mode",
    "programMode",
    ["Edit", "Play"],
    String,
    false,
  );
  if (s.programMode === "Edit") {
    const step = (program[s.programStep] ??= {
      Memory: 1,
      Menu: "Measure",
      Time: 3,
    });
    return [
      switchMode,
      number("Step", "programStep", 1, 15, 1, String, false),
      row(
        "Item " + s.programItem,
        step[s.programItem],
        () => {
          s.programItem = next(["Memory", "Menu", "Time"], s.programItem);
        },
        (d) => {
          const key = s.programItem;
          if (key === "Menu") step.Menu = next(programMenus, step.Menu, d);
          else
            step[key] = clamp(
              step[key] + d,
              key === "Time" ? 0 : 1,
              key === "Time" ? 99 : 15,
            );
        },
        false,
      ),
      null,
      row(
        "Save",
        "",
        () => {
          if (save("program", program))
            say("Programma salvato. Time 0 attende Run/Stop.");
        },
        null,
        false,
      ),
    ];
  }
  return [
    switchMode,
    number("Cycle", "programCycles", 1, 99, 1, String, false),
    row(
      "From → To",
      s.programFrom + " → " + s.programTo,
      () => {
        s.programBound = next(["From", "To"], s.programBound);
      },
      (d) => {
        const key = "program" + s.programBound;
        s[key] = clamp(s[key] + d, 1, 15);
      },
      false,
    ),
    null,
    row("Start", "", startProgram, null, false),
  ];
}
function startProgram() {
  const steps = Array.from(
    { length: Math.max(0, s.programTo - s.programFrom + 1) },
    (_, i) => program[s.programFrom + i],
  );
  const setups = storedObject("setups");
  if (!steps.length || steps.some((step) => !step || !setups[step.Memory])) {
    say("Definisci ogni passo e salva la configurazione associata");
    return;
  }
  runningProgram = {
    steps,
    index: 0,
    remaining: steps.length * s.programCycles,
    timer: null,
    waiting: false,
  };
  programStep();
}
function programStep() {
  if (!runningProgram) return;
  if (!runningProgram.remaining) {
    stopProgram();
    say("Riproduzione completata");
    return;
  }
  const current =
    runningProgram.steps[runningProgram.index++ % runningProgram.steps.length];
  runningProgram.remaining--;
  recallSetup(current.Memory);
  s.menu = current.Menu;
  s.running = true;
  runningProgram.waiting = current.Time === 0;
  if (current.Time > 0)
    runningProgram.timer = setTimeout(programStep, current.Time * 1000);
  changed();
}
function stopProgram() {
  if (runningProgram) clearTimeout(runningProgram.timer);
  runningProgram = null;
}
function autoset() {
  const a = Physics.transfer(lab, g.freq);
  const linked = lab.channels.map((ch) =>
    ch.node === "in" ? 0 : ch.node === "out" ? 1 : null,
  );
  if (
    !g.on ||
    g.freq < 30 ||
    lab.circuit === "open" ||
    linked.every((i) => i === null) ||
    g.wave === "DC"
  ) {
    say("Autoset richiede un segnale di almeno 30 Hz");
    return;
  }
  const min = 0.03;
  const amps = linked.map((i) =>
    i === null ? 0 : Math.hypot(...a[i]) * g.amp * (g.term === "50 Ω" ? 2 : 1),
  );
  if (Math.max(...amps) < min) {
    say("Autoset richiede almeno 30 mVpp");
    return;
  }
  undo = copy(s);
  for (const [i, c] of s.channels.entries()) {
    c.on = amps[i] >= min;
    const required = amps[i] / (5 * lab.channels[i].probe);
    if (c.on)
      c.scale = voltSteps.find((x) => x >= required) ?? voltSteps.at(-1);
    c.coupling = "DC";
    c.pos = 0;
    c.bw = false;
  }
  s.time = scaleStep(timeSteps, 0.35 / g.freq, 0);
  Object.assign(s, {
    running: true,
    acq: "Sample",
    draw: "Vector",
    horizontal: "Main",
    pos: 0,
    trigType: "Edge",
    slope: "Rising",
    trigMode: "Auto",
    trigCoupling: "DC",
    reject: "Off",
    trigSource: amps[0] >= amps[1] ? "CH1" : "CH2",
  });
  const ch = s.trigSource === "CH1" ? 0 : 1;
  s.level =
    (g.offset *
      Physics.transfer(lab, 0)[linked[ch]][0] *
      (g.term === "50 Ω" ? 2 : 1)) /
    lab.channels[ch].probe;
  s.menu = "Auto Set";
}
function horizontalScale(d) {
  const choices =
    s.horizontal === "Roll"
      ? timeSteps.filter((t) => t >= 0.2)
      : s.horizontal === "Window" || s.horizontal === "Window Zoom"
        ? timeSteps.filter((t) => t <= s.time / 2)
        : timeSteps;
  if (s.horizontal === "Window" || s.horizontal === "Window Zoom")
    s.zoom = scaleStep(choices, s.zoom, -d);
  else if (!s.running && capture && !capture.roll) {
    // Il fattore si conta dalla riga «500 punti» della tabella 5-2 con la
    // stessa frequenza di campionamento (manuale, p. 21, figura 5-11).
    const base = capture.equivalent ? capture.time : 25 / capture.fs;
    const i = timeSteps.indexOf(scaleStep(timeSteps, base, 0));
    const fastest = timeSteps[Math.max(0, i - 7)];
    s.time = scaleStep(choices.filter((t) => t >= fastest), s.time, -d);
  } else s.time = scaleStep(choices, s.time, -d);
}
// Le manopole di posizione e di livello si muovono di un punto del display
// (1/25 di divisione) e restano sulla griglia dei punti, così lo zero si
// raggiunge esattamente (la posizione di 60 µs a 500 µs/div della foto sono
// 3 punti da 20 µs).
const onDotGrid = (value, step) => {
  const v = Math.round(value / step) * step;
  return Math.abs(v) < step * 1e-6 ? 0 : Number(v.toPrecision(12));
};
function channelOffset(channel, delta) {
  const limit = channel.scale <= 0.05 ? 0.5 : channel.scale <= 0.5 ? 5 : 50;
  const step = channel.scale / DISPLAY_POINTS_PER_DIV;
  channel.pos = clamp(onDotGrid(channel.pos + delta * step, step), -limit, limit);
}
function runScope() {
  if (runningProgram?.waiting) {
    programStep();
    return;
  }
  s.running = !s.running;
  if (s.running) {
    lastTrigger = -Infinity;
    pending = null;
    nextArm = 0;
    averageState = null;
  }
}
function softKey(i) {
  if (!s.on || help !== null || !s.menuOn) return;
  const r = scopeRows()[i];
  if (!r?.action) return;
  const type = s.trigType;
  r.action();
  if (s.trigType === "Video" && type !== "Video") s.slope = "Falling";
  preferredRow = i;
  if (
    (s.trigType === "Video" || s.trigType === "Delay") &&
    !["CH1", "CH2"].includes(s.trigSource)
  )
    s.trigSource = "CH1";
  if (s.trigMode === "Auto Level" && s.trigSource === "EXT")
    s.trigMode = "Auto";
  if (s.beep !== "Off") playBeep();
  changed(r.acquire);
}
function scopeVariable(d) {
  if (!s.on) return;
  if (help !== null) {
    $("help-pane").scrollTop += d * 20;
    return;
  }
  // Nel menu Math la manopola VARIABLE sposta sempre la traccia (manuale, p. 22).
  const r =
    s.menu === "Math" && s.math
      ? scopeRows()[s.operation === "FFT" ? 3 : 1]
      : scopeRows()[preferredRow];
  if (r?.knob) {
    r.knob(d);
    changed(r.acquire);
  }
}
function setupScope() {
  const controls = $("scope-controls");
  const key = (label, action, options = {}) =>
    button(label, () => scopeKey(options.name ?? label, action), options);
  $("s-power").onclick = () => {
    s.on = !s.on;
    if (!s.on) {
      stopProgram();
      capture = null;
      pending = null;
      averageState = null;
      etState = null;
      overlay = [];
      s.goActive = false;
      help = null;
    } else s.running = true;
    changed();
  };
  const menus = [
    "Acquire",
    "Display",
    "Utility",
    "Program",
    "Cursor",
    "Measure",
    "Save/Recall",
    "Auto test/Stop",
  ];
  for (const name of menus)
    controls.append(
      key(
        name,
        name === "Auto test/Stop"
          ? () => {
              stopProgram();
              s.menu = "Program";
            }
          : null,
        { id: "s-" + name.toLowerCase().replace(/[^a-z]+/g, "-") },
      ),
    );
  const group = (label, cls, ...controls) => {
    const box = document.createElement("section"),
      title = document.createElement("h3");
    box.className = "control-group " + cls;
    title.textContent = label;
    box.append(title, ...controls);
    return box;
  };
  const turn = (id, label, fn, large = false, acquire = true) =>
    dial(
      id,
      label,
      (d) => {
        if (s.on) {
          fn(d);
          changed(acquire);
        }
      },
      large,
    );
  controls.append(
    group(
      "Acquisizione",
      "full",
      dial("variable", "Variable", scopeVariable),
      key("Auto Set", autoset, { id: "s-autoset", className: "slate" }),
      key("Run/Stop", runScope, { id: "s-run" }),
      key(
        "Erase",
        () => {
          clearScreen = true;
          overlay = [];
          averageState = null;
          etState = null;
        },
        { id: "s-erase" },
      ),
    ),
  );
  controls.append(
    group(
      "Display",
      "",
      key("Hardcopy", hardcopy, { id: "s-hardcopy" }),
      button(
        "Help",
        () => {
          if (s.on) {
            help = help === null ? s.menu : null;
            render();
          }
        },
        { id: "s-help" },
      ),
    ),
  );
  controls.append(
    group(
      "Trigger",
      "",
      key(
        "Menu",
        () => {
          s.menu = "Trigger";
        },
        { id: "s-trigger", name: "Trigger", className: "slate" },
      ),
      turn("level", "Level", (d) => {
        const step = s.channels[s.trigSource === "CH2" ? 1 : 0].scale / DISPLAY_POINTS_PER_DIV;
        s.level = clamp(onDotGrid(s.level + d * step, step), -50, 50);
      }),
    ),
  );
  for (const i of [0, 1]) {
    const label = "CH" + (i + 1);
    controls.append(
      group(
        label,
        "section-ch" + (i + 1),
        button(label, () => toggleChannel(i), {
          id: "s-" + label.toLowerCase(),
          className: label.toLowerCase(),
        }),
        turn(
          "position-" + i,
          "Position",
          (d) => {
            channelOffset(s.channels[i], d);
            positionReadout = { channel: i, until: performance.now() + 3000 };
          },
          false,
          false,
        ),
        turn(
          "scale-" + i,
          "Volts/div",
          (d) => {
            if (s.selected === "MATH" && fftActive())
              s.fftUnit = scaleStep([1, 2, 5, 10, 20], s.fftUnit, -d);
            else s.channels[i].scale = scaleStep(voltSteps, s.channels[i].scale, -d);
          },
          true,
        ),
      ),
    );
  }
  controls.append(
    group(
      "Orizzontale e matematica",
      "full",
      key(
        "Hori Menu",
        () => {
          s.menu = "Horizontal";
        },
        { id: "s-horizontal", name: "Horizontal" },
      ),
      turn(
        "h-position",
        "Position",
        (d) => {
          const step = visibleTime() / DISPLAY_POINTS_PER_DIV;
          s.pos = clamp(onDotGrid(s.pos + d * step, step), -s.time * 20, s.time * 1000);
        },
        false,
        false,
      ),
      turn("time-div", "Time/div", horizontalScale, true),
      key(
        "Math",
        () => {
          s.math = s.menu === "Math" ? !s.math : true;
          s.menu = "Math";
          s.selected = s.math ? "MATH" : "CH1";
        },
        { id: "s-math" },
      ),
    ),
  );
  for (let i = 0; i < 5; i++)
    $("scope-soft").append(
      button("F" + (i + 1), () => softKey(i), { id: "f" + (i + 1) }),
    );
  $("scope-soft").append(
    button(
      "Menu",
      () => {
        if (s.on) {
          s.menuOn = !s.menuOn;
          changed(false);
        }
      },
      { id: "menu-toggle", title: "Menu On/Off" },
    ),
  );
}

let triggerStatus = "AUTO",
  lastTrigger = -Infinity;
// Stato del motore di acquisizione.
let pending = null,
  nextArm = 0,
  averageState = null,
  etState = null,
  rollState = null,
  analogCache = null;
const ADC_CODES_PER_DIV = 25,
  ADC_MIN = -128,
  ADC_MAX = 127,
  REALTIME_MAX = 100e6,
  DISPLAY_POINTS_PER_DIV = 25,
  PROCESSED_POINTS = 500;
const divisions = () => (s.menuOn ? 10 : 12);
const visibleTime = () => (s.horizontal === "Window Zoom" ? s.zoom : s.time);
const videoStandards = Physics.videoStandards;
const calibrationAt = Physics.calibrationAt;
const mainsAt = (t) => Math.sin(2 * Math.PI * 50 * t);
const fraction = (t) => t - Math.floor(t);
function syncAt(t) {
  if (!g.on || ["DC", "NOISE"].includes(g.wave)) return 0;
  const { settings, freq } = g;
  let high;
  switch (g.mode) {
    case "AM":
      high = fraction(t * g.modFreq * 2) < Math.max(4e-7 * g.modFreq, 0.01);
      break;
    case "FM":
      high = fraction(t * g.fmFreq * 2) < Math.max(4e-7 * g.fmFreq, 0.01);
      break;
    case "FSK":
      high =
        settings.fskSource === "INT"
          ? Math.abs(fraction((t * settings.fskRate) / 2) - 0.5) <
            Math.max(1e-7 * settings.fskRate, 0.01)
          : externalAt(t) > 0 && externalAt(t - 2e-7) <= 0;
      break;
    case "BURST": {
      if (settings.burstSource === "EXT") {
        high =
          Physics.source(
            { ...g, amp: 1, offset: 0, term: "HIGH Z" },
            t,
            externalAt,
          ) > 0;
        break;
      }
      const elapsed = g.singleMode
        ? t - g.firedAt
        : fraction(t * settings.burstRate) / settings.burstRate;
      high = elapsed < 0 || elapsed * freq >= settings.burstCount;
      break;
    }
    case "SWEEP":
      high = g.singleMode
        ? t < g.firedAt || t >= g.firedAt + settings.sweepTime
        : fraction(t / settings.sweepTime) > 0.995;
      break;
    default:
      high =
        g.wave === "ARB"
          ? fraction(t * freq) < Math.max(2e-7 * freq, 0.01)
          : Physics.shape(g.wave, t * freq, g.duty) > 0;
  }
  return high ? 3.3 : 0;
}
const externalAt = (t) =>
  lab.mod === "cal"
    ? calibrationAt(t) - 1
    : lab.mod === "line"
      ? mainsAt(t)
      : 0;
Object.defineProperty(externalAt, "periodHz", {
  get: () => (lab.mod === "cal" ? 1000 : lab.mod === "line" ? 50 : 0),
});

// Tabella 5-2 del manuale: la memoria copre circa 20 divisioni. La frequenza
// di campionamento è il valore 1-2,5-5 non superiore a L/(20·Time/div), con
// un massimo di 100 MSa/s in tempo reale. Sotto 250 ns/div, con 500 punti,
// lo strumento passa al campionamento in tempo equivalente (fino a 25 GSa/s).
function seriesFloor(x) {
  const e = Math.floor(Math.log10(x));
  let best = 0;
  for (const k of [e - 1, e])
    for (const m of [1, 2.5, 5]) {
      const v = Number((m * 10 ** k).toPrecision(3));
      if (v <= x * (1 + 1e-9)) best = v;
    }
  return best;
}
const lengthAvailable = (length, time) =>
  length === 500 || length / (20 * time) <= 125e6 * (1 + 1e-9);
function effectiveLength(time = s.time) {
  return [...lengths]
    .reverse()
    .find((length) => length <= s.recordLength && lengthAvailable(length, time));
}
function acquisitionPlan(time = s.time) {
  const length = effectiveLength(time);
  const required = length / (20 * time);
  if (required > 125e6 * (1 + 1e-9))
    return { length, fs: 25 / time, et: true, time };
  return {
    length,
    fs: Math.min(REALTIME_MAX, seriesFloor(required)),
    et: false,
    time,
  };
}

// Rumore dello stadio d'ingresso (stima, non dichiarata dal costruttore):
// 0,2 mV più 0,02 divisioni efficaci, riferiti al BNC.
let seed = 0x2545f491;
function uniform() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
function gaussian() {
  return (
    Math.sqrt(-2 * Math.log(uniform() + 1e-12)) * Math.cos(2 * Math.PI * uniform())
  );
}
const noiseSigma = (channel) => 0.2e-3 + 0.02 * channel.scale;

// Convertitore A/D a 8 bit: 25 livelli per divisione (manuale di
// programmazione, template da −100 a +100 su 8 divisioni), codici da −128 a
// +127 attorno al centro dello schermo. Oltre ±5,12 div il segnale satura.
function adc(volts, channel) {
  const lsb = channel.scale / ADC_CODES_PER_DIV;
  const code = clamp(Math.round((volts + channel.pos) / lsb), ADC_MIN, ADC_MAX);
  return code * lsb - channel.pos;
}

function channelSpecs() {
  const spec = (i) => ({
    node: lab.channels[i].node,
    ac: s.channels[i].coupling === "AC",
    bw: s.channels[i].bw ? 20e6 : 150e6,
  });
  return [
    spec(0),
    spec(1),
    {
      node: ["in", "out", "cal"].includes(lab.ext) ? lab.ext : "none",
      ac: false,
      bw: 150e6,
    },
  ];
}
const periodicSource = () => !g.on || (g.mode === "CONT" && g.wave !== "NOISE");
// Tensioni ai BNC (dopo accoppiamento e banda), memorizzate se periodiche.
function analogWindow(t0, t1) {
  if (periodicSource()) {
    if (analogCache?.revision !== changeRevision)
      analogCache = {
        revision: changeRevision,
        fn: Physics.analog(g, lab, channelSpecs(), 0, 1, externalAt),
      };
    return analogCache.fn;
  }
  return Physics.analog(g, lab, channelSpecs(), t0, t1, externalAt);
}
// Segnale visto dal canale dopo la sonda fisica e l'inversione.
function channelVolts(values, j) {
  const c = s.channels[j];
  if (c.coupling === "GND") return 0;
  return (values[j] / lab.channels[j].probe) * (c.invert ? -1 : 1);
}
function externalVolts(values, t) {
  if (lab.ext === "sync") return syncAt(t);
  if (lab.ext === "cal" || lab.ext === "in" || lab.ext === "out") return values[2];
  return 0;
}
function triggerSourceAt(fe, t) {
  if (s.trigSource === "Line") return mainsAt(t);
  const values = fe(t);
  if (s.trigSource === "EXT") return externalVolts(values, t);
  return channelVolts(values, s.trigSource === "CH2" ? 1 : 0);
}
function filterTrigger(values, dt) {
  if (s.trigCoupling !== "AC" && s.reject === "Off") return values;
  const q = Math.exp(-dt * 2 * Math.PI * (s.reject === "Off" ? 10 : 50000));
  let low = 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.map((v) => {
    const y = v - (s.trigCoupling === "AC" ? mean : 0);
    low = mix(y, low, q);
    return s.reject === "HF" ? low : s.reject === "LF" ? y - low : y;
  });
}
function signalPeriod() {
  if (s.trigSource === "Line") return 0.02;
  const node =
    s.trigSource === "EXT"
      ? lab.ext
      : lab.channels[s.trigSource === "CH2" ? 1 : 0].node;
  if (node === "cal") return 0.001;
  if (node === "sync" || node === "in" || node === "out")
    return 1 / (g.wave === "NOISE" ? 1e5 : g.freq);
  return 1 / g.freq;
}
// Il circuito di trigger è analogico: confronta il segnale continuo con il
// livello e marca l'istante dell'evento, indipendentemente dai campioni.
// Cerca il primo evento valido nell'intervallo [from, to].
function findTrigger(fe, from, to, period) {
  if (s.trigType === "Video") {
    const i = s.trigSource === "CH2" ? 1 : 0,
      node = lab.channels[i].node;
    if (
      node !== s.videoStandard.toLowerCase() ||
      s.channels[i].coupling === "GND" ||
      s.channels[i].invert !== (s.slope === "Rising")
    )
      return { time: null, hz: NaN };
    const { lines, fields } = videoStandards[node],
      line = 2 / (lines * fields),
      frame = 2 / fields;
    const first = s.videoField === "Field 2" ? Math.ceil(lines / 2) : 0;
    const fieldLines =
      s.videoField === "Field 2" ? Math.floor(lines / 2) : Math.ceil(lines / 2);
    const offset = (first + Math.min(fieldLines, s.videoLine) - 1) * line;
    const at =
      s.videoField === "Line"
        ? Math.ceil(from / line) * line
        : Math.ceil((from - offset) / frame) * frame + offset;
    return { time: at <= to ? at : null, hz: NaN };
  }
  const duration = Math.max(to - from, 1e-12);
  const n = clamp(Math.ceil((duration / period) * 90), 720, 20000);
  const dt = duration / n;
  const times = Array.from({ length: n + 1 }, (_, i) => from + i * dt);
  const values = filterTrigger(
    times.map((t) => triggerSourceAt(fe, t)),
    dt,
  );
  const [min, max] = rangeOf(values);
  const sourceIndex = s.trigSource === "CH2" ? 1 : 0;
  const sensitivity =
    (s.trigSource === "EXT"
      ? 0.05
      : s.trigSource === "Line"
        ? 0.1
        : Math.max(0.005, s.channels[sourceIndex].scale * 0.5)) *
    (s.noiseReject ? 2 : 1);
  if (max - min < sensitivity) return { time: null, hz: NaN };
  if (
    (s.trigMode === "Auto Level" ||
      (s.trigSource === "EXT" &&
        ["sync", "cal"].includes(lab.ext) &&
        s.level === 0)) &&
    (s.level <= min || s.level >= max)
  )
    s.level = (min + max) / 2;
  const r = s.slope === "Rising";
  const edges = Physics.crossings(values, s.level, r, dt, from);
  let candidates = edges;
  if (s.trigType === "Pulse") {
    const exit = Physics.crossings(values, s.level, !r, dt, from);
    const compare = (v) =>
      s.pulseWhen === "<"
        ? v < s.pulseWidth
        : s.pulseWhen === ">"
          ? v > s.pulseWidth
          : s.pulseWhen === "="
            ? Math.abs(v - s.pulseWidth) <= dt
            : Math.abs(v - s.pulseWidth) > dt;
    candidates = exit.filter((t) => {
      const entry = edges.findLast((e) => e < t);
      return entry !== undefined && compare(t - entry);
    });
  }
  if (s.trigType === "Delay") {
    const level =
      s.delayLevel === "TTL" ? 1.4 : s.delayLevel === "ECL" ? -1.3 : s.startLevel;
    const ext = Physics.crossings(
      times.map((t) => externalVolts(fe(t), t)),
      level,
      true,
      dt,
      from,
    );
    candidates = ext
      .map((t) => {
        const i = edges.findIndex(
          (e) => e >= t + (s.delayType === "Time" ? s.delayTime : 0),
        );
        return i < 0
          ? undefined
          : edges[i + (s.delayType === "Event" ? s.delayEvents - 1 : 0)];
      })
      .filter(Number.isFinite);
  }
  // L'istante del passaggio si affina sul segnale continuo: i punti della
  // ricerca bastano a trovare il fronte, ma a 1 Hz distano decine di µs.
  const refine = (time, rising) =>
    refineCrossing((t) => triggerSourceAt(fe, t), time, from, dt, values, rising);
  const interval =
    edges.length > 1 ? refine(edges[1], r) - refine(edges[0], r) : NaN;
  const time = candidates[0];
  return {
    time:
      time === undefined
        ? null
        : refine(time, s.trigType === "Pulse" ? !r : r),
    hz: Number.isFinite(interval) && interval > 0 ? 1 / interval : NaN,
  };
}
// Bisezione fra i due punti di ricerca che racchiudono il passaggio per il
// livello. Lo scarto fra segnale filtrato (accoppiamento AC, reiezioni) e
// segnale continuo si prende lineare sul passo.
function refineCrossing(signal, time, from, dt, values, rising) {
  const i = clamp(Math.floor((time - from) / dt), 0, values.length - 2);
  const start = from + i * dt;
  const shiftA = values[i] - signal(start),
    shiftB = values[i + 1] - signal(start + dt);
  const above = (t) =>
    signal(t) + mix(shiftA, shiftB, (t - start) / dt) >= s.level;
  if (above(start) === rising || above(start + dt) !== rising) return time;
  let a = start,
    b = start + dt;
  for (let k = 0; k < 48 && b - a > 1e-12; k++) {
    const m = (a + b) / 2;
    if (above(m) === rising) b = m;
    else a = m;
  }
  return (a + b) / 2;
}

const isRoll = () =>
  s.horizontal === "Roll" ||
  (s.trigMode !== "Normal" &&
    s.trigMode !== "Single" &&
    s.time >= 0.25 &&
    s.horizontal !== "XY");
// Tempo morto fra due acquisizioni: elaborazione e trasferimento al display.
const deadTime = (length) => 0.01 + length * 0.4e-6;
// Acquisizioni al secondo dello strumento in Average (stima, non dichiarata):
// ogni acquisizione richiede il record intero più circa 5 ms di elaborazione.
const averageRate = (duration) => 1 / (duration + 0.005);

// Arma una nuova acquisizione: la memoria circolare deve prima riempire la
// parte di pre-trigger, poi si attende l'evento e la parte di post-trigger.
function armAcquisition(t) {
  const plan = acquisitionPlan();
  const duration = plan.et ? 20 * s.time : plan.length / plan.fs;
  const recordStart = s.pos - duration / 2;
  const pre = Math.max(0, -recordStart),
    post = Math.max(0, recordStart + duration);
  pending = {
    plan,
    duration,
    recordStart,
    pre,
    post,
    armedAt: t,
    from: t + pre,
    revision: changeRevision,
    trigger: null,
    hz: NaN,
  };
}
function serviceAcquisition(t) {
  if (!pending) {
    if (t < nextArm) return false;
    armAcquisition(t);
  }
  const p = pending;
  if (p.trigger === null) {
    const period = signalPeriod();
    if (t - p.from > 1) p.from = t - 1;
    // Finestra di ricerca: abbastanza periodi per trovare un fronte, ma con
    // un passo fine rispetto al periodo (90 punti per periodo).
    const searchSpan = Math.min(Math.max(40 * period, 1e-6), 0.02);
    // Il segnale futuro non è ancora arrivato: si cerca solo fino a «adesso».
    if (p.from > t + searchSpan) return false;
    const to = Math.max(p.from, t) + searchSpan;
    const fe = analogWindow(p.from - p.duration, to + p.duration);
    const found = findTrigger(fe, p.from, to, period);
    if (found.time !== null) {
      p.trigger = found.time;
      p.hz = found.hz;
      p.triggered = true;
    } else {
      p.from = to;
      const auto = s.trigMode === "Auto" || s.trigMode === "Auto Level";
      const timeout = Math.max(0.15, p.duration);
      if (auto && t - p.armedAt - p.pre > timeout) {
        p.trigger = t - p.post;
        p.triggered = false;
      } else {
        // In Normal e Single lo stato diventa «Trig?» finché manca l'evento;
        // in Auto resta l'ultimo stato fino al trigger forzato.
        if (!auto) triggerStatus = "Trig?";
        return false;
      }
    }
  }
  if (t < p.trigger + p.post) return false;
  completeAcquisition(p);
  pending = null;
  nextArm = t + deadTime(p.plan.length);
  return true;
}

// Costruisce il record: L campioni a 1/fs su un clock libero, con lo
// sfasamento fra clock e trigger misurato e corretto dallo strumento.
function completeAcquisition(p) {
  const { plan } = p;
  const dt = 1 / plan.fs;
  const absoluteStart = p.trigger + p.recordStart;
  const fe = analogWindow(absoluteStart - p.duration, absoluteStart + 2 * p.duration);
  const averaging = s.acq === "Average";
  const peak = s.acq === "Peak" && s.time >= 500e-9 && !plan.et;
  let values, extrema, start, length;
  if (plan.et) {
    ({ values, start, length } = equivalentTime(p, fe));
  } else {
    length = plan.length;
    const phase = averaging ? 0 : uniform();
    start = p.recordStart + phase * dt;
    values = [new Float64Array(length), new Float64Array(length)];
    extrema = peak
      ? values.map(() => [new Float64Array(length), new Float64Array(length)])
      : null;
    const hiRes = averaging && length > 500;
    // In Average un aggiornamento del display vale più acquisizioni dello
    // strumento: ognuna ha il suo rumore, quindi si mediano più conversioni.
    const batch =
      averaging && !hiRes && averageState?.key === averageKey()
        ? clamp(Math.round((now() - averageState.last) * averageRate(p.duration)), 1, 16)
        : 1;
    const adcPerSample = Math.max(1, dt * REALTIME_MAX);
    // Peak Detect e Average con memoria lunga usano più conversioni per
    // intervallo, entro un budget di calcolo per acquisizione.
    const budget = Math.max(2, Math.floor(4e5 / length));
    const sub = peak || hiRes ? Math.min(budget, Math.ceil(adcPerSample)) : 1;
    for (let i = 0; i < length; i++) {
      const t = p.trigger + start + i * dt;
      const pair = fe(t);
      for (let j = 0; j < 2; j++) {
        const c = s.channels[j];
        const sigma = noiseSigma(c);
        if (hiRes) {
          // Media su più conversioni nello stesso intervallo: risoluzione
          // migliore e rumore ridotto (manuale, p. 42).
          let sum = 0;
          for (let k = 0; k < sub; k++)
            sum += channelVolts(fe(t + (k * dt) / sub), j);
          values[j][i] =
            sum / sub + (sigma * gaussian()) / Math.sqrt(adcPerSample);
          continue;
        }
        const volts = channelVolts(pair, j);
        const first = adc(volts + sigma * gaussian(), c);
        let mean = first;
        for (let k = 1; k < batch; k++) mean += adc(volts + sigma * gaussian(), c);
        values[j][i] = mean / batch;
        if (peak) {
          let lo = first,
            hi = first;
          for (let k = 1; k < sub; k++) {
            const v = adc(channelVolts(fe(t + (k * dt) / sub), j) + sigma * gaussian(), c);
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
          }
          extrema[j][0][i] = lo;
          extrema[j][1][i] = hi;
        }
      }
    }
  }
  if (averaging && !plan.et && plan.length === 500) values = average(values, p, now());
  const triggered = p.triggered;
  triggerStatus = triggered ? "Trig’d" : "AUTO";
  if (triggered) lastTrigger = p.trigger;
  capture = {
    values,
    extrema,
    dt: plan.et ? (20 * s.time) / PROCESSED_POINTS : dt,
    start,
    length,
    hz: p.hz,
    fs: plan.fs,
    equivalent: plan.et,
    time: s.time,
    duration: p.duration,
    physical: lab.channels.map((c) => c.node),
    revision: p.revision,
  };
  if (s.trigMode === "Single" && triggered) s.running = false;
  clearScreen = false;
  ratioTest();
}
// Media di N acquisizioni allineate al trigger (solo con memoria di 500 punti).
// È una media mobile: dopo le prime N acquisizioni ognuna pesa 1/N, quindi più
// N è grande più la traccia impiega ad assestarsi. La media riparte solo se
// cambiano le impostazioni dell'oscilloscopio, non se cambia il segnale.
// Fra due aggiornamenti del display si contano le acquisizioni che lo
// strumento avrebbe fatto, secondo averageRate.
function averageKey() {
  return JSON.stringify([
    s.acq,
    s.avg,
    s.time,
    s.pos,
    s.recordLength,
    s.horizontal,
    s.channels.map((c) => [c.scale, c.pos, c.coupling, c.invert, c.bw]),
    [s.trigType, s.trigSource, s.trigMode, s.slope, s.level, s.trigCoupling, s.reject],
  ]);
}
function average(values, p, t) {
  const key = averageKey();
  if (averageState?.key !== key) {
    averageState = { key, count: 1, last: t, values: values.map((v) => Float64Array.from(v)) };
    return values;
  }
  const state = averageState;
  const n = Math.max(1, (t - state.last) * averageRate(p.duration));
  state.last = t;
  state.count += n;
  const weight =
    state.count <= s.avg ? n / state.count : 1 - (1 - 1 / s.avg) ** n;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < values[j].length; i++)
      state.values[j][i] += (values[j][i] - state.values[j][i]) * weight;
  return state.values.map((v) => Float64Array.from(v));
}
// Tempo equivalente asincrono: a ogni trigger il clock a 100 MSa/s ha uno
// sfasamento casuale; i campioni vanno nelle celle del record da 500 punti
// secondo il loro ritardo dal trigger. Il segnale deve essere ripetitivo.
function equivalentTime(p, fe) {
  const bins = PROCESSED_POINTS,
    dtEq = p.duration / bins;
  const key = p.revision + "|" + s.time + "|" + s.pos;
  if (etState?.key !== key)
    etState = {
      key,
      values: [new Float64Array(bins).fill(NaN), new Float64Array(bins).fill(NaN)],
    };
  const step = 1 / REALTIME_MAX;
  const passes = 24;
  for (let pass = 0; pass < passes; pass++) {
    const phase = uniform() * step;
    for (let t = p.recordStart + phase; t < p.recordStart + p.duration; t += step) {
      const bin = Math.floor((t - p.recordStart) / dtEq);
      if (bin < 0 || bin >= bins) continue;
      const values = fe(p.trigger + t);
      for (let j = 0; j < 2; j++)
        etState.values[j][bin] = adc(
          channelVolts(values, j) + noiseSigma(s.channels[j]) * gaussian(),
          s.channels[j],
        );
    }
  }
  return {
    values: etState.values.map((v) => Float64Array.from(v)),
    start: p.recordStart + dtEq / 2,
    length: bins,
  };
}
// Roll: le nuove acquisizioni entrano da destra senza attendere il trigger.
function rollAcquisition(t) {
  const plan = acquisitionPlan();
  const dt = 1 / plan.fs,
    span = divisions() * s.time;
  if (rollState?.revision !== changeRevision) rollState = { revision: changeRevision, since: t };
  const k0 = Math.ceil((t - span) / dt),
    k1 = Math.floor(t / dt);
  const length = Math.max(0, k1 - k0 + 1);
  const fe = analogWindow(t - 2 * span, t + span);
  const values = [new Float64Array(length), new Float64Array(length)];
  for (let i = 0; i < length; i++) {
    const time = (k0 + i) * dt;
    const pair = time < rollState.since ? null : fe(time);
    for (let j = 0; j < 2; j++)
      values[j][i] = pair
        ? adc(channelVolts(pair, j) + noiseSigma(s.channels[j]) * gaussian(), s.channels[j])
        : NaN;
  }
  triggerStatus = s.horizontal === "Roll" ? "ROLL" : "AUTO";
  capture = {
    values,
    extrema: null,
    dt,
    start: s.pos - span / 2 + (k0 * dt - (t - span)),
    length,
    hz: NaN,
    fs: plan.fs,
    equivalent: false,
    time: s.time,
    duration: length * dt,
    physical: lab.channels.map((c) => c.node),
    revision: changeRevision,
    roll: true,
  };
}

// I 500 punti elaborati: il record intero ricondotto a 500 punti
// (manuale, p. 13). Misure automatiche e FFT lavorano su questi.
function processedPoints(values) {
  if (!capture) return new Float64Array();
  if (values.length <= PROCESSED_POINTS) return values;
  const step = values.length / PROCESSED_POINTS;
  return Float64Array.from({ length: PROCESSED_POINTS }, (_, i) => {
    const x = i * step,
      k = Math.floor(x);
    return mix(values[k], values[Math.min(k + 1, values.length - 1)], x - k);
  });
}
const processedDt = () =>
  capture ? (capture.length * capture.dt) / Math.min(capture.length, PROCESSED_POINTS) : 0;

// Punti disegnati: 25 per divisione (250 col menu, 300 senza), presi dal
// record. Con l'acquisizione ferma si può esplorare la memoria.
function viewSlice() {
  const empty = [new Float64Array(), new Float64Array()];
  if (!capture)
    return { values: empty, times: new Float64Array(), dt: 0, start: 0, end: 0 };
  const cols = divisions(),
    span = cols * visibleTime(),
    left = s.pos - span / 2,
    right = left + span;
  const first = clamp(Math.ceil((left - capture.start) / capture.dt - 1e-9), 0, capture.length);
  const last = clamp(
    Math.floor((right - capture.start) / capture.dt + 1e-9),
    first - 1,
    capture.length - 1,
  );
  const count = last - first + 1;
  const points = cols * DISPLAY_POINTS_PER_DIV;
  const index =
    count <= points + 1
      ? Array.from({ length: Math.max(0, count) }, (_, i) => first + i)
      : Array.from({ length: points + 1 }, (_, j) => first + Math.round((j * (count - 1)) / points));
  const times = Float64Array.from(index, (i) => capture.start + i * capture.dt);
  const group = (k) => [
    k ? Math.floor((index[k - 1] + index[k]) / 2) + 1 : index[0],
    k < index.length - 1 ? Math.floor((index[k] + index[k + 1]) / 2) : index.at(-1),
  ];
  const extrema = capture.extrema?.map(([lo, hi]) => {
    const a = new Float64Array(index.length),
      b = new Float64Array(index.length);
    index.forEach((_, k) => {
      const [from, to] = group(k);
      let min = Infinity,
        max = -Infinity;
      for (let i = from; i <= to; i++) {
        min = Math.min(min, lo[i]);
        max = Math.max(max, hi[i]);
      }
      a[k] = min;
      b[k] = max;
    });
    return [a, b];
  });
  return {
    values: capture.values.map((v) => Float64Array.from(index, (i) => v[i])),
    extrema,
    times,
    dt: times.length > 1 ? times[1] - times[0] : capture.dt,
    start: times[0] ?? 0,
    end: times.at(-1) ?? 0,
  };
}
function mathScale() {
  return Math.max(...s.channels.map((c) => c.scale * c.probe));
}
function mathValues(view) {
  if (s.operation === "FFT") return null;
  const [a, b] = view.values;
  const sign = s.operation === "CH1+CH2" ? 1 : -1;
  return a.map(
    (v, i) => v * s.channels[0].probe + sign * b[i] * s.channels[1].probe,
  );
}
const fftActive = () => s.math && s.operation === "FFT";
// FFT sui 500 punti elaborati: 250 righe da 0 a fs/2, 25 righe per divisione.
function fftData() {
  if (!capture) return null;
  const c = s.channels[s.fftSource];
  const data = processedPoints(capture.values[s.fftSource]).map((v) => v * c.probe);
  const fs = 1 / processedDt();
  return { bins: Physics.spectrum(data, s.fftWindow), hzPerDiv: fs / 20, fs };
}
let metricCache = {};
function metricsLabel(i) {
  const key = s.metrics[i];
  return s.channels
    .map((c, ch) => {
      if (!c.on || !capture || capture.physical[ch] === "none") return "—";
      const n = metricCache[ch]?.[key];
      if (key === "Duty") return Number.isFinite(n) ? n.toFixed(1) + "%" : "—";
      return key === "Freq"
        ? si(n, "Hz")
        : ["Period", "Risetime", "Falltime", "+Width", "−Width"].includes(key)
          ? si(n, "s")
          : si(n * c.probe, "V");
    })
    .join(" / ");
}
function updateMetrics() {
  if (!capture) {
    metricCache = {};
    return;
  }
  const dt = processedDt();
  const start = capture.start;
  const measureT =
    s.cursorSource !== 2 && s.cursorTMode !== "Off" && s.cursorT[0] !== s.cursorT[1];
  metricCache = capture.values.map((all, j) => {
    let v = processedPoints(all);
    if (measureT) {
      const [from, to] = [Math.min(...s.cursorT), Math.max(...s.cursorT)].map(
        (div) => div * visibleTime() + s.pos,
      );
      const a = clamp(Math.ceil((from - start) / dt), 0, v.length);
      const b = clamp(Math.ceil((to - start) / dt), a, v.length);
      v = v.subarray(a, b);
    }
    const finite = v.filter(Number.isFinite);
    const result = Physics.measures(finite, dt);
    if (capture.extrema && !measureT) {
      const [lo, hi] = capture.extrema[j];
      result.Vmax = rangeOf(hi)[1];
      result.Vmin = rangeOf(lo)[0];
      result.Vpp = result.Vmax - result.Vmin;
    }
    return result;
  });
}

const canvas = $("trace"),
  ctx = canvas.getContext("2d");
let display = {};
function traceCanvas() {
  const box = canvas.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const dpi = Math.min(2, devicePixelRatio || 1),
    w = box.width,
    h = box.height;
  const bw = Math.round(w * dpi),
    bh = Math.round(h * dpi);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
    overlay = [];
  }
  ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
  ctx.fillStyle =
    "rgb(" +
    Math.round(11 + s.contrast * 0.08) +
    "," +
    Math.round(22 + s.contrast * 0.12) +
    "," +
    Math.round(29 + s.contrast * 0.13) +
    ")";
  ctx.fillRect(0, 0, w, h);
  const x = 12,
    y = 9,
    gw = w - 25,
    gh = h - 24,
    cols = divisions(),
    span = cols * visibleTime(),
    left = s.pos - span / 2;
  if (gw <= 0 || gh <= 0) return;
  const tx = (t) => x + ((t - left) / span) * gw;
  const vy = (v, scale, pos = 0) => y + gh * (0.5 - (v + pos) / (8 * scale));
  display = { x, y, gw, gh, tx, vy, span, left };
  ctx.strokeStyle = "#476068";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, gw, gh);
  if (s.grid !== "Frame") {
    ctx.beginPath();
    ctx.setLineDash([1, 4]);
    for (let i = 1; i < cols; i++)
      if (s.grid === "Full" || i === cols / 2) {
        const xx = x + (gw * i) / cols;
        ctx.moveTo(xx, y);
        ctx.lineTo(xx, y + gh);
      }
    for (let i = 1; i < 8; i++)
      if (s.grid === "Full" || i === 4) {
        const yy = y + (gh * i) / 8;
        ctx.moveTo(x, yy);
        ctx.lineTo(x + gw, yy);
      }
    ctx.stroke();
    ctx.setLineDash([]);
    // Assi centrali X e Y con le tacche ogni 1/5 di divisione, come sul
    // reticolo dello strumento: riferimento per lo zero e le letture a occhio.
    const cx = Math.round(x + gw / 2) + 0.5,
      cy = Math.round(y + gh / 2) + 0.5;
    ctx.strokeStyle = "#6c8b91";
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + gw, cy);
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y + gh);
    for (let k = 1; k < cols * 5; k++) {
      const xx = Math.round(x + (gw * k) / (cols * 5)) + 0.5,
        len = k % 5 ? 2.5 : 4.5;
      ctx.moveTo(xx, cy - len);
      ctx.lineTo(xx, cy + len);
    }
    for (let k = 1; k < 40; k++) {
      const yy = Math.round(y + (gh * k) / 40) + 0.5,
        len = k % 5 ? 2.5 : 4.5;
      ctx.moveTo(cx - len, yy);
      ctx.lineTo(cx + len, yy);
    }
    ctx.stroke();
  }
  ctx.font = "9px monospace";
  if (s.horizontal === "Window") {
    ctx.strokeStyle = "#d2e494";
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      tx(s.pos - (s.zoom * cols) / 2),
      y,
      ((s.zoom * cols) / span) * gw,
      gh,
    );
    ctx.setLineDash([]);
  }
  const view = viewSlice(),
    count = view.values[0].length;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, gw, gh);
  ctx.clip();
  function plot(values, color, time, volts, showDots = false) {
    if (!values?.length) return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) {
        open = false;
        continue;
      }
      const vx = time(i),
        v = volts(values[i]);
      if (showDots) ctx.fillRect(vx - 0.8, v - 0.8, 1.8, 1.8);
      else if (open) ctx.lineTo(vx, v);
      else ctx.moveTo(vx, v);
      open = true;
    }
    if (!showDots) ctx.stroke();
  }
  const fft = fftActive() ? fftData() : null;
  // Linea M dello spettro: 0 dB = 1 Vrms (manuale, p. 24).
  const fftY = (db) => y + gh * (0.5 - s.fftPos / 8) - (db / s.fftUnit) * (gh / 8);
  const fftX = (k) => x + (gw * k) / (DISPLAY_POINTS_PER_DIV * cols);
  if (capture && count && !clearScreen) {
    if (s.horizontal === "XY") {
      const a = s.channels[0],
        b = s.channels[1];
      plot(
        view.values[1],
        palette[1],
        (i) => x + gw * (0.5 + (view.values[0][i] + a.pos) / (cols * a.scale)),
        (v) => vy(v, b.scale, b.pos),
        s.draw === "Dot",
      );
    } else {
      const pointAt = (i) => tx(view.times[i]);
      if (s.persist) {
        ctx.globalAlpha = 0.17;
        for (const frame of overlay)
          frame.values.forEach((values, j) => {
            if (s.channels[j].on)
              plot(
                values,
                palette[j],
                (i) => tx(frame.times[i]),
                (v) => vy(v, s.channels[j].scale, s.channels[j].pos),
                s.draw === "Dot",
              );
          });
        ctx.globalAlpha = 1;
      }
      for (const [j, c] of s.channels.entries()) {
        if (!c.on) continue;
        if (view.extrema) {
          ctx.beginPath();
          ctx.strokeStyle = palette[j];
          ctx.lineWidth = 0.8;
          for (let i = 0; i < count; i++) {
            ctx.moveTo(pointAt(i), vy(view.extrema[j][0][i], c.scale, c.pos));
            ctx.lineTo(pointAt(i), vy(view.extrema[j][1][i], c.scale, c.pos));
          }
          ctx.stroke();
        }
        plot(
          view.values[j],
          palette[j],
          pointAt,
          (v) => vy(v, c.scale, c.pos),
          s.draw === "Dot",
        );
      }
      if (s.math)
        plot(
          mathValues(view),
          palette[2],
          pointAt,
          (v) => vy(v, mathScale(), s.mathPos * mathScale()),
          s.draw === "Dot",
        );
      for (const [j, key] of ["A", "B"].entries()) {
        const ref = refData[key];
        if (s.refs[key] && ref)
          plot(
            ref.points,
            palette[3 + j],
            (i) => tx(ref.start + i * ref.dt),
            (v) => vy(v, ref.scale, s.refY[key] * ref.scale),
          );
      }
      // Con la FFT attiva restano visibili anche le tracce dei canali accesi:
      // in laboratorio si spegneva CH1 per vedere meglio lo spettro.
      if (fft) {
        const bins = fft.bins.subarray(0, Math.min(fft.bins.length, DISPLAY_POINTS_PER_DIV * cols + 1));
        plot(
          Float64Array.from(bins, (v) => 20 * Math.log10(Math.max(v, 1e-9))),
          palette[2],
          fftX,
          (db) => clamp(fftY(db), y - 2, y + gh + 2),
          s.draw === "Dot",
        );
        ctx.fillStyle = palette[2];
        ctx.fillText("M", x + 2, clamp(fftY(0), y + 9, y + gh) - 2);
        ctx.fillText(
          "FFT CH" + (s.fftSource + 1) + " · " + si(fft.hzPerDiv, "Hz") + "/div · " + s.fftUnit + " dB/div · " + s.fftWindow,
          x + 14,
          y + 13,
        );
      }
    }
  }
  const cursorOnMath = fft && s.cursorSource === 2;
  // I cursori sono fissi sullo schermo, in divisioni dal centro, e restano
  // visibili con qualsiasi menu: si tolgono solo con Off nel menu Cursor.
  if (s.horizontal !== "XY") {
    ctx.lineWidth = 0.8;
    for (const [axis, values, active] of [
      ["T", cursorOnMath ? s.fftCursorF : s.cursorT, s.cursorTMode],
      ["V", cursorOnMath ? s.fftCursorM : s.cursorV, s.cursorVMode],
    ]) {
      if (active === "Off") continue;
      for (const [i, v] of values.entries()) {
        const q =
          axis === "T"
            ? cursorOnMath
              ? x + (gw * v) / cols
              : x + gw * (0.5 + v / cols)
            : y + gh * (0.5 - v / 8);
        ctx.strokeStyle = cursorOnMath && axis === "V" ? "#f08b80" : i ? "#b6b2a7" : "#f6e3ac";
        ctx.fillStyle = ctx.strokeStyle;
        ctx.setLineDash(i ? [4, 3] : []);
        ctx.beginPath();
        const name = cursorOnMath ? (axis === "T" ? "f" : "M") : axis;
        if (axis === "T") {
          ctx.moveTo(q, y);
          ctx.lineTo(q, y + gh);
          ctx.fillText(name + (i + 1), q + 3, y + 11);
        } else {
          ctx.moveTo(x, q);
          ctx.lineTo(x + gw, q);
          ctx.fillText(name + (i + 1), x + 3, q - 3);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  ctx.restore();
  if (s.horizontal !== "XY") {
    if (s.trigSource === "CH1" || s.trigSource === "CH2") {
      const c = s.channels[s.trigSource === "CH2" ? 1 : 0];
      const trigY = clamp(vy(s.level, c.scale, c.pos), y + 3, y + gh - 3);
      ctx.fillStyle = "#b5ed91";
      ctx.fillText("◀", x + gw + 2, trigY + 3);
    }
    ctx.fillStyle = "#b5ed91";
    ctx.fillText("T", clamp(tx(0), x, x + gw - 4) - 2, y + 7);
    // Indicatore dello zero di ogni canale sul bordo sinistro.
    [1, 0].forEach((j) => {
      const c = s.channels[j];
      if (!c.on) return;
      const zy = clamp(vy(0, c.scale, c.pos), y + 5, y + gh - 5);
      ctx.fillStyle = palette[j];
      ctx.beginPath();
      ctx.moveTo(0, zy - 5);
      ctx.lineTo(8, zy - 5);
      ctx.lineTo(12, zy);
      ctx.lineTo(8, zy + 5);
      ctx.lineTo(0, zy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#10202a";
      ctx.font = "bold 8px monospace";
      ctx.fillText(String(j + 1), 2, zy + 3);
      ctx.font = "9px monospace";
    });
    ctx.fillStyle = "#9cb8b5";
    const timeText = si(s.pos, "s") + "  ·  " + si(visibleTime(), "s") + "/div";
    ctx.fillText(timeText, x, h - 3);
    if (positionReadout) {
      const c = s.channels[positionReadout.channel];
      const v = c.pos * c.probe;
      ctx.fillStyle = palette[positionReadout.channel];
      ctx.fillText(
        "CH" + (positionReadout.channel + 1) + " Position " + (v > 0 ? "+" : "") + si(v, "V"),
        x + ctx.measureText(timeText).width + 18,
        h - 3,
      );
    }
  }
}

function renderScope() {
  $("s-power").classList.toggle("live", s.on);
  $("s-power").setAttribute("aria-pressed", s.on);
  $("lcd").classList.toggle("off", !s.on);
  $("lcd").classList.toggle("no-menu", !s.menuOn);
  $("run-state").textContent = s.running ? "RUN" : "STOP";
  $("trigger-state").textContent = s.running
    ? triggerStatus
    : capture
      ? "HOLD"
      : "STOP";
  const triggerHz = capture?.hz >= 20 ? capture.hz : NaN;
  // Barra della memoria: parte del record visibile a schermo.
  const bar = document.querySelector(".memory");
  if (capture?.duration && !capture.roll) {
    const span = divisions() * visibleTime();
    const from = (s.pos - span / 2 - capture.start) / capture.duration,
      to = (s.pos + span / 2 - capture.start) / capture.duration;
    bar.style.setProperty("--view-left", clamp(from, 0, 1) * 100 + "%");
    bar.style.setProperty("--view-right", (1 - clamp(to, 0, 1)) * 100 + "%");
  }
  $("lcd-status").replaceChildren(
    ...[
      ...s.channels.map(
        (c, j) =>
          "CH" +
          (j + 1) +
          " " +
          (c.on ? si(c.scale * c.probe, "V") + "/div " + c.coupling : "Off"),
      ),
      (() => {
        const plan = capture && !s.running ? capture : acquisitionPlan();
        return (plan.equivalent || plan.et ? "ET " : "") + si(plan.fs, "Sa/s");
      })(),
      s.horizontal,
      s.trigType + " " + s.trigSource + " " + s.trigMode,
      s.acq.toUpperCase(),
      s.iface,
      si(triggerHz, "Hz"),
    ].map((str) => {
      const span = document.createElement("span");
      span.textContent = str;
      return span;
    }),
  );
  for (const i of [0, 1]) {
    const b = $("s-ch" + (i + 1));
    b.classList.toggle("active", s.on && s.channels[i].on);
    b.setAttribute("aria-pressed", s.on && s.channels[i].on);
  }
  $("s-run").classList.toggle("active", s.on && s.running);
  $("s-run").classList.toggle("stopped", s.on && !s.running);
  $("s-math").classList.toggle("active", s.on && s.math);
  $("s-help").classList.toggle("active", help !== null);
  $("csv").disabled = !capture;
  const pane = $("help-pane");
  pane.hidden = help === null && s.menu !== "Program";
  pane.textContent =
    help === null
      ? s.menu === "Program"
        ? programListing()
        : ""
      : help +
        "\n\n" +
        (messages[help] ??
          "Premi un tasto del pannello per leggere la sua funzione.");
  const menu = $("screen-menu");
  menu.hidden = !s.menuOn;
  if (s.menuOn) {
    cachedRows = scopeRows();
    const signature = JSON.stringify([
      s.menu,
      s.lang,
      preferredRow,
      help,
      s.on,
      cachedRows.map((r) => r && [r.label, r.value, !!r.action]),
    ]);
    if (signature !== menuSignature) {
      menuSignature = signature;
      const oldFocus = document.activeElement?.dataset.softRow;
      const title = document.createElement("span");
      title.className = "screen-title";
      const label =
        s.menu === "Cursor"
          ? (cursorLabels[s.lang] ?? cursorLabels.English)[0]
          : s.menu;
      title.textContent = label.toUpperCase();
      menu.replaceChildren(title);
      for (let i = 0; i < 5; i++) {
        const r = cachedRows[i],
          b = document.createElement("button");
        b.type = "button";
        b.className = "softrow" + (preferredRow === i ? " selected" : "");
        b.dataset.softRow = String(i);
        b.disabled = !r?.action || !s.on || help !== null;
        if (r) {
          const val = document.createElement("b");
          val.textContent = r.value;
          b.append(r.label, val);
        }
        b.onclick = () => softKey(i);
        menu.append(b);
      }
      if (oldFocus !== undefined)
        menu
          .querySelector('[data-soft-row="' + oldFocus + '"]')
          ?.focus({ preventScroll: true });
    }
  }
  for (let i = 0; i < 5; i++) {
    $("f" + (i + 1)).disabled =
      !s.on || !s.menuOn || !cachedRows?.[i]?.action || help !== null;
    $("f" + (i + 1)).classList.toggle("selected", s.on && s.menuOn && preferredRow === i);
  }
  traceCanvas();
}
const nodeNames = {
  in: "IN · prima di R",
  out: "OUT · su C",
  none: "Scollegato",
  cal: "Cal · 2 V / 1 kHz",
  sync: "Sync generatore",
  line: "Sinusoide 50 Hz",
  ntsc: "Video NTSC virtuale",
  pal: "Video PAL virtuale",
  secam: "Video SECAM virtuale",
};
const cableEntries = [
  {
    id: "patch-ch1",
    label: "CH1",
    choices: ["in", "out", "cal", "ntsc", "pal", "secam", "none"],
    get: () => lab.channels[0].node,
    set: (v) => (lab.channels[0].node = v),
  },
  {
    id: "patch-ch2",
    label: "CH2",
    choices: ["in", "out", "cal", "ntsc", "pal", "secam", "none"],
    get: () => lab.channels[1].node,
    set: (v) => (lab.channels[1].node = v),
  },
  {
    id: "patch-probe1",
    label: "Sonda fisica CH1",
    choices: [1, 10, 100],
    get: () => lab.channels[0].probe,
    set: (v) => (lab.channels[0].probe = Number(v)),
  },
  {
    id: "patch-probe2",
    label: "Sonda fisica CH2",
    choices: [1, 10, 100],
    get: () => lab.channels[1].probe,
    set: (v) => (lab.channels[1].probe = Number(v)),
  },
  {
    id: "patch-ext",
    label: "EXT TRIG",
    choices: ["none", "sync", "in", "out", "cal"],
    get: () => lab.ext,
    set: (v) => (lab.ext = v),
  },
  {
    id: "patch-mod",
    label: "Mod / gate esterno",
    choices: ["none", "cal", "line"],
    get: () => lab.mod,
    set: (v) => (lab.mod = v),
  },
];
function schematic() {
  const c = $("schematic").getContext("2d"),
    w = c.canvas.width,
    h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#efe5cc";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#c8b68f";
  for (let x = 20; x < w; x += 20)
    for (let y = 20; y < h; y += 20) c.fillRect(x, y, 1.5, 1.5);
  c.lineWidth = 3;
  c.strokeStyle = "#3a2a1f";
  c.fillStyle = "#3a2a1f";
  c.font = "19px monospace";
  const line = (...points) => {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };
  const dot = (x, y) => {
    c.beginPath();
    c.arc(x, y, 5, 0, Math.PI * 2);
    c.fill();
  };
  const circuitY = 96,
    base = 229,
    input = 182,
    output = 466,
    sourceX = 64;
  c.beginPath();
  c.arc(sourceX, 158, 27, 0, Math.PI * 2);
  c.stroke();
  c.font = "24px monospace";
  c.fillText("∿", 56, 165);
  line(
    [sourceX, 131],
    [sourceX, circuitY],
    [lab.circuit === "open" ? 124 : input, circuitY],
  );
  line([sourceX, 185], [sourceX, base], [output, base]);
  c.font = "16px monospace";
  c.fillText("50 Ω", 40, 267);
  if (lab.circuit !== "open") {
    c.fillText("IN", input - 10, 71);
    c.fillText("OUT", output - 17, 71);
    dot(input, circuitY);
    dot(output, circuitY);
    if (lab.circuit === "rc") {
      line(
        [input, circuitY],
        [252, circuitY],
        [264, 85],
        [279, 107],
        [294, 85],
        [309, 107],
        [324, 85],
        [339, 107],
        [351, circuitY],
        [output, circuitY],
      );
      c.fillText("R", 296, 69);
      c.fillText("C", 489, 171);
      line([output, circuitY], [output, 151]);
      line([448, 151], [484, 151]);
      line([448, 165], [484, 165]);
      line([output, 165], [output, base]);
    } else line([input, circuitY], [output, circuitY]);
  } else {
    c.fillText("Aperto", 135, 101);
    c.beginPath();
    c.arc(124, circuitY, 4, 0, Math.PI * 2);
    c.stroke();
  }
  line([277, base], [277, 244]);
  line([259, 244], [295, 244]);
  line([266, 251], [288, 251]);
  line([272, 258], [282, 258]);
  if (lab.circuit !== "open")
    lab.channels.forEach((ch, i) => {
      if (!["in", "out"].includes(ch.node)) return;
      const x = ch.node === "in" ? input : output,
        side = i ? 1 : -1;
      c.strokeStyle = i ? "#187a8a" : "#986612";
      c.fillStyle = c.strokeStyle;
      const terminal = clamp(x + side * 28, 35, w - 40);
      line([x, circuitY], [x, 122 + i * 20], [terminal, 122 + i * 20]);
      dot(terminal, 122 + i * 20);
      c.font = "bold 17px monospace";
      c.textAlign = i ? "left" : "right";
      c.fillText("CH" + (i + 1), terminal + side * 9, 128 + i * 20);
      c.textAlign = "left";
    });
}
function renderLab() {
  for (const item of cableEntries) $(item.id).value = String(item.get());
  $("g-output").classList.toggle("connected", lab.circuit !== "open");
  $("g-sync").classList.toggle("connected", lab.ext === "sync");
  for (const [i, c] of lab.channels.entries())
    $("bnc-ch" + (i + 1)).classList.toggle("connected", c.node !== "none");
  $("bnc-ext").classList.toggle("connected", lab.ext !== "none");
  $("bnc-cal").classList.toggle(
    "connected",
    lab.channels.some((c) => c.node === "cal") ||
      lab.ext === "cal" ||
      lab.mod === "cal",
  );
  $("resistance").disabled = $("capacitance").disabled = lab.circuit !== "rc";
  schematic();
  const { gain, phase, cutoff } = Physics.response(lab, g.freq);
  const enabled =
    lab.circuit !== "open" && g.on && g.wave !== "DC" && g.wave !== "NOISE";
  const db = gain > 0 ? 20 * Math.log10(gain) : NaN;
  const phaseDeg = (phase * 180) / Math.PI;
  const values = [
    ["Frequenza", enabled ? si(g.freq, "Hz") : "—"],
    ["Taglio a −3 dB", si(cutoff, "Hz")],
    [
      "Guadagno OUT/IN",
      enabled && Number.isFinite(db)
        ? gain.toFixed(3) + " · " + db.toFixed(2) + " dB"
        : "—",
    ],
    ["Fase OUT − IN", enabled ? phaseDeg.toFixed(2) + "°" : "—"],
    [
      "Ritardo di fase",
      enabled ? si(-phase / (2 * Math.PI * g.freq), "s") : "—",
    ],
  ];
  $("response").replaceChildren(
    ...values.map(([name, value]) => {
      const div = document.createElement("div"),
        dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = name;
      dd.textContent = value;
      div.append(dt, dd);
      return div;
    }),
  );
}
function setupLab() {
  const patch = $("patch");
  for (const item of cableEntries) {
    const label = document.createElement("label"),
      select = document.createElement("select");
    select.id = item.id;
    item.choices.forEach((v) =>
      select.add(new Option(nodeNames[v] ?? "×" + v, String(v))),
    );
    label.append(item.label, select);
    patch.append(label);
    select.onchange = () => {
      item.set(select.value);
      changed();
    };
  }
  // Cavi coassiali RG-58 (circa 101 pF/m): caricano l'uscita a 50 Ω del
  // generatore e limitano banda e tempo di salita misurati.
  const cableLabel = document.createElement("label"),
    cableInput = document.createElement("input");
  cableInput.id = "cable";
  cableInput.type = "number";
  cableInput.min = "0";
  cableInput.max = "5";
  cableInput.step = "0.1";
  cableInput.value = lab.cable;
  cableLabel.append("Cavi coassiali (m)", cableInput);
  patch.append(cableLabel);
  const edgeLabel = document.createElement("label"),
    edgeInput = document.createElement("input");
  edgeInput.id = "gen-edge";
  edgeInput.type = "number";
  edgeInput.min = "1";
  edgeInput.max = "40";
  edgeInput.step = "1";
  edgeInput.value = lab.genEdge * 1e9;
  edgeLabel.append("Fronti quadra (ns)", edgeInput);
  patch.append(edgeLabel);
  edgeInput.addEventListener("input", () => {
    if (edgeInput.validity.valid && Number.isFinite(edgeInput.valueAsNumber)) {
      lab.genEdge = edgeInput.valueAsNumber * 1e-9;
      changed();
    } else if (edgeInput.value !== "")
      say("Fronti dell'onda quadra fra 1 e 40 ns (il 33120A dichiara meno di 20 ns)");
  });
  cableInput.addEventListener("input", () => {
    if (cableInput.validity.valid && Number.isFinite(cableInput.valueAsNumber)) {
      lab.cable = cableInput.valueAsNumber;
      changed();
    } else if (cableInput.value !== "")
      say("Lunghezza dei cavi fra 0 e 5 m");
  });
  const jack = (id, label, target) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "jack";
    b.id = id;
    b.title = "Configura " + label;
    b.append(document.createElement("i"), label);
    b.onclick = () => $(target).focus();
    return b;
  };
  $("g-jacks").append(
    jack("g-sync", "SYNC", "patch-ext"),
    jack("g-output", "OUTPUT", "circuit"),
  );
  $("scope-jacks").append(
    jack("bnc-cal", "CAL 2 V", "patch-ch1"),
    jack("bnc-ch1", "CH1", "patch-ch1"),
    jack("bnc-ch2", "CH2", "patch-ch2"),
    jack("bnc-ext", "EXT TRIG", "patch-ext"),
  );
  $("circuit").onchange = (e) => {
    lab.circuit = e.target.value;
    changed();
  };
  for (const [id, key, factor] of [
    ["resistance", "r", 1],
    ["capacitance", "c", 1e-9],
  ]) {
    $(id).addEventListener("input", (e) => {
      if (
        e.target.validity.valid &&
        Number.isFinite(e.target.valueAsNumber) &&
        e.target.valueAsNumber > 0
      ) {
        lab[key] = e.target.valueAsNumber * factor;
        changed();
      }
    });
    $(id).addEventListener("blur", (e) => {
      e.target.value = Number((lab[key] / factor).toPrecision(12));
    });
  }
  $("lab-preset").onclick = () => {
    experiencePreset();
    say("Assetto delle esperienze: generatore su CH1, strumenti alle impostazioni di fabbrica");
  };
  $("reset-lab").onclick = () => {
    photoPreset();
    say("Assetto foto ripristinato");
  };
}
// Assetto della foto: circuito RC, 870 Hz, 1 Vpp, cursori come nella foto.
function photoPreset() {
  stopProgram();
  g = genDefault();
  g.arbs = storedArbs();
  s = scopeDefault();
  lab = labDefault();
  capture = null;
  pending = null;
  averageState = null;
  etState = null;
  rollState = null;
  overlay = [];
  undo = null;
  lastTrigger = -Infinity;
  help = null;
  genShift = false;
  genReadout = "";
  genAction = null;
  genEntry = null;
  menuLevel = -1;
  menuIndex = 0;
  menuGroup = 0;
  genField = "amp";
  genUnit = "Vpp";
  preferredRow = 0;
  digit = 0;
  $("circuit").value = lab.circuit;
  $("resistance").value = lab.r;
  $("capacitance").value = 82;
  $("cable").value = lab.cable;
  $("gen-edge").value = lab.genEdge * 1e9;
  changed();
}
// Assetto delle esperienze, anche all'apertura: generatore collegato
// direttamente a CH1, entrambi gli strumenti come appena accesi e alle
// impostazioni di fabbrica.
function experiencePreset() {
  photoPreset();
  g = factoryGen(g);
  genField = "freq";
  lab.circuit = "direct";
  lab.channels[1].node = "none";
  factoryScope();
  s.menu = "CH1";
  $("circuit").value = lab.circuit;
  changed();
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function hardcopy() {
  traceCanvas();
  const png = document.createElement("canvas");
  png.width = canvas.width;
  png.height = canvas.height + 66;
  const p = png.getContext("2d");
  p.fillStyle = "#16262e";
  p.fillRect(0, 0, png.width, png.height);
  p.drawImage(canvas, 0, 34);
  p.fillStyle = "#d4ebde";
  p.font = "14px monospace";
  p.fillText(
    "GDS-820C  ·  " +
      $("run-state").textContent +
      "  " +
      $("trigger-state").textContent,
    10,
    23,
  );
  p.fillText(
    Array.from($("lcd-status").children, (span) => span.textContent)
      .join("  ")
      .slice(0, Math.floor(png.width / 8)),
    10,
    png.height - 10,
  );
  png.toBlob((blob) => {
    if (blob) download(blob, "GDS-820C-display.png");
  });
}
$("csv").onclick = () => {
  if (!capture) return;
  const lines = ["time_s,CH1_V,CH2_V"];
  const [a, b] = capture.values,
    [p, q] = s.channels.map((c) => c.probe);
  for (let i = 0; i < capture.length; i++)
    lines.push(
      [capture.start + i * capture.dt, a[i] * p, b[i] * q]
        .map((x) => x.toPrecision(10))
        .join(","),
    );
  download(
    new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" }),
    "GDS-820C-campioni.csv",
  );
};
function render() {
  if (s.menu === "Measure") updateMetrics();
  renderGenerator();
  renderLab();
  renderScope();
}
let shownStatus = "";
// Il ciclo di aggiornamento non deve fermarsi: un errore in un fotogramma
// viene registrato e l'acquisizione riparte al fotogramma successivo.
function tick(timestamp) {
  try {
    tickFrame(timestamp);
  } catch (error) {
    console.error(error);
    pending = null;
    nextArm = 0;
  }
  requestAnimationFrame(tick);
}
function tickFrame(timestamp) {
  if (positionReadout && performance.now() > positionReadout.until) {
    positionReadout = null;
    renderScope();
  }
  if (s.on && s.running) {
    const t = now();
    let fresh = false;
    if (isRoll()) {
      pending = null;
      if (timestamp - lastFrame >= 40) {
        lastFrame = timestamp;
        rollAcquisition(t);
        fresh = true;
      }
    } else {
      rollState = null;
      fresh = serviceAcquisition(t);
    }
    if (fresh) {
      updateMetrics();
      if (s.persist) {
        overlay.push(viewSlice());
        if (overlay.length > 8) overlay.shift();
      } else overlay = [];
      renderScope();
    } else if (triggerStatus !== shownStatus) renderScope();
    shownStatus = triggerStatus;
  }
}
g.arbs = storedArbs();
setupGenerator();
setupScope();
setupLab();
experiencePreset();
new ResizeObserver(traceCanvas).observe(canvas);
render();
requestAnimationFrame(tick);
