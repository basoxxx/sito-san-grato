# Backend "Chiama il cameriere" — Cloudflare Workers

Server dedicato, gratuito (100.000 richieste/giorno), sempre attivo.
Database D1 (SQLite) incluso. Niente Google Sheets.

## API

- `POST /` con `{"tavolo": "5"}` → registra una chiamata
- `GET /?azione=lista` → ultime 100 chiamate
- `POST /` con `{"azione": "fatto", "id": 12}` → segna come servita

## Deploy (già fatto da Claude)

```bash
npx wrangler login                      # login con l'account Cloudflare
npx wrangler d1 create san-grato-chiamate   # crea il database (copia l'id in wrangler.toml)
npx wrangler d1 execute san-grato-chiamate --remote --file=schema.sql
npx wrangler deploy                     # pubblica il worker
```

L'URL del worker va in `config.json` → `backendUrl`.

## Pagina chiamate per i camerieri

`https://basoxxx.github.io/sito-san-grato/chiamate.html`
mostra le chiamate in attesa (aggiornamento automatico ogni 10 secondi),
con pulsante **Fatto** e vibrazione alle nuove chiamate.
