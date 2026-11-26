# Verifica indipendente della fisica con SciPy

Il modello fisico di `physics.js` è stato ricalcolato da zero con NumPy 2.5 e SciPy 1.18, partendo solo dai valori dei componenti, senza usare il codice del simulatore. Gli script sono in `tools/verifica-scipy/` e si rilanciano così:

```bash
node tools/verifica-scipy/export.cjs valori.json
```

```bash
python3 tools/verifica-scipy/verify.py valori.json
```

Il primo esporta i valori del simulatore, il secondo li confronta con i calcoli indipendenti. **Risultato: 34 confronti su 34 concordano.** C'è però un'osservazione importante sul modello dei cavi: il calcolo di quel modello è corretto, ma non lo è il modello stesso.

## Cosa è corretto

| Aspetto | Verifica indipendente | Esito |
| --- | --- | --- |
| Rete RC caricata da canali e cavi | Analisi nodale scritta da zero, da 10 Hz a 10 MHz | Scarto 8·10⁻¹⁶ |
| Taglio a −3 dB della scheda | Bisezione su \|OUT/IN\| | 882,85 Hz in entrambi |
| Guadagno e fase a 870 Hz | Stesso modello nodale | 0,7107 e −44,58° in entrambi |
| Quadra a 100 Hz e 1 kHz in regime periodico | `scipy.signal.lsim` su 30 periodi | Scarto ≤ 4,7 mV su 2 V, dovuto al passo del riferimento |
| Stadio d'ingresso: AC a 10 Hz, banda 150 o 20 MHz | Funzioni di trasferimento analitiche | Scarto 10⁻¹⁶ |
| Quadra a 10 Hz deformata dall'accoppiamento AC | `lsim` del passa-alto | Scarto 5·10⁻¹⁰ V; picco 1,917 V come da teoria |
| FFT su 500 punti con le quattro finestre | `numpy.fft` e finestre simmetriche di `scipy.signal.windows` | Scarto 10⁻¹⁵; 1,0607 Vrms per 1,5 V di picco |
| Misure automatiche (Vrms, frequenza, tempo di salita) | NumPy e formule analitiche (τ·ln 9) | Accordo entro lo 0,5 % |
| Aliasing: 870 Hz campionati a 250 Sa/s | FFT dei campioni del modello | 120 Hz come previsto |
| AM al 100 % e allo 0 % | Definizione della User's Guide | 0,994 e 0,5 Vpp con 1 Vpp impostato |
| ADC a 8 bit con 25 livelli per divisione | SINAD di una sinusoide a pieno schermo | 47,9 dB contro 47,8 dB teorici; il pieno schermo usa 200 dei 256 livelli, circa 7,6 bit effettivi |

Il circuito RC, lo stadio d'ingresso, la FFT, le misure, il campionamento e l'ADC sono corretti e hanno senso fisico.

## Cosa non ha senso fisico: i cavi come capacità concentrata

Il simulatore tratta ogni cavo come una capacità di 101 pF/m collegata al nodo, che carica l'uscita a 50 Ω del generatore. La verifica conferma che il calcolo di questo modello è giusto. Il modello però non descrive bene un cavo coassiale da 50 Ω pilotato da un generatore con uscita da 50 Ω.

Con la teoria della linea di trasmissione (RG-58: Z0 = 50 Ω, fattore di velocità 0,66, perdite di circa 4,6 dB/100 m a 10 MHz), una sorgente adattata (Rs = Z0) e un carico ad alta impedenza (1 MΩ ∥ 22 pF), l'induttanza del cavo compensa la sua capacità. Il cavo diventa un semplice **ritardo** di circa 5 ns/m. L'unico passa-basso rimasto è Z0 × 22 pF, cioè circa 1,1 ns, con taglio intorno a 145 MHz.

| Cavo | Tempo di salita del simulatore | Linea di trasmissione | \|H\| a 15 MHz nel simulatore | \|H\| a 15 MHz secondo la linea |
| --- | --- | --- | --- | --- |
| 0 m | 3,6 ns | 3,6 ns | 0,99 | 0,99 |
| 0,5 m | 8,5 ns | 3,6 ns | 0,94 | 0,99 |
| 1 m | 13,8 ns | 3,7 ns | 0,86 | 0,98 |
| 1,5 m | 19,3 ns | 3,8 ns | 0,77 | 0,98 |
| 2 m | 24,7 ns | 3,8 ns | 0,68 | 0,98 |

Il modello a capacità concentrata vale solo per cavi elettricamente corti e sorgenti non adattate. A 15 MHz la lunghezza d'onda nel cavo è circa 13 m, quindi già 1–2 m non sono «corti». Con il generatore adattato il modello sovrastima molto l'effetto del cavo.

**Conseguenza.** Avevamo detto che con circa 2 m di cavo il simulatore riproduce i 23,4 ns e il taglio intorno a 15 MHz misurati in laboratorio, e anche il resoconto attribuisce quelle misure al cavo. La fisica non sostiene questa spiegazione. Le cause più probabili, da confermare, sono:
- **tempo di salita:** il fronte del generatore stesso, dichiarato «< 20 ns», sommato a quello dell'oscilloscopio (2,3 ns);
- **attenuazione a 15 MHz:** adattatori o puntali a coccodrillo, oppure il metodo di misura. A 100 MSa/s, in Sample, una sinusoide a 15 MHz ha circa 6,7 campioni per periodo, e il Vpp letto può risultare più basso fino a circa l'11%.

## Proposte di modifica (non applicate)

1. **Cavi come linee di trasmissione.** Un cavo pilotato dal generatore adattato introduce solo ritardo e il piccolo passa-basso Z0·C del carico. I cavi in più collegati con un raccordo a T diventano stub aperti, con un carico che dipende dalla frequenza. Alle frequenze del circuito RC non cambia nulla.
2. **Fronte finito del generatore.** Aggiungere il tempo di salita della quadra, dichiarato «< 20 ns», come parametro, così il tempo di salita misurato torna nell'ordine dei 20 ns per la ragione giusta.
3. **Documentazione.** Correggere in `docs/manuali.md` la frase sui 2 m di cavo che riproducono le misure di laboratorio.

Restano scelte di modello accettabili, già dichiarate: lo stadio d'ingresso del primo ordine (uno strumento reale ha una risposta più vicina a quella gaussiana, con lo stesso tempo di salita), il polo dell'accoppiamento AC fisso a 10 Hz anche con le sonde ×10, il rumore d'ingresso stimato.
