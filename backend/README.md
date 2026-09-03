# Backend "Chiama il cameriere" — istruzioni di attivazione

Costo: **zero**. Serve solo un account Google.

## Come attivarlo (5 minuti)

1. Vai su [sheets.google.com](https://sheets.google.com) e crea un foglio
   chiamato **"Chiamate camerieri"** con le colonne: Ora | Tavolo | Stato
2. Nel foglio: menu **Estensioni → Apps Script**
3. Cancella il codice di esempio e incolla il contenuto di `Code.gs`
4. Clicca **Distribuisci → Nuova distribuzione**
   - Tipo: **App web**
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
5. Copia l'**URL della web app** (finisce con `/exec`)
6. Nel file `config.js` del sito:
   - incolla l'URL in `backendUrl`
   - metti `chiamaCameriere: true`
7. Fai il push su GitHub — fatto!

## Come funziona

- Il cliente inquadra il QR del suo tavolo (es. `...?tavolo=5`),
  in fondo al menù trova il pulsante "Chiama il cameriere"
- Alla pressione, arriva una riga sul Foglio Google con ora e numero tavolo
- I camerieri tengono aperto il foglio su un telefono/tablet e
  segnano "FATTO" quando passano

## QR code per i tavoli

Ogni tavolo ha il suo link:
`https://basoxxx.github.io/sito-san-grato/?tavolo=1` (2, 3, ...)
