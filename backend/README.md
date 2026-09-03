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

## Pagine

- Menù: `https://basoxxx.github.io/sito-san-grato/`
- Camerieri: `.../chiamate.html` (serve il codice staff)
- Gestione: `.../admin.html` (serve il codice gestore)
