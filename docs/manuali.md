# Schede degli strumenti dai manuali del costruttore

Sintesi in italiano dei manuali ufficiali, letta per il simulatore e per ripassare le esperienze di laboratorio. Le pagine citate sono quelle stampate nei PDF.

| Strumento | Documento | Edizione |
| --- | --- | --- |
| HP/Agilent 33120A | [User’s Guide](https://www.keysight.com/content/dam/keysight/en/doc/gate/user-manuals/9018-04436.pdf) | 33120-90006, 312 pagine, marzo 2002 |
| HP/Agilent 33120A | [Quick Reference Guide](https://www.keysight.com/gn/en/assets/9018-06352/reference-guides/9018-06352.pdf) | 33120-90009, 10 pagine, marzo 2002 |
| GW Instek GDS-820C | [GDS-800 Series Operation Manual](https://www.gwinstek.com/en-US/products/downloadSeriesDownNew/12199/1057) | 83 pagine, copre GDS-806/810/820/840 S e C |

---

## 1. Generatore HP 33120A

### 1.1 Caratteristiche dichiarate (User’s Guide, cap. 8, pp. 298–300)

**Forme d’onda**

| Voce | Valore |
| --- | --- |
| Standard | Sine, Square, Triangle, Ramp, Noise, DC |
| Arbitrarie incorporate | Sinc (sin x/x), Negative Ramp, Exp Rise, Exp Fall, Cardiac |
| Arbitrarie utente | da 8 a 16 000 punti, 12 bit, 40 MSa/s, quattro forme in memoria non volatile, nome fino a 8 caratteri |

**Frequenza**

| Forma | Intervallo |
| --- | --- |
| Sine, Square | 100 µHz – 15 MHz |
| Triangle, Ramp | 100 µHz – 100 kHz |
| Noise (gaussiano) | banda 10 MHz |
| Arb 8–8 192 punti | 100 µHz – 5 MHz |
| Arb 8 193–12 287 punti | 100 µHz – 2,5 MHz |
| Arb 12 288–16 000 punti | 100 µHz – 200 kHz |
| Risoluzione | 10 µHz o 10 cifre |
| Accuratezza | 10 ppm in 90 giorni, 20 ppm in un anno (18–28 °C) |

**Uscita**

| Voce | Valore |
| --- | --- |
| Impedenza di uscita | 50 Ω fissi |
| Ampiezza su 50 Ω | 50 mVpp – 10 Vpp |
| Ampiezza a circuito aperto | 100 mVpp – 20 Vpp |
| Accuratezza ampiezza a 1 kHz | ±1% del valore impostato |
| Planarità della sinusoide rispetto a 1 kHz | < 100 kHz ±1% (0,1 dB); 100 kHz–1 MHz ±1,5%; 1–15 MHz ±2% con ampiezza ≥ 3 Vrms, ±3,5% sotto 3 Vrms |
| Offset su 50 Ω | ±5 Vpk (AC + DC), con offset ≤ 2 × ampiezza picco-picco |
| Accuratezza offset | ±2% del valore + 2 mV (onda quadra: +2% dell’ampiezza) |
| Unità | Vpp, Vrms, dBm (dBm solo con terminazione 50 Ω) |
| Risoluzione | 3 cifre per ampiezza e offset |
| Protezione | cortocircuito; 42 Vpk massimi verso terra |

**Caratteristiche del segnale**

| Voce | Valore |
| --- | --- |
| Quadra: salita/discesa | < 20 ns |
| Quadra: sovraelongazione | < 4% |
| Quadra: duty cycle | 20–80% fino a 5 MHz, 40–60% fino a 15 MHz |
| Triangle, Ramp, Arb: salita/discesa | 40 ns tipici |
| Distorsione armonica della sinusoide | −70 dBc fino a 20 kHz; −60 dBc fino a 100 kHz; −45 dBc fino a 1 MHz; −35 dBc fino a 15 MHz |
| THD fino a 20 kHz | < 0,04% |

**Modulazioni e sweep**

| Modo | Parametri |
| --- | --- |
| AM | portante −3 dB a 10 MHz; modulante qualsiasi forma interna o Arb, 10 mHz–20 kHz; profondità 0–120%; sorgente interna o esterna (±5 Vpk = 100%, 5 kΩ) |
| FM | modulante 10 mHz–10 kHz; deviazione di picco 10 mHz–15 MHz; solo sorgente interna |
| Burst | portante massima 5 MHz; da 1 a 50 000 cicli o infinito; fase iniziale −360°…+360°; rate interno 10 mHz–50 kHz; gate esterno; trigger Single, External o Internal |
| FSK | 10 mHz–15 MHz; rate interno 10 mHz–50 kHz; sorgente interna o esterna (fino a 1 MHz) |
| Sweep | lineare o logaritmico, verso l’alto o il basso; Start F e Stop F 10 mHz–15 MHz; tempo 1 ms–500 s; trigger Single, External o Internal |
| Ingresso trigger posteriore | TTL attivo basso, latenza 1,3 ms, jitter 25 ns |

**Dati generali:** tre stati utente più lo stato allo spegnimento, GPIB e RS-232, SCPI-1993, riscaldamento di un’ora, 4 kg.

### 1.2 Stato all’accensione e dopo un reset (p. 123)

| Parametro | Valore |
| --- | --- |
| Funzione | sinusoide a **1 kHz** |
| Ampiezza | **100 mVpp su 50 Ω**, unità Vpp |
| Offset | 0 V |
| **Terminazione di uscita** | **50 Ω**: torna a 50 Ω a ogni accensione, perciò in laboratorio va reimpostata ogni volta High Z |
| AM | modulante sinusoide a 100 Hz, profondità 100% |
| FM | modulante sinusoide a 10 Hz, deviazione 100 Hz |
| Burst | 1 ciclo, rate 100 Hz, fase 0° |
| FSK | frequenza di salto 100 Hz, rate 10 Hz |
| Sweep | 100 Hz → 1 kHz in 1 s, lineare |
| Modulazione | Off |
| Trigger | interno |
| Memoria non volatile | Power-Down Recall disattivato, separatore delle migliaia attivo, indirizzo GPIB 10, interfaccia GPIB, 9600 baud, parità None |
| Calibrazione | Secured |

### 1.3 Pannello frontale (pp. 1–5 e 15–25)

I tasti hanno tre funzioni. Quella **principale** è scritta sul tasto. Quella **secondaria**, in blu sopra il tasto, si ottiene con **Shift** e poi il tasto. La **cifra** in verde accanto al tasto vale solo in modalità **Enter Number**.

| Tasto | Funzione principale | Con Shift | Cifra |
| --- | --- | --- | --- |
| Sine ∿ | sinusoide | **AM** | 1 |
| Square ⊓ | onda quadra | **FM** | 2 |
| Triangle △ | triangolare | **FSK** | 3 |
| Ramp ⋰ | rampa | **Burst** | 4 |
| Noise | rumore | **Sweep** | 5 |
| Arb | forma arbitraria assegnata al tasto | **Arb List**: scegli fra le cinque incorporate e quelle utente | ± |
| Freq | modifica la frequenza | **AM/FM Freq**: frequenza della modulante | 6 |
| Ampl | modifica l’ampiezza | **AM/FM Level**: profondità AM o deviazione FM | 7 |
| Offset | modifica l’offset DC | **% Duty**: duty cycle, solo per l’onda quadra | 8 |
| Single | trigger singolo di burst o sweep | **Internal**: torna al trigger interno | 9 |
| Recall | richiama uno stato (0 = stato allo spegnimento, 1–3 = utente) | **Store**: salva negli stati 1–3 | 0 |
| Enter Number | attiva l’inserimento numerico (spia Num) | **Cancel**: esce dall’inserimento | . |
| Enter | conferma valori senza unità (AM Level, Offset, % Duty, stati) e le voci di menu | **Menu On/Off**: apre o chiude il menu | — |
| Shift | attiva la funzione blu (spia Shift) | **Local**: torna al controllo da pannello | — |
| ↑ | aumenta la cifra lampeggiante; in Enter Number conferma con **MHz** o **mVpp** | — | — |
| ↓ | diminuisce la cifra; in Enter Number conferma con **kHz** o **mVrms** | — | — |
| → | sposta la cifra a destra; in Enter Number conferma con **Hz** o **dBm** | — | — |
| ← | sposta la cifra a sinistra; in Enter Number cancella l’ultima cifra (Back Space) | **Recall Menu**: riapre l’ultimo comando di menu | — |
| Manopola | modifica la cifra lampeggiante o scorre le scelte | — | — |
| Power | accensione | — | — |

**Uscita DC.** Il pannello non ha un tasto DC. Si **tiene premuto Offset**, o un tasto della prima fila di funzioni, **per più di 2 secondi**: compare «DCV» e si imposta la tensione. Il limite è ±5 Vdc su 50 Ω (p. 24).

**Tre modi di inserire un numero** (p. 3):
1. manopola e frecce;
2. frecce sulle singole cifre;
3. Enter Number, poi le cifre, poi la freccia dell’unità oppure Enter.

**Connettori anteriori:** OUTPUT (50 Ω) e SYNC (uscita TTL di sincronismo).
**Connettori posteriori:** AM Modulation In; Ext Trig/FSK/Burst (TTL); GPIB; RS-232.

### 1.4 Menu frontale (p. 4)

Si apre con **Shift + Enter**. È un albero a tre livelli: con **↓** si scende di livello, con **↑** si risale, con **← →** (o la manopola) si scorre fra le voci, con **Enter** si conferma.

| Menu | Comandi |
| --- | --- |
| **A: MOD MENU** | 1 AM SHAPE · 2 AM SOURCE · 3 FM SHAPE · 4 BURST CNT · 5 BURST RATE · 6 BURST PHAS · 7 BURST SRC · 8 FSK FREQ · 9 FSK RATE · 10 FSK SRC |
| **B: SWP MENU** | 1 START F · 2 STOP F · 3 SWP TIME · 4 SWP MODE |
| **C: EDIT MENU** | 1 NEW ARB · [2 POINTS · 3 LINE EDIT · 4 POINT EDIT · 5 INVERT · 6 SAVE AS] · 7 DELETE. Le voci fra parentesi compaiono dopo NEW ARB |
| **D: SYS MENU** | 1 OUT TERM (50 Ω / HIGH Z) · 2 POWER ON (DEFAULT / LAST STATE) · 3 ERROR · 4 TEST · 5 COMMA · 6 REVISION |
| **E: I/O MENU** | 1 HPIB ADDR · 2 INTERFACE · 3 BAUD RATE · 4 PARITY · 5 LANGUAGE |
| **F: CAL MENU** | 1 SECURED / UNSECURED · [2 CALIBRATE] · 3 CAL COUNT · 4 MESSAGE |

La terminazione **non cambia l’impedenza reale** dell’uscita, che resta sempre 50 Ω. Cambia solo il calcolo dell’ampiezza mostrata. Con HIGH Z il display mostra il doppio della tensione rispetto a 50 Ω, perché l’uscita a vuoto vale il doppio. È il passo tre della prima esperienza.

### 1.5 Spie del display (p. 5)

Adrs, Rmt (remoto), **Trig** (attesa di trigger per burst o sweep), AM, FM, **Ext** (sorgente esterna), FSK, Burst, Swp, **ERROR** (coda errori non vuota, si legge da SYS MENU → ERROR), **Offset** (offset diverso da zero), **Shift**, **Num** (Enter Number attivo), **Arb**, e il simbolo della forma d’onda attiva. Tenendo premuto Shift all’accensione si accendono tutte le spie.

---

## 2. Oscilloscopio GW Instek GDS-820C

### 2.1 Caratteristiche dichiarate (Operation Manual, cap. 8, pp. 72–79)

**Sistema verticale**

| Voce | GDS-820C |
| --- | --- |
| Canali | 2, acquisiti insieme |
| Sensibilità | 2 mV/div – 5 V/div, sequenza 1-2-5 |
| **Accuratezza** | **±(3% × \|lettura\| + 0,05 div × Volts/div + 0,8 mV)** |
| Banda (−3 dB) | DC – **150 MHz**; in AC 10 Hz – 150 MHz |
| Tempo di salita | **< 2,3 ns** |
| Limite di banda | 20 MHz (−3 dB) |
| Accoppiamento | AC, DC, GND |
| Impedenza d’ingresso | **1 MΩ ±2%, circa 22 pF** |
| Polarità | normale o invertita |
| Massima tensione d’ingresso | 300 V (DC + picco AC), CAT II |
| Offset di posizione | ±0,5 V da 2 a 50 mV/div; ±5 V da 100 a 500 mV/div; ±50 V da 1 a 5 V/div |
| Elaborazioni | CH1−CH2, CH1+CH2, FFT |

**Trigger**

| Voce | Valore |
| --- | --- |
| Sorgenti | CH1, CH2, Line, EXT |
| Modi | Auto Level, Auto, Normal, Single |
| Tipi | Edge, Video (TV), Pulse Width, Delay (a tempo o a eventi) |
| Ritardo a tempo | 100 ns – 1,3 ms |
| Ritardo a eventi | 2 – 65 000 |
| Livello di start | ±12 V (modo USER) |
| Accoppiamento | AC, DC, LF rej, HF rej, Noise rej |
| Sensibilità | circa 0,5 div o 5 mV fino a 25 MHz; circa 1,5 div o 15 mV fra 25 e 150 MHz; video 0,5 div di sincronismo |
| EXT TRIG | ±15 V in DC, ±2 V in AC; circa 50 mV fino a 30 MHz, circa 100 mV fra 30 e 150 MHz; 1 MΩ ∥ 22 pF |

**Sistema orizzontale e acquisizione**

| Voce | Valore |
| --- | --- |
| Base dei tempi | 1 ns/div – 10 s/div, sequenza 1-2,5-5 |
| **Accuratezza della base dei tempi** | **0,01%** |
| Modi | Main, Window, Window Zoom, Roll, X-Y |
| Ritardo | pre-trigger fino a 20 div, post-trigger fino a 1000 div |
| X-Y | X = CH1, Y = CH2, sfasamento ±3° a 100 kHz |
| Campionamento reale | 100 MSa/s massimi per canale |
| Campionamento equivalente (ET) | 25 GSa/s per canale, solo per segnali ripetitivi |
| Risoluzione verticale | 8 bit |
| Memoria | 125 000 punti per canale, anche in single shot |
| Banda in single shot | 10 MHz |
| Peak Detect | impulsi fino a 10 ns, attivo da 500 ns/div a 10 s/div |
| Average | 2, 4, 8, 16, 32, 64, 128, 256 acquisizioni |
| Frequenzimetro di trigger | 6 cifre, da 20 Hz alla banda nominale, ±2%, non attivo con trigger video |

**Display e interfacce:** LCD a colori da 5,7″, 320 × 240 pixel. Graticolo 8 × 10 divisioni col menu laterale, 8 × 12 senza. RS-232 di serie; USB 1.1/2.0 (solo come dispositivo), porta parallela per stampanti HP e GPIB opzionale. 15 configurazioni salvabili, 2 tracce di riferimento, 100 template per il Go/No Go.

### 2.2 Display (pp. 12–13)

1. **Barra della memoria**: rappresenta sempre il record compresso in 500 punti.
2. Indicatore **T** della posizione di trigger.
3. **Area visibile**, cioè la parte della memoria mostrata a schermo.
4. **RUN o STOP**.
5. **Stato del trigger**: *Trig’d* (agganciato), *Trig?* (nessun trigger in Normal o Single), *AUTO* (trigger automatico senza condizione soddisfatta).
6. Livello di trigger (◄ a destra).
7. Posizione dei canali (1► e 2► a sinistra).
8. Indicatore del ritardo di trigger.
9. Riga di stato in basso: scala e accoppiamento di CH1 e CH2, **frequenza di campionamento**, modo orizzontale, sorgente, tipo e modo del trigger, acquisizione, interfaccia, frequenzimetro.

**Punti a schermo.** In RUN lo strumento elabora sempre **500 punti**, ma ne disegna **250** col menu attivo e **300** col menu spento. Con la memoria da 500 punti ci sono quindi 25 campioni per divisione.

### 2.3 Comandi del pannello e menu dei tasti F1–F5 (cap. 5, pp. 17–67)

Ogni tasto di menu mostra a destra dello schermo fino a cinque voci, associate ai tasti **F1–F5**. Con la manopola **VARIABLE** si regola la voce attiva. **MENU ON/OFF** nasconde il menu e passa da 10 a 12 divisioni orizzontali.

**Verticale**

| Comando | Funzione |
| --- | --- |
| CH1, CH2 | aprono il menu del canale; ripremendo il tasto si accende o spegne la traccia (il LED segue lo stato) |
| POSITION (uno per canale) | posizione verticale; la lettura compare a schermo |
| VOLTS/DIV (uno per canale) | scala verticale, sequenza 1-2-5 |
| MATH | menu delle elaborazioni; ripremendolo si spegne la traccia Math |

| Menu CH1/CH2 | Voce |
| --- | --- |
| F1 | **Coupling**: AC (∿), DC (⎓), GND (⏚) |
| F2 | **Invert**: On/Off |
| F3 | **BW Limit**: 20 MHz oppure banda piena |
| F4 | **Probe**: ×1, ×10, ×100 |
| F5 | **Impedance**: solo indicazione, sempre 1 MΩ |

**MATH (pp. 22–25)**

- F1 **Operation**: CH1+CH2, CH1−CH2, FFT. Per somma e differenza, VARIABLE sposta la traccia.
- In FFT il menu prosegue con:
  - **Source** CH1 o CH2;
  - **Window**: Rectangular (transitori), Blackman (lobi laterali più bassi), Hanning (risoluzione in frequenza migliore), Flattop (ampiezza più accurata);
  - **Position** regolata con VARIABLE: la linea **M** segna circa 0 dB, e **0 dB corrisponde a 1 Vrms**;
  - **Unit/div** su F5: 20, 10, 5, 2 o 1 dB/div.
- **Cursori sulla FFT:** CURSOR → F1 **Source MATH**. I cursori verticali danno **f1, f2, Δ e Div** (Hz per divisione). Quelli orizzontali danno **M1, M2 e Δ** in dB. È il procedimento dei passi dodici e tredici.

**Orizzontale**

| Comando | Funzione |
| --- | --- |
| TIME/DIV | scala dei tempi, sequenza 1-2,5-5 |
| POSITION | posizione orizzontale (indicatore T in alto) |
| HORI MENU | F1 **Main**; F2 **Window** (riquadro, regolato con TIME/DIV fino a uno scatto più veloce della base principale); F3 **Window Zoom** (mostra il riquadro ingrandito); F4 **Roll** (scorrimento continuo, almeno 200 ms/div); F5 **XY** (CH1 orizzontale, CH2 verticale) |

**Esplorare il record fermo.** Con STOP si può esplorare il record in memoria cambiando TIME/DIV e POSITION. Lo zoom arriva fino a sette scatti più veloci della base usata per acquisire.

**Trigger**

| Comando | Funzione |
| --- | --- |
| MENU | menu di trigger |
| LEVEL | livello di trigger |

| Tipo | F1 | F2 | F3 | F4 | F5 |
| --- | --- | --- | --- | --- | --- |
| **Edge** | Type | Source: CH1, CH2, EXT, Line | Mode: Auto Level, Auto, Normal, Single | — | Slope/Coupling → sottomenu |
| Sottomenu Slope/Coupling | Slope ↑/↓ | Coupling DC/AC | Rejection: LF, HF (taglio a 50 kHz) o Off | Noise Rej On/Off | Previous |
| **Video** | Type | Source CH1/CH2 | Standard: NTSC (525 righe, 60 Hz), PAL o SECAM (625 righe, 50 Hz) | Polarity | Field 1, Field 2 o Line; la riga si sceglie con VARIABLE (NTSC 1–263/262, PAL 1–313/312) |
| **Pulse** | Type | Source | Mode | When <, >, =, ≠ (larghezza da 20 ns a 10 s, con VARIABLE) | Slope/Coupling |
| **Delay** | Type | By Time (100 ns–1,3 ms) | By Event (2–65 000) | Livello di start: TTL (+1,4 V), ECL (−1,3 V) o USER (±12 V) | Main trigger |

Con il tipo Delay lo start arriva da EXT TRIG e il trigger vero da CH1 o CH2.

**Modi di trigger**
- **Auto Level**: il livello resta fra minimo e massimo del segnale; non funziona con EXT.
- **Auto**: trigger interno anche senza eventi; a 250 ms/div o più lento mostra un roll non sincronizzato.
- **Normal**: acquisisce solo quando c’è un trigger.
- **Single**: acquisisce una volta e si ferma; si riarma con RUN/STOP.

**Acquire (pp. 41–44)**

| Tasto | Voce |
| --- | --- |
| F1 | **Sample**: un campione per intervallo |
| F2 | **Peak Detect**: coppia minimo/massimo per intervallo, impulsi da 10 ns, attivo da 500 ns/div in su |
| F3 | **Average**: 2–256, scelto con VARIABLE; il numero di medie vale solo con memoria da 500 punti, con memorie più lunghe lo strumento media automaticamente |
| F5 | **Mem Leng**: 500, 1250, 2500, 5000, 12 500, 25 000, 50 000 o 125 000 punti |

Nella foto dell’esperienza Mem Leng è su F5 e F4 è vuoto.

**Display**

| Tasto | Voce |
| --- | --- |
| F1 | **Type**: Vector o Dot (i «punti» del passo cinque) |
| F2 | **Accumulate**: On/Off |
| F3 | **Refresh** |
| F4 | **Contrast**: 0–100%, con VARIABLE |
| F5 | **Graticolo**: assi, solo cornice, griglia completa |

**Cursor (pp. 59–60)**

| Tasto | Voce |
| --- | --- |
| F1 | **Source**: CH1, CH2 o MATH |
| F2 | **Horizontal**: cursori verticali **T1** (linea continua) e **T2** (linea tratteggiata), che misurano il **tempo**; letture T1, T2, Δ e f = 1/Δ |
| F3 | **Vertical**: cursori orizzontali **V1** (continuo) e **V2** (tratteggiato), che misurano la **tensione**; letture V1, V2 e Δ |

F2 e F3 hanno quattro stati: solo il primo cursore mobile, solo il secondo, entrambi (*tracking*, a distanza fissa) oppure spenti. Le letture sono riferite al centro del graticolo. Il nome del menu indica la direzione in cui si spostano i cursori, non quella delle linee: è la confusione segnalata nel passo otto.

**Measure (pp. 61–62)**

F1–F5 mostrano ciascuno una misura per entrambi i canali, fino a 10 valori insieme. Le misure valgono sull’intero record oppure sull’intervallo fra i cursori T.

| Misura | Definizione |
| --- | --- |
| Vpp | Vmax − Vmin |
| Vamp | Vhi − Vlo |
| Vavg | media sul primo ciclo |
| Vrms | valore efficace vero sull’intero record o sull’area selezionata |
| Vhi, Vlo | livelli alto e basso globali |
| Vmax, Vmin | picco positivo e negativo |
| Freq, Period | sul primo ciclo completo |
| Risetime, Falltime | primo fronte di salita o discesa |
| +Width, −Width | primo impulso positivo o negativo, fra i punti al 50% |
| Duty | +Width / Period × 100% |

**Save/Recall (pp. 63–64)**

- F1 sceglie **Setup** o **Waveform**.
- In **Setup**: F2 **Default Setup** (impostazioni di fabbrica, passo quattro); F3 memoria **M01–M15**; F4 **Save**; F5 **Recall**.
- In **Waveform**: F2 sorgente CH1, CH2 o MATH; F3 traccia **Ref A** o **Ref B**; F4 **Save** (salva anche scala e posizione); F5 **Trace On/Off**. VARIABLE sposta la traccia salvata.

**Utility (pp. 45–54)**

- F1 **Printer Menu**: tipo HP; HARDCOPY stampa.
- F2 **Interface Menu**:
  - RS-232: 2400–38 400 baud, stop bit 1 o 2, parità Odd, Even o None;
  - USB;
  - GPIB: indirizzo 1–30.
- F3 **Beep**: tono alto, basso, misto o spento.
- F4 **Language**: undici lingue, italiano compreso.
- F5 **More**: Self Cal, System Inform, Go-No Go Menu, No Go When.

**Go-No Go**
- **Template Edit**:
  - **Max e Min** presi da Ref A e Ref B o dai cento template caricati con FreeCapture, con posizione ±0,04–4 div;
  - **Auto**: template generati dal segnale con tolleranza ±0,4–40%.
- **Source**: CH1 o CH2.
- **Azione** su violazione: Stop, Stop + Beep, Continue o Continue + Beep.
- **Go-No Go On/Off**.
- **Ratio**: violazioni / prove; F5 azzera i contatori.
- **No Go When**: segnala quando il segnale esce dai template oppure quando ci resta dentro.
- Sul retro, l’uscita GO/NO GO dà un impulso TTL da 10 µs a collettore aperto.

**Program (pp. 55–58)**

- **Edit**: F2 **Step** 1–15; F3 **Item** Memory (M1–M15), Menu (Measure o Cursor) o Time (1–99 s, oppure attesa di RUN/STOP); F5 **Save**.
- **Play**: F2 **Cycle** 1–99; F3 **From/To**; F5 **Start**.
- **AUTO TEST/STOP** interrompe la riproduzione.

**Altri tasti**

| Tasto | Funzione |
| --- | --- |
| AUTOSET | regola Volts/div, Time/div e livello di trigger; non funziona sotto **30 Hz** o **30 mV**; F5 **Undo Autoset** |
| RUN/STOP | avvia o ferma l’acquisizione |
| ERASE | cancella le tracce anche in Roll e Accumulate |
| HARDCOPY | stampa lo schermo |
| HELP | guida in linea: si preme un tasto per leggerne la spiegazione e si scorre con VARIABLE |
| ON/STBY | accensione o standby |

**Connettori:** BNC CH1, CH2 ed EXT TRIG, morsetto di massa, uscita di compensazione sonde (2 V, 1 kHz) sotto lo schermo. Sul retro: SELF CAL (DC 0…±2 V), GO/NO GO, USB, porta parallela, RS-232 e GPIB opzionale.

### 2.4 Frequenza di campionamento in funzione di Time/div e memoria (tabella 5-2, p. 43)

| Time/div | 500 | 1250 | 2500 | 5000 | 12 500 | 25 000 | 50 000 | 125 000 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 ns – 100 ns | ET 25 GSa/s – 250 MSa/s | — | — | — | — | — | — | — |
| 250 ns | 100 MSa/s | — | — | — | — | — | — | — |
| 1 µs | 25 MSa/s | 50 M | 100 M | — | — | — | — | — |
| 10 µs | 2,5 MSa/s | 5 M | 10 M | 25 M | 50 M | 100 M | — | — |
| 50 µs | 500 kSa/s | 1 M | 2,5 M | 5 M | 10 M | 25 M | 50 M | 100 M |
| **100 µs** | **250 kSa/s** | 500 k | 1 M | 2,5 M | 5 M | 10 M | 25 M | 50 M |
| 250 µs | 100 kSa/s | 250 k | 500 k | 1 M | 2,5 M | 5 M | 10 M | 25 M |
| **500 µs** | **50 kSa/s** | 100 k | 250 k | 500 k | 1 M | 2,5 M | 5 M | 10 M |
| 1 ms | 25 kSa/s | 50 k | 100 k | 250 k | 500 k | 1 M | 2,5 M | 5 M |
| 10 ms | 2,5 kSa/s | 5 k | 10 k | 25 k | 50 k | 100 k | 250 k | 500 k |
| **100 ms** | **250 Sa/s** | 500 | 1 k | 2,5 k | 5 k | 10 k | 25 k | 50 k |
| 1 s | 25 Sa/s | 50 | 100 | 250 | 500 | 1 k | 2,5 k | 5 k |
| 10 s | 2,5 Sa/s | 5 | 10 | 25 | 50 | 100 | 250 | 500 |

Con la memoria da 500 punti vale **fs = 25 / (Time/div)**. I valori in grassetto sono quelli visti in laboratorio:
- 100 µs/div → 250 kSa/s nel passo dieci;
- 500 µs/div → 50 kSa/s nella foto del display;
- 100 ms/div → 250 Sa/s nel passo sedici: servono 2 s per riempire i 500 punti.

---

## 3. Confronto con il resoconto delle esperienze

| Punto del resoconto | Cosa dice il manuale |
| --- | --- |
| Incertezza dei cursori V (passo otto): «3% della lettura + 5% della divisione + 0,08 mV» | Il manuale indica **±(3% × lettura + 0,05 div × V/div + 0,8 mV)**. Il termine costante è **0,8 mV**, non 0,08 mV |
| Incertezza del periodo (passo nove): «0,1% del valore letto» | L’accuratezza della base dei tempi è **0,01%**. In ogni caso domina il passo di campionamento, come notato nel passo dieci |
| Polo dell’accoppiamento AC a circa 7 Hz (passo sedici) | La banda in AC parte da **10 Hz (−3 dB)** |
| Tempo di salita misurato 23,4 ns (passo diciotto) | La specifica è **< 2,3 ns** per l’oscilloscopio; il generatore ha fronti **< 20 ns**. Un cavo coassiale da 50 Ω pilotato dal generatore adattato introduce solo un ritardo, quindi il valore misurato dipende soprattutto dal fronte del generatore (vedi [verifica-fisica.md](verifica-fisica.md)) |
| FFT in dB (passi dodici e tredici) | **0 dB = 1 Vrms**. Una sinusoide da 1 V di picco dovrebbe leggere circa −3 dB. Il manuale non spiega i −15 dB letti |
| Massima frequenza del generatore 15 MHz (passo diciannove) | Confermata per sinusoide e quadra; triangolo e rampa arrivano solo a 100 kHz |
| Terminazione High Z (passo tre) | All’accensione il 33120A torna sempre a **50 Ω** |

## 4. Come il simulatore applica questi dati

| Aspetto | Comportamento simulato | Fonte |
| --- | --- | --- |
| Frequenza di campionamento | valore 1-2,5-5 non superiore a L/(20 · Time/div), massimo 100 MSa/s; tempo equivalente sotto 250 ns/div con 500 punti; le lunghezze «NA» della tabella non si possono scegliere | tabella 5-2 |
| ADC | 8 bit, 25 livelli per divisione, codici da −128 a +127 attorno al centro: oltre ±5,12 div il segnale satura | manuale d’uso (8 bit) e di programmazione (template da −100 a +100 su 8 div) |
| Memoria e trigger | buffer circolare: prima si riempie il pre-trigger, poi si attende l’evento sul segnale analogico, poi il post-trigger; a 100 ms/div ogni traccia richiede 2 s | dispense, «Gestione della memoria circolare e trigger»; manuale, p. 41 |
| Clock di campionamento | libero rispetto al trigger, con lo sfasamento corretto; in Sample i segnali sottocampionati vanno in aliasing | dispense, campionamento e Nyquist |
| Punti a schermo | 500 punti elaborati, 25 per divisione a schermo (250 col menu, 300 senza); misure e FFT sui 500 punti | manuale, pp. 13 e 21; manuale di programmazione, :ACQuire:POINt |
| Esplorazione del record | da fermo, fino a sette scatti più veloci della Time/div che con 500 punti dà la stessa frequenza di campionamento; la barra della memoria mostra la parte visibile | manuale, p. 21 e figura 5-11 |
| Peak Detect | minimo e massimo su ogni intervallo, da 500 ns/div | manuale, p. 41 |
| Cursori | fissi sullo schermo, a passi di 1/25 di divisione; cambiando Volts/div o Time/div restano nello stesso punto e la lettura, riferita al centro del reticolo, segue la nuova scala | manuale, p. 59; comportamento osservato in laboratorio |
| Misure automatiche | Vhi e Vlo come livello più frequente di ciascuna metà dell'istogramma, oppure massimo e minimo se manca un picco netto (rampe, triangoli); passaggi al 50 % con isteresi del 10 % | manuale, pp. 61–62 |
| Average | media mobile di 2–256 acquisizioni con 500 punti: dopo le prime N ogni acquisizione pesa 1/N, quindi più N è grande più la traccia impiega ad assestarsi (a 500 µs/div circa 0,6 s con 16 medie, 2 s con 64, 9 s con 256 per il 90 %); riparte da capo solo se cambiano le impostazioni dell'oscilloscopio, non il segnale; F3 scorre il numero di medie; con memorie più lunghe media sulle conversioni di ogni intervallo | manuale, p. 42; comportamento osservato in laboratorio |
| Tempo equivalente | asincrono: a ogni trigger i campioni a 100 MSa/s, con sfasamento casuale, riempiono le celle del record | dispense, «Campionamento in tempo equivalente asincrono» |
| Roll | in Roll, e in Auto da 250 ms/div in su, la traccia scorre senza trigger | manuale, pp. 19 e 26 |
| FFT | 500 punti, 0 dB = 1 Vrms, 20/10/5/2/1 dB/div (F5, oppure VOLTS/DIV con MATH selezionato), posizione con VARIABLE, cursori con sorgente MATH (f1, f2, Div, M1, M2) | manuale, pp. 22–24; resoconto, passo dodici |
| Stadio d’ingresso | 1 MΩ ∥ 22 pF; banda del primo ordine a 150 MHz (2,3 ns) o 20 MHz; AC con polo a 10 Hz applicato alla forma d’onda | manuale, cap. 8 |
| Cavi | RG-58 (50 Ω, circa 5 ns/m, 101 pF/m), di partenza 1 m e modificabile da 0 a 5 m. Il cavo del generatore è una linea adattata: solo ritardo, nessuna capacità al nodo. I cavi verso l’oscilloscopio sono tronchi aperti, approssimati dalla loro capacità (valido fino a circa 20 MHz per 1–2 m) | teoria delle linee di trasmissione; verifica con SciPy |
| Sonde ×10 | 10 MΩ ∥ 13 pF alla punta | dispense («10–15 pF») |
| Generatore | frecce di unità in V (Vpp, Vrms, dBm) e in mV con Shift; AM con uscita pari a metà dell'ampiezza a 0 % e all'ampiezza impostata a 100 %; portante del burst fino a 5 MHz; messaggi ENTERED, EXITING, NOT ENTERED, FREQ LIMIT e AMPL LIMIT; cifra lampeggiante della manopola; stato all’accensione di p. 123; DC tenendo premuto Offset per più di 2 s; frequenze AM e FM separate; display con separatori delle migliaia; vincoli \|Voffset\| + Vpp/2 ≤ Vmax e \|Voffset\| ≤ 2·Vpp con «MAX VALUE»/«MIN VALUE»; ampiezza massima ridotta per le arbitrarie (SINC 6,084 Vpp su 50 Ω) | User’s Guide, pp. 19–24, 59–62 e 123 |

**Scelte non documentate dal costruttore**, stimate e dichiarate come tali:
- il rumore d’ingresso: 0,2 mV più 0,02 div efficaci;
- il tempo morto fra due acquisizioni: 10 ms più 0,4 µs per punto; in Average lo strumento fa un'acquisizione ogni record più 5 ms (circa 67 al secondo a 500 µs/div);
- in Peak Detect le conversioni per intervallo sono limitate da un budget di calcolo (circa 2·10⁵ per canale e acquisizione), quindi a velocità molto lente un impulso più stretto dell'intervallo diviso per quel numero può sfuggire;
- il timeout del trigger automatico: 150 ms o la durata del record;
- i valori del Default Setup dell'oscilloscopio (CH1 2 V/div DC, CH2 spento, 1 ms/div, Sample, trigger Edge Auto su CH1): il manuale non li elenca; sono anche l'assetto di apertura del simulatore;
- la sonda ×100 trattata come la ×10;
- il fronte dell’onda quadra del generatore: 20 ns di partenza, il limite dichiarato, modificabile da 1 a 40 ns nel pannello del banco; triangolo, rampa e forme arbitrarie con i 40 ns tipici; la sinusoide senza filtro, piatta fino a 15 MHz come da specifica.

Con il generatore adattato la lunghezza del cavo non cambia né il tempo di salita né l’ampiezza a 15 MHz: il tempo di salita misurato (circa 20 ns) viene dal fronte del generatore. Il taglio fra 15 e 20 MHz osservato in laboratorio non si spiega con il cavo: le cause probabili sono adattatori, puntali o il metodo di misura (vedi [verifica-fisica.md](verifica-fisica.md)).
