CREATE TABLE IF NOT EXISTS chiamate (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ora TEXT NOT NULL,
  tavolo TEXT NOT NULL,
  stato TEXT NOT NULL DEFAULT 'IN ATTESA'
);

CREATE TABLE IF NOT EXISTS impostazioni (
  chiave TEXT PRIMARY KEY,
  valore TEXT NOT NULL
);

INSERT OR IGNORE INTO impostazioni (chiave, valore) VALUES ('chiamaCameriere', '0');

CREATE TABLE IF NOT EXISTS iscrizioni (
  endpoint TEXT PRIMARY KEY,
  fila TEXT NOT NULL,
  creata TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iscrizioni_fila ON iscrizioni (fila);

CREATE TABLE IF NOT EXISTS telegram (
  chat_id TEXT PRIMARY KEY,
  fila TEXT NOT NULL,
  nome TEXT,
  creata TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telegram_fila ON telegram (fila);

CREATE TABLE IF NOT EXISTS codici_telegram (
  codice TEXT PRIMARY KEY,
  fila TEXT NOT NULL,
  scade INTEGER NOT NULL
);
