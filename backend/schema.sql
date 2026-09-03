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
