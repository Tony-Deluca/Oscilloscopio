# Verifica indipendente della fisica con SciPy

Il modello fisico di `physics.js` è stato ricalcolato da zero con NumPy 2.5 e SciPy 1.18, partendo solo dai valori dei componenti e senza usare il codice del simulatore. Gli script sono in `tools/verifica-scipy/` e si rilanciano così:

```bash
node tools/verifica-scipy/export.cjs valori.json
```

```bash
python3 tools/verifica-scipy/verify.py valori.json
```

Il primo esporta i valori del simulatore, il secondo li confronta con i calcoli indipendenti. **Risultato attuale: 39 confronti su 39 concordano.**

## Cosa è verificato

| Aspetto | Verifica indipendente | Esito |
| --- | --- | --- |
| Rete RC caricata da canali e cavi | Analisi nodale scritta da zero, con il ritardo del cavo, da 10 Hz a 10 MHz | Scarto 10⁻¹⁵ |
| Taglio a −3 dB della scheda | Bisezione su \|OUT/IN\| | Uguale entro lo 0,2 % |
| Guadagno e fase a 870 Hz | Stesso modello nodale | Uguali entro 10⁻⁹ |
| Quadra a 100 Hz e 1 kHz in regime periodico | `scipy.signal.lsim` con il fronte del generatore | Scarto inferiore a 1 mV su 2 V |
| Stadio d'ingresso: AC a 10 Hz, banda 150 o 20 MHz | Funzioni di trasferimento analitiche | Scarto 10⁻¹⁶ |
| Quadra a 10 Hz deformata dall'accoppiamento AC | `lsim` del passa-alto | Scarto 5·10⁻¹⁰ V; picco 1,917 V come da teoria |
| Cavo RG-58 da 0 a 2 m nel collegamento diretto | Linea di trasmissione con perdite (matrice ABCD), fronte del generatore e banda dell'oscilloscopio | Tempo di salita entro 0,5 ns, \|H\| a 15 MHz entro l'1,3 % (le perdite del cavo non sono simulate) |
| FFT su 500 punti con le quattro finestre | `numpy.fft` e finestre simmetriche di `scipy.signal.windows` | Scarto 10⁻¹⁵; 1,0607 Vrms per 1,5 V di picco |
| Misure automatiche (Vrms, frequenza, tempo di salita) | NumPy e formule analitiche (τ·ln 9) | Accordo entro lo 0,5 % |
| Aliasing: 870 Hz campionati a 250 Sa/s | FFT dei campioni del modello | 120 Hz come previsto |
| AM al 100 % e allo 0 % | Definizione della User's Guide | 0,994 e 0,5 Vpp con 1 Vpp impostato |
| ADC a 8 bit con 25 livelli per divisione | SINAD di una sinusoide a pieno schermo | 47,9 dB contro 47,8 dB teorici; circa 7,6 bit effettivi |

## Correzione applicata: i cavi come linee di trasmissione

La prima verifica aveva mostrato che il vecchio modello dei cavi non aveva senso fisico. Quel modello trattava ogni cavo come una capacità di 101 pF/m che carica l'uscita a 50 Ω del generatore. Con una sorgente adattata (Rs = Z0 = 50 Ω), invece, l'induttanza del cavo compensa la sua capacità e il cavo è solo un **ritardo**. Al suo capo il circuito vede di nuovo un generatore da 50 Ω con la tensione ritardata di l/v, circa 5 ns/m. Questo risultato è esatto per qualsiasi carico.

| Cavo | Tempo di salita, modello vecchio | Linea di trasmissione |
| --- | --- | --- |
| 1 m | 13,8 ns | 3,7 ns più il fronte del generatore |
| 2 m | 24,7 ns | 3,8 ns più il fronte del generatore |

Ora il simulatore:
- tratta il **cavo del generatore** come linea adattata: solo ritardo, nessuna capacità al nodo;
- tratta i **cavi verso l'oscilloscopio**, che partono da un nodo e finiscono sull'ingresso ad alta impedenza, come tronchi aperti. Fino a circa 20 MHz per 1–2 m si comportano come la loro capacità (101 pF/m): a 15 MHz con 1 m la differenza dalla linea esatta è circa l'8 %;
- dà all'**onda quadra del generatore** un fronte finito: 20 ns di partenza, il limite dichiarato, modificabile da 1 a 40 ns nel pannello del banco. Triangolo, rampa e forme arbitrarie hanno i 40 ns tipici della specifica; la sinusoide resta piatta fino a 15 MHz.

**Effetto sulle misure di laboratorio.** Il tempo di salita misurato nel collegamento diretto è ora circa 20,4 ns e non dipende dalla lunghezza del cavo. Viene dal fronte del generatore, sommato al nodo 50 Ω × 22 pF e alla banda dell'oscilloscopio, ed è vicino ai 23,4 ns misurati in laboratorio per la ragione giusta.

L'attenuazione intorno a 15 MHz che alcuni di voi hanno visto non si spiega con il cavo coassiale: a 15 MHz la linea attenua meno del 3 %. Le cause plausibili sono:
- adattatori o puntali a coccodrillo, che non sono linee adattate;
- il metodo di misura: in Sample a 100 MSa/s una sinusoide a 15 MHz ha circa 6,7 campioni per periodo, e il Vpp può risultare più basso fino a circa l'11 %.

## Scelte di modello ancora approssimate

- **Stadio d'ingresso del primo ordine.** Uno strumento reale ha una risposta più vicina a quella gaussiana, con lo stesso tempo di salita di 2,3 ns.
- **Accoppiamento AC.** Il polo resta a 10 Hz anche con le sonde ×10, mentre la resistenza della sonda lo abbasserebbe.
- **Perdite dei cavi.** Non sono simulate: meno del 3 % a 15 MHz per 2 m.
- **Rumore d'ingresso.** È stimato, perché il costruttore non lo dichiara.
