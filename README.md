# Banco RC

Simulatore del generatore HP 33120A, dell’oscilloscopio GW Instek GDS-820C e del circuito RC collegato ai due canali. Inizialmente il generatore è impostato su 1 Vpp a 870 Hz. Il preset usa R = 2,2 kΩ e C = 82 nF come valori stimati per avvicinare le tracce della foto.

Apri [banco-rc.html](banco-rc.html) in un browser per usare la versione autonoma. Il file contiene gli stili e gli script. La versione con sorgenti separati si avvia da [index.html](index.html).

- [Manuali e riferimenti](docs/riferimenti.md) e [schede degli strumenti dai manuali](docs/manuali.md)
- [Schermata desktop](docs/evidenze/desktop.png) e [schermata mobile](docs/evidenze/mobile.png)
- [Riquadro del display fotografato](docs/evidenze/photo-lcd.png) e [riquadro del circuito fotografato](docs/evidenze/photo-rc.png)
- [Campioni CSV](docs/esportazioni/GDS-820C-campioni.csv) e [schermata PNG esportata](docs/esportazioni/GDS-820C-display.png)
- [Verifica indipendente della fisica con SciPy](docs/verifica-fisica.md)
- [Test analitico](tests/physics.cjs), [test in Chrome](tests/browser.mjs) e [test HTML autonomo](tests/standalone-browser.mjs)

## Installarlo come app

Banco RC è una PWA: servito via http(s) si installa dal browser (icona «Installa» nella barra degli indirizzi su Chrome ed Edge, «Aggiungi a Home» su telefono), si apre a schermo intero e funziona anche offline. Per provarlo sul proprio computer:

```bash
python3 -m http.server 8000
```

Poi apri http://localhost:8000/index.html. Per averlo online, pubblica la cartella con GitHub Pages. La versione autonoma `banco-rc.html` resta un file unico da aprire direttamente, senza installazione.

## Verifica locale

Dopo ogni modifica a `index.html`, `style.css`, `physics.js` o `bench.js` rigenera la versione autonoma con `node tools/build-standalone.mjs`.

Esegui `node tests/physics.cjs` per verificare guadagno, fase, frequenza di taglio, risposta al gradino e FFT. I due test browser richiedono Node.js 22.4+ e un profilo Chrome di test avviato con `--remote-debugging-port=9238` e un `--user-data-dir` separato. Esegui `node tests/browser.mjs` oppure `node tests/standalone-browser.mjs`. `node tests/conformita.mjs` confronta il simulatore con i manuali: tutte le celle della tabella 5-2, ADC, misure, FFT, cursori, trigger, sonde, memoria, tempo di salita e limiti del generatore. I test stampano la directory temporanea delle proprie schermate ed esportazioni.

L’interfaccia interpreta i pannelli fisici. Il modello di acquisizione segue il manuale del GDS-820C (campionamento, ADC a 8 bit, memoria, 500 punti elaborati) ed è descritto in [docs/manuali.md](docs/manuali.md). La fedeltà al firmware è parziale e R, C e lunghezza dei cavi sono parametri di simulazione.
