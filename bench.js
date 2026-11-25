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
  fftZoom: 1,
  cursorSource: 0,
  cursorTMode: "Off",
  cursorVMode: "Track",
  cursorT: [-0.8e-3, 2e-3],
  cursorV: [0.496, 0.352],
  metrics: ["Vpp", "Freq", "Vrms", "Period", "—"],
  slot: 1,
  saveType: "Setup",
  refSource: "CH1",
  refSlot: "A",
  refs: { A: false, B: false },
  refY: { A: 0, B: 0 },
  lang: "Italiano",
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
  depth: 50,
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
    fskFreq: 1700,
    fskRate: 100,
    fskSource: "INT",
    startFreq: 100,
    stopFreq: 10000,
    sweepTime: 1,
    sweepMode: "LINEAR",
    powerOn: "DEFAULT",
    comma: "OFF",
    hpib: 10,
    iface: "HP-IB",
    baud: 9600,
    parity: "NONE",
    calCount: 0,
  },
});
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
  calibrated = false;
let preferredRow = 0,
  help = null,
  undo = null,
  capture,
  needsCapture = true,
  clearScreen = false;
let cachedRows,
  menuSignature = "",
  noticeTimer,
  runningProgram,
  goCount = [0, 0];
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
    needsCapture = true;
    clearScreen = false;
    lastTrigger = -Infinity;
    changeRevision++;
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
      numberItem("FSK FREQ", "fskFreq", 0.0001, maxFrequency(), "Hz", 10),
      numberItem("FSK RATE", "fskRate", 0.01, 50000, "Hz", 1),
      choice("FSK SRC", "fskSource", ["INT", "EXT"]),
    ],
    [
      numberItem("START F", "startFreq", 0.0001, maxFrequency(), "Hz", 10),
      numberItem("STOP F", "stopFreq", 0.0001, maxFrequency(), "Hz", 10),
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
  return (
    {
      SINE: 15e6,
      SQUARE: 15e6,
      TRIANGLE: 1e5,
      RAMP: 1e5,
      ARB: points >= 12288 ? 200e3 : points >= 8193 ? 2.5e6 : 5e6,
    }[g.wave] ?? 15e6
  );
}
function rangeG(field) {
  const half = g.term === "HIGH Z" ? 10 : 5;
  return {
    freq: [0.0001, maxFrequency()],
    amp: [g.term === "HIGH Z" ? 0.1 : 0.05, 2 * (half - Math.abs(g.offset))],
    offset: [-half + g.amp / 2, half - g.amp / 2],
    duty: g.freq <= 5e6 ? [20, 80] : [40, 60],
    modFreq: [0.01, g.mode === "FM" ? 10000 : 20000],
    depth: [0, 120],
    deviation: [0.0001, Math.min(g.freq, 15e6 - g.freq) || 0.0001],
  }[field];
}
function editGen(field, value) {
  if (!Number.isFinite(value)) {
    genQueue.push("DATA OUT OF RANGE");
    return;
  }
  const [lo, hi] = rangeG(field);
  if (value < lo || value > hi) {
    genQueue.push("DATA OUT OF RANGE");
    if (genQueue.length > 20) genQueue.shift();
  }
  g[field] = Number(clamp(value, lo, hi).toPrecision(10));
  if (field === "freq") {
    g.duty = clamp(g.duty, ...rangeG("duty"));
    g.deviation = clamp(g.deviation, ...rangeG("deviation"));
    g.settings.startFreq = Math.min(g.settings.startFreq, maxFrequency());
    g.settings.stopFreq = Math.min(g.settings.stopFreq, maxFrequency());
  }
}
function genUnits() {
  if (["freq", "modFreq", "deviation"].includes(genField))
    return [
      ["MHz", 1e6],
      ["kHz", 1e3],
      ["Hz", 1],
    ];
  if (genField === "amp")
    return [
      ["mVpp", 0.001],
      ["mVrms", 0.001],
      ["dBm", 1],
    ];
  if (genField === "offset")
    return [
      ["mV", 0.001],
      ["mV", 0.001],
      ["V", 1],
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
  editGen("freq", g.freq);
}
function currentGenItem() {
  return genItems()[menuGroup][menuIndex];
}
function enterGen() {
  if (genAction) {
    if (genAction.type === "state") {
      const states = stored("genStates", {});
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
          g = { ...genDefault(), ...saved, on: true, arbs };
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
      const config = copy(g.settings),
        term = g.term,
        arbs = g.arbs;
      g =
        config.powerOn === "LAST STATE"
          ? { ...prior, on: true, arbs }
          : {
              ...genDefault(),
              on: true,
              settings: config,
              term,
              arbs,
              freq: 1000,
              amp: term === "50 Ω" ? 0.1 : 0.2,
            };
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
    } else chooseGenWave(key);
  }
  if (key === "Freq") {
    genField = shift ? "modFreq" : "freq";
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
  modFreq: "AM / FM FREQ",
  depth: "AM DEPTH",
  deviation: "FM DEVIATION",
};
function renderGenerator() {
  $("g-power").classList.toggle("live", g.on);
  $("g-power").setAttribute("aria-pressed", g.on);
  $("g-shift").classList.toggle("active", genShift);
  $("g-shift").setAttribute("aria-pressed", genShift);
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
        .join("   ") + "   ← Cancella";
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
  const v = g[genField];
  const group = g.settings.comma === "ON";
  const volts = (x) =>
    Math.abs(x) < 1 && x !== 0
      ? (x * 1000).toFixed(2) + " mV"
      : x.toFixed(3) + " V";
  const hz = (x) =>
    group
      ? x.toLocaleString("en-US", { maximumFractionDigits: 6 }) + " Hz"
      : si(x, "Hz", 8);
  const formatted = {
    freq: () => hz(v),
    amp: () =>
      genUnit === "dBm"
        ? (10 * Math.log10((v * waveRms()) ** 2 / (50 * 0.001))).toFixed(2) +
          " dBm"
        : volts(/rms/i.test(genUnit) ? v * waveRms() : v) +
          (/rms/i.test(genUnit) ? "rms" : "pp"),
    offset: () => volts(v),
    duty: () => v + " %",
    modFreq: () => hz(v),
    depth: () => v + " %",
    deviation: () => hz(v),
  }[genField]();
  reading.textContent = formatted;
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
  $("gen-keys").append(
    button(
      "DC",
      () => {
        if (g.on) {
          chooseGenWave("DC");
          changed();
        }
      },
      {
        className: "span2",
        title:
          "DC · modalità del generatore disponibile via SCPI nel modello fisico",
      },
    ),
  );
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
      "Indietro",
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
          select("Mem Leng", "recordLength", lengths, (n) =>
            n.toLocaleString("it-IT"),
          ),
          info("Sample rate", si(capture ? 1 / capture.dt : NaN, "Sa/s")),
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
      const c = s.channels[s.cursorSource],
        factor = c.probe;
      const [, sourceLabel, horizontalLabel, verticalLabel] =
        cursorLabels[s.lang] ?? cursorLabels.English;
      const dt = s.cursorT[1] - s.cursorT[0],
        dv = s.cursorV[1] - s.cursorV[0];
      const modeRow = (time) => {
        const key = time ? "cursorTMode" : "cursorVMode",
          values = time ? s.cursorT : s.cursorV,
          prefix = time ? "T" : "V";
        return row(
          time ? horizontalLabel : verticalLabel,
          s[key],
          () => {
            s[key] = next([prefix + "1", prefix + "2", "Track", "Off"], s[key]);
          },
          (d) => {
            const step = (time ? visibleTime() : c.scale) / 25;
            if (s[key] === prefix + "1" || s[key] === "Track")
              values[0] += d * step;
            if (s[key] === prefix + "2" || s[key] === "Track")
              values[1] += d * step;
          },
          false,
        );
      };
      return [
        select(
          sourceLabel,
          "cursorSource",
          [0, 1],
          (i) => "CH" + (i + 1),
          false,
        ),
        modeRow(true),
        modeRow(false),
        info(
          "T1 " + time2(s.cursorT[0]) + " · T2 " + time2(s.cursorT[1]),
          "Δ " + time2(Math.abs(dt)) + " · " + si(1 / Math.abs(dt), "Hz"),
        ),
        info(
          "V1 " +
            volts2(s.cursorV[0] * factor) +
            " · V2 " +
            volts2(s.cursorV[1] * factor),
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
      return [
        select(
          "Operation",
          "operation",
          ["CH1+CH2", "CH1−CH2", "FFT"],
          String,
          false,
        ),
        s.operation === "FFT"
          ? select("Source", "fftSource", [0, 1], (i) => "CH" + (i + 1), false)
          : number(
              "Position",
              "mathPos",
              -8,
              8,
              0.1,
              (n) => n.toFixed(1) + " div",
              false,
            ),
        s.operation === "FFT"
          ? select(
              "Window",
              "fftWindow",
              ["Rectangular", "Blackman", "Hanning", "Flattop"],
              String,
              false,
            )
          : info("Scale", si(mathScale(), "V") + "/div"),
        s.operation === "FFT"
          ? select("Zoom", "fftZoom", [1, 2, 5, 10], (v) => "×" + v, false)
          : null,
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
let refData = stored("refs", {}),
  template = null;
function scopeSetup() {
  return copy(Object.fromEntries(setupKeys.map((k) => [k, s[k]])));
}
function saveSetup() {
  const setups = stored("setups", {});
  setups[s.slot] = scopeSetup();
  if (save("setups", setups)) say("Configurazione salvata in M" + s.slot);
}
function recallSetup(slot) {
  const setup = stored("setups", {})[slot];
  if (!setup) {
    say("Configurazione M" + slot + " vuota");
    return false;
  }
  Object.assign(s, setup, { slot });
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

let program = stored("program", {}),
  audio;
const programMenus = ["Measure", "Cursor"];
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
  const setups = stored("setups", {});
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
  else s.time = scaleStep(choices, s.time, -d);
}
function channelOffset(channel, delta) {
  const limit = channel.scale <= 0.05 ? 0.5 : channel.scale <= 0.5 ? 5 : 50;
  channel.pos = clamp(
    channel.pos + (delta * channel.scale) / 10,
    -limit,
    limit,
  );
}
function runScope() {
  if (runningProgram?.waiting) {
    programStep();
    return;
  }
  s.running = !s.running;
  if (s.running) lastTrigger = -Infinity;
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
  const r = scopeRows()[preferredRow];
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
          if (s.running) needsCapture = true;
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
        const scale = s.channels[s.trigSource === "CH2" ? 1 : 0].scale;
        s.level = clamp(s.level + (d * scale) / 10, -50, 50);
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
          (d) => channelOffset(s.channels[i], d),
          false,
          false,
        ),
        turn(
          "scale-" + i,
          "Volts/div",
          (d) => {
            s.channels[i].scale = scaleStep(voltSteps, s.channels[i].scale, -d);
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
          s.pos = clamp(
            s.pos + (d * visibleTime()) / 10,
            -s.time * 20,
            s.time * 1000,
          );
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
const isDynamic = () =>
  (g.on && (g.mode !== "CONT" || g.wave === "NOISE")) ||
  s.horizontal === "Roll" ||
  s.goActive ||
  triggerStatus === "Trig?";
const divisions = () => (s.menuOn ? 10 : 12);
const visibleTime = () => (s.horizontal === "Window Zoom" ? s.zoom : s.time);
const videoStandards = {
  ntsc: { lines: 525, fields: 60000 / 1001 },
  pal: { lines: 625, fields: 50 },
  secam: { lines: 625, fields: 50 },
};
function videoAt(kind, t) {
  const { lines, fields } = videoStandards[kind];
  const lineTime = 2 / (lines * fields);
  const phase = t / lineTime - Math.floor(t / lineTime);
  if (phase < 0.074) return -0.3;
  if (phase < 0.18 || phase > 0.97) return 0;
  return 0.1 + 0.55 * Math.sin((Math.PI * (phase - 0.18)) / 0.79) ** 2;
}
const getExt = (pair, t) =>
  lab.ext === "sync"
    ? syncAt(t)
    : lab.ext === "cal"
      ? calibrationAt(t)
      : nodeValue(pair, lab.ext, t);
const calibrationAt = (t) => (Math.sin(2 * Math.PI * 1000 * t) >= 0 ? 2 : 0);
const mainsAt = (t) => Math.sin(2 * Math.PI * 50 * t);
const fraction = (t) => t - Math.floor(t);
function syncAt(t) {
  if (!g.on || ["DC", "NOISE"].includes(g.wave)) return 0;
  const { settings, freq } = g;
  let high;
  switch (g.mode) {
    case "AM":
    case "FM":
      high = fraction(t * g.modFreq * 2) < Math.max(4e-7 * g.modFreq, 0.01);
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
function nodeValue(pair, node, t) {
  if (node === "cal") return calibrationAt(t);
  if (node in videoStandards) return videoAt(node, t);
  if (node === "in") return pair[0];
  if (node === "out") return pair[1];
  return 0;
}
function sampleRate() {
  if (
    s.time < 250e-9 &&
    s.recordLength === 500 &&
    s.trigMode !== "Single" &&
    !isDynamic()
  )
    return 25 / s.time;
  return Math.min(
    100e6,
    (25 / s.time) *
      [1, 2, 5, 10, 20, 40, 100, 200][lengths.indexOf(s.recordLength)],
  );
}
function digital(value, channel) {
  const step = channel.scale / 25;
  return (
    Math.round(
      clamp(
        value,
        -4.8 * channel.scale - channel.pos,
        4.8 * channel.scale - channel.pos,
      ) / step,
    ) * step
  );
}
function physicalCutoff(bw) {
  return bw ? 20e6 : 150e6;
}
function frontEnd(channel, entry, fn, t, pair, bias) {
  if (channel.coupling === "GND") return 0;
  let v = nodeValue(pair, entry.node, t);
  const hz = entry.node === "cal" ? 1000 : g.freq;
  if (
    g.wave === "SINE" &&
    g.mode === "CONT" &&
    ["in", "out"].includes(entry.node)
  ) {
    const cutoff = physicalCutoff(channel.bw);
    const analogPhase = Math.atan(hz / cutoff);
    const hp = channel.coupling === "AC" ? Math.atan(10 / hz) : 0;
    const node = entry.node === "in" ? 0 : 1;
    const time = t + (hp - analogPhase) / (2 * Math.PI * hz);
    const dc = bias[node];
    v =
      (fn(time)[node] - dc) * Math.cos(analogPhase) * Math.cos(hp) +
      (channel.coupling === "AC" ? 0 : dc);
  } else {
    if (channel.coupling === "AC") {
      const dc =
        entry.node === "in"
          ? bias[0]
          : entry.node === "out"
            ? bias[1]
            : entry.node === "cal"
              ? 1
              : entry.node in videoStandards
                ? 0.3
                : 0;
      v = (v - dc) / Math.hypot(1, 10 / hz);
    }
    if (
      hz > physicalCutoff(channel.bw) / 8 &&
      ["in", "out"].includes(entry.node)
    ) {
      const tau = 1 / (2 * Math.PI * physicalCutoff(channel.bw));
      const node = entry.node === "in" ? 0 : 1;
      v =
        0.4 * v +
        0.35 * fn(t - tau)[node] +
        0.2 * fn(t - tau * 2)[node] +
        0.05 * fn(t - tau * 4)[node];
    }
  }
  return (v / entry.probe) * (channel.invert ? -1 : 1);
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
function findTrigger(fn, center, period, bias) {
  if (s.trigType === "Video") {
    const i = s.trigSource === "CH2" ? 1 : 0,
      node = lab.channels[i].node;
    if (
      node !== s.videoStandard.toLowerCase() ||
      s.channels[i].coupling === "GND" ||
      s.channels[i].invert !== (s.slope === "Rising")
    ) {
      return { time: null, hz: NaN };
    }
    const { lines, fields } = videoStandards[node],
      line = 2 / (lines * fields),
      frame = 2 / fields;
    const from = s.videoField === "Field 2" ? Math.ceil(lines / 2) : 0;
    const fieldLines =
      s.videoField === "Field 2" ? Math.floor(lines / 2) : Math.ceil(lines / 2);
    const offset = (from + Math.min(fieldLines, s.videoLine) - 1) * line;
    const at =
      s.videoField === "Line"
        ? Math.floor(center / line) * line
        : Math.floor((center - offset) / frame) * frame + offset;
    return { time: at, hz: NaN };
  }
  const duration = Math.max(period * 8, Math.min(2, s.time * 6));
  const end = center,
    start = end - duration;
  const n = clamp(Math.ceil((duration / period) * 90), 720, 3500);
  const dt = duration / n;
  const sourceIndex = s.trigSource === "CH2" ? 1 : 0;
  const times = Array.from({ length: n + 1 }, (_, i) => start + i * dt);
  const values = filterTrigger(
    times.map((t) => {
      if (s.trigSource === "Line") return mainsAt(t);
      if (s.trigSource === "EXT") return getExt(fn(t), t);
      return frontEnd(
        s.channels[sourceIndex],
        lab.channels[sourceIndex],
        fn,
        t,
        fn(t),
        bias,
      );
    }),
    dt,
  );
  const min = Math.min(...values),
    max = Math.max(...values);
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
  const edges = Physics.crossings(values, s.level, r, dt, start);
  const inverse = () => Physics.crossings(values, s.level, !r, dt, start);
  let candidates = edges;
  if (s.trigType === "Pulse") {
    const exit = inverse();
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
      s.delayLevel === "TTL"
        ? 1.4
        : s.delayLevel === "ECL"
          ? -1.3
          : s.startLevel;
    const ext = Physics.crossings(
      times.map((t) => getExt(fn(t), t)),
      level,
      true,
      dt,
      start,
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
  const last = candidates.at(-1);
  const interval = edges.at(-1) - edges.at(-2);
  return {
    time: last ?? null,
    hz: Number.isFinite(interval) && interval > 0 ? 1 / interval : NaN,
  };
}
function acquire() {
  if (!s.on || !s.running) return false;
  const stable = g.mode === "CONT" && g.wave !== "NOISE";
  let center =
    stable && s.horizontal !== "Roll" && s.trigMode !== "Single" ? 0 : now();
  if (
    g.singleMode &&
    g.firedAt > lastTrigger &&
    g.firedAt > 0 &&
    g.mode === "BURST" &&
    s.trigMode === "Single"
  )
    center = g.firedAt + Math.min(g.settings.burstCount, 4) / g.freq;
  const dt = 1 / sampleRate(),
    half = ((s.recordLength - 1) / 2) * dt;
  const period =
    s.trigSource === "Line"
      ? 0.02
      : (s.trigSource === "EXT" && lab.ext === "cal") ||
          (/^CH[12]$/.test(s.trigSource) &&
            lab.channels[s.trigSource === "CH2" ? 1 : 0].node === "cal")
        ? 0.001
        : 1 / (g.wave === "NOISE" ? 1e5 : g.freq);
  const extent = Math.max(half, (divisions() / 2) * s.time) + Math.abs(s.pos);
  const lookback = Math.max(period * 9, Math.min(2, s.time * 7));
  const fn = Physics.signal(
    g,
    lab,
    center - extent - lookback,
    center + extent + period,
    externalAt,
  );
  const bias = Physics.transfer(lab, 0).map(
    (z) => z[0] * g.offset * (g.term === "50 Ω" ? 2 : 1),
  );
  const trigger =
    s.horizontal === "Roll"
      ? { time: null, hz: NaN }
      : findTrigger(fn, center, period, bias);
  if (
    trigger.time === null &&
    s.horizontal !== "Roll" &&
    ["Normal", "Single"].includes(s.trigMode)
  ) {
    triggerStatus = "Trig?";
    return false;
  }
  triggerStatus =
    trigger.time === null
      ? s.horizontal === "Roll"
        ? "ROLL"
        : "AUTO"
      : "Trig’d";
  if (trigger.time !== null) lastTrigger = trigger.time;
  const origin =
    trigger.time ??
    (s.horizontal === "Roll"
      ? center - (divisions() / 2) * s.time - s.pos
      : center);
  const start = s.pos - half,
    length = s.recordLength;
  const peak = s.acq === "Peak" && s.time >= 500e-9;
  const targets = [new Float64Array(length), new Float64Array(length)];
  const extrema = peak
    ? targets.map(() => [new Float64Array(length), new Float64Array(length)])
    : null;
  const gainAvg = s.acq === "Average" ? Math.sqrt(s.avg) : 1;
  for (let i = 0; i < length; i++) {
    const t = origin + start + i * dt;
    const pair = fn(t);
    const before = peak ? fn(t - dt * 0.35) : pair,
      after = peak ? fn(t + dt * 0.35) : pair;
    for (const [j, c] of s.channels.entries()) {
      const entry = lab.channels[j];
      let value = frontEnd(c, entry, fn, t, pair, bias);
      if (
        s.acq === "Average" &&
        g.wave === "NOISE" &&
        ["in", "out"].includes(entry.node)
      ) {
        const baseline = bias[entry.node === "in" ? 0 : 1] / entry.probe;
        const mean =
          c.coupling === "AC" || c.coupling === "GND"
            ? 0
            : baseline * (c.invert ? -1 : 1);
        value = mean + (value - mean) / gainAvg;
      }
      value = digital(value, c);
      targets[j][i] = value;
      if (peak) {
        const x = digital(
            frontEnd(c, entry, fn, t - dt * 0.35, before, bias),
            c,
          ),
          y = digital(frontEnd(c, entry, fn, t + dt * 0.35, after, bias), c);
        extrema[j][0][i] = Math.min(x, y, value);
        extrema[j][1][i] = Math.max(x, y, value);
      }
    }
  }
  capture = {
    values: targets,
    extrema,
    dt,
    start,
    hz: trigger.hz,
    equivalent: dt < 1e-8,
    length,
    physical: lab.channels.map((c) => c.node),
    revision: changeRevision,
  };
  if (s.trigMode === "Single" && trigger.time !== null) s.running = false;
  clearScreen = false;
  ratioTest();
  return true;
}
function viewSlice() {
  const empty = [new Float64Array(), new Float64Array()];
  if (!capture) return { values: empty, dt: 0, start: 0, end: 0 };
  const center = s.pos,
    span = divisions() * visibleTime(),
    a = center - span / 2,
    b = center + span / 2;
  const first = clamp(
    Math.ceil((a - capture.start) / capture.dt),
    0,
    capture.length,
  );
  const last = clamp(
    Math.floor((b - capture.start) / capture.dt) + 1,
    first,
    capture.length,
  );
  return {
    values: capture.values.map((v) => v.subarray(first, last)),
    extrema: capture.extrema?.map((v) => v.map((k) => k.subarray(first, last))),
    dt: capture.dt,
    start: capture.start + first * capture.dt,
    end: capture.start + (last - 1) * capture.dt,
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
  const measureT = s.cursorTMode !== "Off" && s.cursorT[0] !== s.cursorT[1];
  let a = 0,
    b = capture.length;
  if (measureT) {
    a = clamp(
      Math.ceil((Math.min(...s.cursorT) + s.pos - capture.start) / capture.dt),
      0,
      b,
    );
    b = clamp(
      Math.ceil((Math.max(...s.cursorT) + s.pos - capture.start) / capture.dt),
      a,
      b,
    );
  }
  metricCache = capture.values.map((v) =>
    Physics.measures(v.subarray(a, b), capture.dt),
  );
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
  function plot(values, color, time, volts, showDots = false, samples = 300) {
    if (!values?.length) return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    const skip = Math.max(1, Math.ceil(values.length / samples));
    for (let i = 0; i < values.length; i += skip) {
      const vx = time(i),
        v = volts(values[i]);
      if (showDots) ctx.fillRect(vx, v, 1.8, 1.8);
      else if (i) ctx.lineTo(vx, v);
      else ctx.moveTo(vx, v);
    }
    if (!showDots) ctx.stroke();
  }
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
    } else if (s.math && s.operation === "FFT" && count >= 8) {
      const c = s.channels[s.fftSource];
      const fft = Physics.spectrum(view.values[s.fftSource], s.fftWindow);
      const range = Math.max(1, Math.floor((fft.length - 1) / s.fftZoom));
      plot(
        fft.subarray(0, range + 1),
        palette[2],
        (i) => x + (gw * i) / range,
        (v) =>
          y + (gh * (10 - clamp(20 * Math.log10(v * c.probe), -90, 10))) / 100,
      );
      ctx.fillStyle = palette[2];
      ctx.fillText(
        "FFT · " + si(1 / (2 * view.dt * s.fftZoom), "Hz") + " · 12.5 dB/div",
        x + 5,
        y + 13,
      );
    } else {
      const pointAt = (i) => tx(view.start + i * view.dt);
      if (s.persist) {
        ctx.globalAlpha = 0.17;
        for (const frame of overlay)
          frame.values.forEach((values, j) => {
            if (s.channels[j].on)
              plot(
                values,
                palette[j],
                (i) => tx(frame.start + i * frame.dt),
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
          const step = Math.max(1, Math.floor(count / gw));
          for (let i = 0; i < count; i += step) {
            let min = view.extrema[j][0][i],
              max = view.extrema[j][1][i];
            for (let k = i + 1; k < Math.min(count, i + step); k++) {
              min = Math.min(min, view.extrema[j][0][k]);
              max = Math.max(max, view.extrema[j][1][k]);
            }
            ctx.moveTo(pointAt(i), vy(min, c.scale, c.pos));
            ctx.lineTo(pointAt(i), vy(max, c.scale, c.pos));
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
    }
  }
  if (
    s.horizontal !== "XY" &&
    !(s.math && s.operation === "FFT") &&
    s.menu === "Cursor"
  ) {
    const c = s.channels[s.cursorSource];
    ctx.lineWidth = 0.8;
    for (const [axis, values, active] of [
      ["T", s.cursorT, s.cursorTMode],
      ["V", s.cursorV, s.cursorVMode],
    ]) {
      if (active === "Off") continue;
      for (const [i, v] of values.entries()) {
        const q = axis === "T" ? tx(v + s.pos) : vy(v, c.scale, c.pos);
        ctx.strokeStyle = i ? "#b6b2a7" : "#f6e3ac";
        ctx.fillStyle = ctx.strokeStyle;
        ctx.setLineDash(i ? [4, 3] : []);
        ctx.beginPath();
        if (axis === "T") {
          ctx.moveTo(q, y);
          ctx.lineTo(q, y + gh);
          ctx.fillText(axis + (i + 1), q + 3, y + 11);
        } else {
          ctx.moveTo(x, q);
          ctx.lineTo(x + gw, q);
          ctx.fillText(axis + (i + 1), x + 3, q - 3);
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
    s.channels.forEach((c, j) => {
      if (c.on) {
        ctx.fillStyle = palette[j];
        ctx.fillText(
          j + 1 + "›",
          1,
          clamp(vy(0, c.scale, c.pos) + 3, y + 8, y + gh),
        );
      }
    });
    ctx.fillStyle = "#9cb8b5";
    ctx.fillText(
      si(s.pos, "s") + "  ·  " + si(visibleTime(), "s") + "/div",
      x,
      h - 3,
    );
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
  $("lcd-status").replaceChildren(
    ...[
      ...s.channels.map(
        (c, j) =>
          "CH" +
          (j + 1) +
          " " +
          (c.on ? si(c.scale * c.probe, "V") + "/div " + c.coupling : "Off"),
      ),
      (capture?.equivalent ? "ET " : "") +
        si(capture ? 1 / capture.dt : NaN, "Sa/s"),
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
  for (let i = 0; i < 5; i++)
    $("f" + (i + 1)).disabled =
      !s.on || !s.menuOn || !cachedRows?.[i]?.action || help !== null;
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
  c.fillStyle = "#eff4ee";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#a2b8ab";
  for (let x = 20; x < w; x += 20)
    for (let y = 20; y < h; y += 20) c.fillRect(x, y, 1.5, 1.5);
  c.lineWidth = 3;
  c.strokeStyle = "#305847";
  c.fillStyle = "#305847";
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
  $("response-hint").textContent =
    g.mode === "CONT" && g.wave === "SINE"
      ? "Risposta sinusoidale OUT/IN alla frequenza impostata."
      : "Risposta teorica del circuito alla frequenza nominale.";
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
  $("reset-lab").onclick = () => {
    stopProgram();
    g = genDefault();
    g.arbs = stored("arbs", {});
    s = scopeDefault();
    lab = labDefault();
    capture = null;
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
    changed();
    say("Assetto foto ripristinato");
  };
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
    $("lcd-status").textContent.slice(0, Math.floor(png.width / 8)),
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
function tick(timestamp) {
  if (
    s.on &&
    s.running &&
    (needsCapture || isDynamic()) &&
    timestamp - lastFrame >= 84
  ) {
    lastFrame = timestamp;
    needsCapture = false;
    if (acquire()) {
      updateMetrics();
      if (s.persist) {
        overlay.push(viewSlice());
        if (overlay.length > 8) overlay.shift();
      } else overlay = [];
    }
    renderScope();
  }
  requestAnimationFrame(tick);
}
g.arbs = stored("arbs", {});
setupGenerator();
setupScope();
setupLab();
document.querySelector('a[href="#guide"]').addEventListener("click", () => {
  $("guide").open = true;
});
new ResizeObserver(traceCanvas).observe(canvas);
render();
requestAnimationFrame(tick);
