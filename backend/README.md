# Backend "Chiama il cameriere" — Cloudflare Workers

Server dedicato, gratuito, sempre attivo. Database D1 (SQLite) incluso.

## Autorizzazioni

| Operazione | Chi | Come |
|---|---|---|
| Creare una chiamata | clienti | libero, ma solo a sezione attiva e solo dal sito ufficiale |
| Vedere le chiamate | camerieri | codice staff (`TOKEN_STAFF`) |
| Segnare "Fatto" | camerieri | codice staff (`TOKEN_STAFF`) |
| Attivare/spegnere la sezione | gestore | codice gestore (`TOKEN_ADMIN`) |

I codici sono **secret del Worker**: non stanno nel sito, non sono nel repository.
Per cambiarli:

```bash
cd backend
npx wrangler secret put TOKEN_STAFF   # oppure TOKEN_ADMIN
npx wrangler deploy
```

Dopo un cambio, i camerieri reinseriscono il codice in `chiamate.html` (tasto "Esci"
e poi il codice nuovo).

## API

- `GET /?azione=stato` → `{chiamaCameriere: bool}` — pubblico, lo usa il menù
- `POST /` `{"tavolo": "Fila B · tavolo 14"}` → registra una chiamata (formato validato)
- `GET /?azione=lista` + `Authorization: Bearer <codice staff>` → ultime 100 chiamate
- `POST /` `{"azione": "fatto", "id": 12}` + codice staff → segna come servita
- `POST /` `{"azione": "impostazioni", "chiamaCameriere": true}` + codice gestore

Tutti i POST richiedono `Content-Type: application/json`.
Le richieste da browser sono accettate solo dall'origine `https://basoxxx.github.io`.

## Deploy

```bash
npx wrangler login
npx wrangler d1 execute san-grato-chiamate --remote --file=schema.sql
npx wrangler deploy
```

## Notifiche ai camerieri

Ogni cameriere apre `cameriere.html`, inserisce il codice staff, sceglie la sua
fila e preme **Attiva notifiche**. Il telefono si registra al servizio di
notifiche del sistema operativo e il Worker lo sveglia quando arriva una
chiamata **della sua fila**.

Dettagli tecnici:

- Chiavi VAPID: pubblica in `wrangler.toml` (`VAPID_PUBLIC`), privata come
  secret (`VAPID_PRIVATE`, formato JWK). Per rigenerarle serve reiscrivere
  tutti i telefoni.
- La notifica non contiene dati: e' solo una "sveglia". E' `sw.js` sul telefono
  che poi chiede al server quali tavoli stanno chiamando.
- Le iscrizioni stanno nella tabella `iscrizioni` (endpoint, fila). Quando il
  servizio di notifiche risponde 404 o 410 l'iscrizione viene tolta da sola.
- Su iPhone le notifiche funzionano **solo** se la pagina viene aggiunta alla
  schermata Home (Condividi -> Aggiungi a Home) e con iOS 16.4 o piu' recente.
  Su Android funzionano anche dal browser.
- Con la pagina aperta il cameriere sente comunque suono e vibrazione, anche
  senza notifiche di sistema.


## Notifiche via Telegram (alternativa, funziona uguale su iPhone e Android)

Il cameriere apre `cameriere.html`, sceglie la fila e preme **«Ricevi le
chiamate su Telegram»**: si apre il bot, preme *Avvia* e da quel momento riceve
un messaggio Telegram a ogni chiamata della sua fila. Per smettere scrive
`/stop` al bot.

### Come collegare il bot (una volta sola)

1. Su Telegram scrivi a **@BotFather**, comando `/newbot`, e segui le
   istruzioni. Ti da' un token lungo tipo `123456:AAF...`.
2. Metti il token fra i secret del Worker (il token non passa da nessun'altra
   parte):

   ```bash
   cd backend
   npx wrangler secret put TELEGRAM_TOKEN
   npx wrangler deploy
   ```

3. Collega il bot al server (una sola chiamata, serve il codice gestore):

   ```bash
   curl -X POST https://san-grato-backend.san-grato-rivara.workers.dev \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer IL_TUO_CODICE_GESTORE" \
     -d '{"azione":"telegramWebhook"}'
   ```

Se non fai nulla di tutto questo il sistema resta semplicemente spento: la
pagina cameriere non mostra il pulsante Telegram e tutto il resto funziona
come prima.

### Come funziona

- `codici_telegram`: codici usa e getta (15 minuti) che legano il link alla
  fila giusta. Il codice staff non finisce mai dentro il link.
- `telegram`: le registrazioni (chat, fila). Se un cameriere blocca il bot la
  registrazione si cancella da sola.
- Il webhook accetta solo richieste con l'intestazione segreta che Telegram
  invia (`TELEGRAM_WEBHOOK_SECRET`).

## Pagine

- Menu: `https://basoxxx.github.io/sito-san-grato/`
- Cameriere (una fila): `.../cameriere.html` — codice staff
- Tutte le file (bar/cassa): `.../chiamate.html` — codice staff
- Gestione: `.../admin.html` — codice gestore
