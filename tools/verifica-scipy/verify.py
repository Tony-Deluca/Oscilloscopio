"""Verifica indipendente del modello fisico di Banco RC con NumPy e SciPy.

Ricalcola da zero, dai valori dei componenti, ciò che physics.js calcola e
confronta i risultati. Uso: python3 verify.py js.json
"""
import json, sys
import numpy as np
from scipy import signal, optimize
from scipy.signal import windows

js = json.load(open(sys.argv[1]))
rows = []
def row(name, sim, ref, ok, note=""):
    rows.append((name, sim, ref, ok, note))

# Componenti del banco (valori dichiarati nel modello)
RS, R, C = 50.0, 2200.0, 82e-9
G_SCOPE, C_SCOPE, C_CABLE = 1e-6, 22e-12, 101e-12  # 1 MΩ, 22 pF, RG-58 per metro
L_CABLE = 1.0

# 1. Rete RC caricata: modello nodale scritto da zero
C_IN = C_SCOPE + C_CABLE * L_CABLE   # CH1 col suo cavo; il cavo del generatore è adattato
TAU_D = L_CABLE / (0.66 * 299792458)  # ritardo del cavo del generatore
C_OUT = C + C_SCOPE + C_CABLE * L_CABLE                  # C + CH2 col suo cavo
G_IN = G_OUT = G_SCOPE
row("Capacità al nodo IN (pF)", js["loads"]["in"]["cap"] * 1e12, C_IN * 1e12,
    abs(js["loads"]["in"]["cap"] - C_IN) < 1e-18)
row("Capacità al nodo OUT, escluso C (pF)", (js["loads"]["out"]["cap"]) * 1e12, (C_OUT - C) * 1e12,
    abs(js["loads"]["out"]["cap"] - (C_OUT - C)) < 1e-18)
A = np.array([[-(1 / RS + G_IN + 1 / R) / C_IN, (1 / R) / C_IN],
              [(1 / R) / C_OUT, -(1 / R + G_OUT) / C_OUT]])
B = np.array([[1 / (RS * C_IN)], [0.0]])
Cm, Dm = np.eye(2), np.zeros((2, 1))
def H(f):
    return np.linalg.solve(2j * np.pi * f * np.eye(2) - A, B).ravel() * np.exp(-2j * np.pi * f * TAU_D)
err = 0
for item in js["transfer"]:
    ref = H(item["f"]); sim = np.array([complex(*item["h"][0]), complex(*item["h"][1])])
    err = max(err, np.max(np.abs(sim - ref)))
row("H(IN), H(OUT) da 10 Hz a 10 MHz: scarto massimo", err, 0, err < 1e-9)
ratio = lambda f: abs(H(f)[1] / H(f)[0])
fc = optimize.brentq(lambda f: ratio(f) - ratio(1e-3) / np.sqrt(2), 10, 1e5)
row("Taglio −3 dB OUT/IN (Hz)", js["response870"]["cutoff"], fc,
    abs(js["response870"]["cutoff"] - fc) / fc < 2e-3, "formula della scheda contro bisezione")
g870 = H(870)[1] / H(870)[0]
row("Guadagno OUT/IN a 870 Hz", js["response870"]["gain"], abs(g870), abs(js["response870"]["gain"] - abs(g870)) < 1e-9)
row("Fase OUT−IN a 870 Hz (°)", np.degrees(js["response870"]["phase"]), np.degrees(np.angle(g870)),
    abs(js["response870"]["phase"] - np.angle(g870)) < 1e-9)

# 2. Quadra in regime periodico: scipy.signal.lsim su molti periodi
sysm = signal.StateSpace(A, B, Cm, Dm)
for item in js["square"]:
    f = item["f"]; T = 1 / f
    n, periods = (20000, 30) if f >= 1000 else (200000, 8)  # passo del riferimento ≤ 50 ns
    t = np.arange(periods * n) * T / n
    u = np.where(((t - TAU_D) * f) % 1 < 0.5, 1.0, -1.0)
    _, y, _ = signal.lsim(sysm, signal.lsim(signal.TransferFunction([1], [20e-9 / 2.2, 1]), u, t, interp=False)[1], t, interp=False)
    last = y[-n:]; tt = np.array(item["t"]); idx = np.round(tt / T * n).astype(int) % n
    sim = np.array(item["v"]); ph = (tt / T) % 0.5; keep = (ph > 4 / n) & (ph < 0.5 - 4 / n)  # esclusi i campioni sui fronti
    e = np.max(np.abs(sim - last[idx])[keep])
    row(f"Quadra {f:g} Hz, nodi IN/OUT: scarto massimo (V)", e, 0, e < 5e-3, "scipy.signal.lsim")

# 3. Stadio d'ingresso: passa-alto 10 Hz e passa-basso del primo ordine
e = 0
for item in js["frontEnd"]:
    s = 2j * np.pi * item["f"]; wh = 2 * np.pi * 10; wb = 2 * np.pi * item["bw"]
    ref = (s / (s + wh) if item["ac"] else 1) * wb / (s + wb)
    e = max(e, abs(complex(*item["h"]) - ref))
row("Stadio d'ingresso H(f): scarto massimo", e, 0, e < 1e-12)
hp = signal.TransferFunction([1, 0], [1, 2 * np.pi * 10])
f0 = 10; T = 0.1; n = 20000; t = np.arange(40 * n) * T / n
u = np.where((t * f0) % 1 < 0.5, 1.0, -1.0) / (1 + RS * G_SCOPE)
_, y, _ = signal.lsim(hp, u, t, interp=False)
last = y[-n:]; tt = np.array(js["acSquare"]["t"]); idx = np.round(tt / T * n).astype(int) % n
ph = (tt / T) % 0.5; keep = (ph > 4 / n) & (ph < 0.5 - 4 / n)
e = np.max(np.abs(np.array(js["acSquare"]["v"]) - last[idx])[keep])
row("Quadra 10 Hz in AC: scarto massimo (V)", e, 0, e < 1e-2, f"picco teorico {2/(1+np.exp(-T/2/(1/(2*np.pi*10)))):.4f} V")

# 4. Cavi: modello a capacità concentrata contro linea di trasmissione
def rise_from(Hf, edge_window=2e-6):
    f0 = 1e5; dt = 0.05e-9; n = int(round(1 / f0 / dt))
    t = np.arange(n) * dt; x = np.where(t < 0.5 / f0, 1.0, -1.0)
    X = np.fft.rfft(x); fk = np.fft.rfftfreq(n, dt)
    y = np.fft.irfft(X * Hf(fk), n)
    seg = y[: int(edge_window / dt)]; lo, hi = -1.0, seg.max()  # fronte di salita a t = 0
    y2 = np.concatenate([y[-int(edge_window / dt):], seg])
    t10 = np.argmax(y2 >= lo + 0.1 * (hi - lo)); t90 = np.argmax(y2 >= lo + 0.9 * (hi - lo))
    return (t90 - t10) * dt
lp150 = lambda f: 1 / (1 + 1j * f / 150e6)
ZL = lambda f: 1 / (G_SCOPE + 2j * np.pi * np.maximum(f, 1e-3) * C_SCOPE)
Z0, VF = 50.0, 0.66
def line(f, length, loss=True):
    w = 2 * np.pi * np.maximum(f, 1e-3)
    alpha = (0.046 / 8.686) * np.sqrt(np.maximum(f, 1) / 10e6) if loss else 0  # RG-58: ~4,6 dB/100 m a 10 MHz
    gamma = alpha + 1j * w / (VF * 3e8); gl = gamma * length
    Ach, Bch, Cch, Dch = np.cosh(gl), Z0 * np.sinh(gl), np.sinh(gl) / Z0, np.cosh(gl)
    z = ZL(f)
    return 1 / (Ach + Bch / z + RS * (Cch + Dch / z))
edge = lambda f: 1 / (1 + 2j * np.pi * f * 20e-9 / 2.2)  # fronte della quadra del generatore
for item in js["cable"]:
    length = item["len"]
    tline_sq = lambda f: line(f, length) * edge(f) * lp150(f)
    r_t = rise_from(tline_sq)
    p_t = abs(line(15e6, length) * lp150(15e6))
    row(f"Cavo {length:g} m: tempo di salita (ns), simulatore / linea di trasmissione", item["rise"] * 1e9, r_t * 1e9,
        abs(item["rise"] - r_t) < 1.0e-9, "")
    row(f"Cavo {length:g} m: |H| a 15 MHz, simulatore / linea di trasmissione", item["peak15"], p_t,
        abs(item["peak15"] - p_t) < 0.02, "sinusoide, senza filtro sul fronte")

# 5. Spettro: numpy.fft con finestre simmetriche di scipy e guadagno coerente
wins = {"Rectangular": lambda n: np.ones(n), "Hanning": lambda n: windows.hann(n, sym=True),
        "Blackman": lambda n: windows.blackman(n, sym=True), "Flattop": lambda n: windows.flattop(n, sym=True)}
for item in js["spectrum"]:
    x = np.array(item["x"]); w = wins[item["window"]](len(x))
    X = np.abs(np.fft.rfft(x * w)) / w.sum(); X[1:-1] *= np.sqrt(2)
    e = np.max(np.abs(np.array(item["bins"]) - X))
    row(f"FFT {item['window']}, tono a bin {item['k']}: scarto massimo", e, 0, e < 1e-6,
        f"picco {max(item['bins'][1:]):.4f} Vrms (ideale 1,0607)")

# 6. Misure automatiche
for item in js["measures"]:
    x = np.array(item["x"]); m = item["m"]
    row(f"Vrms {item['name']}", m["Vrms"], float(np.sqrt(np.mean(x ** 2))), abs(m["Vrms"] - np.sqrt(np.mean(x ** 2))) < 1e-9)
    row(f"Freq {item['name']} (Hz)", m["Freq"], 1000.0, abs(m["Freq"] - 1000) < 1, f"Vhi {m['Vhi']:.3f} Vlo {m['Vlo']:.3f}")
row("Tempo di salita di 1−e^(−t/τ) (µs)", js["riseExp"]["rise"] * 1e6, js["riseExp"]["tau"] * np.log(9) * 1e6,
    abs(js["riseExp"]["rise"] - js["riseExp"]["tau"] * np.log(9)) < 0.01 * js["riseExp"]["tau"] * np.log(9))

# 7. Aliasing
x = np.array(js["alias"]["x"]); X = np.abs(np.fft.rfft(x * windows.hann(len(x)))); fk = np.fft.rfftfreq(len(x), 1 / js["alias"]["fs"])
peak = fk[np.argmax(X[1:]) + 1]
row("870 Hz campionati a 250 Sa/s: frequenza apparente (Hz)", peak, abs(870 - 3 * 250), abs(peak - 120) <= 0.5)

# 8. AM (User's Guide: 0 % → metà ampiezza, 100 % → ampiezza impostata)
for item in js["am"]:
    ref = 1.0 if item["depth"] == 100 else 0.5
    row(f"AM {item['depth']} %: Vpp con 1 Vpp impostato", item["vpp"], ref, abs(item["vpp"] - ref) < 0.01)

# 9. ADC a 8 bit con 25 livelli per divisione: SINAD di una sinusoide a pieno schermo
n = 4096; k = 127; t = np.arange(n)
xa = 100 * np.sin(2 * np.pi * k * t / n)  # ±4 div = ±100 livelli
q = np.clip(np.round(xa), -128, 127)
sinad = 10 * np.log10(np.mean(xa ** 2) / np.mean((q - xa) ** 2))
row("ADC: SINAD a pieno schermo (dB)", sinad, 6.02 * np.log2(200) + 1.76, abs(sinad - (6.02 * np.log2(200) + 1.76)) < 0.6,
    "200 livelli usati su 256: ENOB ≈ 7,6 bit")

w = max(len(r[0]) for r in rows)
for name, sim, ref, ok, note in rows:
    s = f"{sim:.6g}" if isinstance(sim, (int, float, np.floating)) else str(sim)
    r = f"{ref:.6g}" if isinstance(ref, (int, float, np.floating)) else str(ref)
    print(f"{'OK  ' if ok else 'DIFF'} {name:<{w}}  simulatore {s:>12}  riferimento {r:>14}  {note}")
print(f"\n{sum(r[3] for r in rows)} su {len(rows)} confronti concordano")
