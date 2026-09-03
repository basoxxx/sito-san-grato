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
6. Apri la dashboard (`admin.html` del sito):
   - incolla l'URL nel campo "URL backend" e salva
   - premi "Attiva sezione"
7. Fatto! Online in 1-2 minuti.

## Come funziona

- Il cliente inquadra il QR del suo tavolo (es. `...?tavolo=5`),
  in fondo al menù trova il pulsante "Chiama il cameriere"
- Alla pressione, arriva una riga sul Foglio Google con ora e numero tavolo
- I camerieri tengono aperto il foglio su un telefono/tablet e
  segnano "FATTO" quando passano

## QR code per i tavoli

Ogni tavolo ha il suo link:
`https://basoxxx.github.io/sito-san-grato/?tavolo=1` (2, 3, ...)

## Pagina chiamate per i camerieri

I camerieri non devono usare il Foglio Google direttamente: c'è la pagina
`https://basoxxx.github.io/sito-san-grato/chiamate.html`
che mostra le chiamate in attesa (si aggiorna da sola ogni 10 secondi),
con pulsante **Fatto** per segnarle come servite e vibrazione
quando arriva una chiamata nuova.

**Nota**: se avevi già distribuito una versione vecchia di `Code.gs`,
incolla la versione aggiornata e ripubblica con
**Distribuisci → Gestisci distribuzioni → Modifica → Nuova versione**.
