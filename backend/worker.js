// ============================================
// BACKEND "CHIAMA IL CAMERIERE" - San Grato
// Cloudflare Worker + database D1
//
// Autorizzazioni:
//   - creare una chiamata  -> libero (i clienti), solo se la sezione e' attiva
//   - vedere le chiamate   -> codice staff  (TOKEN_STAFF)
//   - segnare come servita -> codice staff  (TOKEN_STAFF)
//   - attivare/spegnere    -> codice admin  (TOKEN_ADMIN)
// I codici sono "secret" del Worker, non stanno nel sito.
// ============================================

const ORIGINE_CONSENTITA = "https://basoxxx.github.io";

function intestazioniCors(richiesta) {
  const origine = richiesta.headers.get("Origin");
  const h = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  // Solo il sito ufficiale puo' parlare col server da browser.
  if (origine === ORIGINE_CONSENTITA) {
    h["Access-Control-Allow-Origin"] = origine;
  }
  return h;
}

function json(oggetto, status, richiesta) {
  return new Response(JSON.stringify(oggetto), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...intestazioniCors(richiesta) },
  });
}

// Confronto a tempo costante: non rivela quanti caratteri del codice sono giusti.
function codiciUguali(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let differenza = 0;
  for (let i = 0; i < a.length; i++) differenza |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return differenza === 0;
}

function autorizzato(richiesta, codiceAtteso) {
  if (!codiceAtteso) return false;
  const intestazione = richiesta.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(intestazione);
  return !!m && codiciUguali(m[1].trim(), codiceAtteso);
}

async function sezioneAttiva(env) {
  const riga = await env.DB.prepare(
    "SELECT valore FROM impostazioni WHERE chiave = 'chiamaCameriere'"
  ).first();
  return !!riga && riga.valore === "1";
}

// ---------- NOTIFICHE PUSH (VAPID) ----------

function base64url(buffer) {
  let binario = "";
  const byte = new Uint8Array(buffer);
  for (let i = 0; i < byte.length; i++) binario += String.fromCharCode(byte[i]);
  return btoa(binario).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function firmaVapid(env, destinatario) {
  const testo = new TextEncoder();
  const testa = base64url(testo.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = base64url(
    testo.encode(
      JSON.stringify({
        aud: destinatario,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: ORIGINE_CONSENTITA + "/sito-san-grato/",
      })
    )
  );
  const chiave = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(env.VAPID_PRIVATE),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const firma = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    chiave,
    testo.encode(testa + "." + corpo)
  );
  return testa + "." + corpo + "." + base64url(firma);
}

// Sveglia i telefoni dei camerieri di quella fila. Nessun dato viaggia nella
// notifica: il telefono, una volta svegliato, chiede al server cosa e' arrivato.
async function avvisaFila(env, fila) {
  const { results } = await env.DB.prepare(
    "SELECT endpoint FROM iscrizioni WHERE fila = ?"
  ).bind(fila).all();

  const firmePerServizio = {};
  for (const riga of results) {
    try {
      const servizio = new URL(riga.endpoint).origin;
      if (!firmePerServizio[servizio]) firmePerServizio[servizio] = await firmaVapid(env, servizio);
      const risposta = await fetch(riga.endpoint, {
        method: "POST",
        headers: {
          TTL: "120",
          Urgency: "high",
          Authorization: "vapid t=" + firmePerServizio[servizio] + ", k=" + env.VAPID_PUBLIC,
        },
      });
      // Iscrizione non piu' valida (telefono cambiato, app disinstallata): la tolgo.
      if (risposta.status === 404 || risposta.status === 410) {
        await env.DB.prepare("DELETE FROM iscrizioni WHERE endpoint = ?").bind(riga.endpoint).run();
      }
    } catch (e) {
      // una notifica fallita non deve bloccare le altre
      console.log("notifica fallita:", e && e.message);
    }
  }
}

export default {
  async fetch(richiesta, env, ctx) {
    if (richiesta.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: intestazioniCors(richiesta) });
    }

    const url = new URL(richiesta.url);
    const azioneGet = url.searchParams.get("azione");

    // ---------- LETTURE ----------
    if (richiesta.method === "GET") {
      // Stato della sezione: pubblico, serve al menu per sapere se mostrarla.
      if (azioneGet === "stato") {
        return json({ ok: true, chiamaCameriere: await sezioneAttiva(env) }, 200, richiesta);
      }

      // Elenco chiamate: solo staff.
      if (azioneGet === "lista") {
        if (!autorizzato(richiesta, env.TOKEN_STAFF)) {
          return json({ ok: false, errore: "codice non valido" }, 401, richiesta);
        }
        const { results } = await env.DB.prepare(
          "SELECT id, ora, tavolo, stato FROM chiamate ORDER BY id DESC LIMIT 100"
        ).all();
        return json({ ok: true, chiamate: results }, 200, richiesta);
      }

      if (azioneGet === "vapid") {
        return json({ ok: true, chiave: env.VAPID_PUBLIC || "" }, 200, richiesta);
      }

      return json({ ok: true, servizio: "San Grato" }, 200, richiesta);
    }

    // ---------- SCRITTURE ----------
    if (richiesta.method === "POST") {
      // Obbliga il preflight per le richieste da altri siti: senza questo
      // controllo un POST cross-site passerebbe senza che il browser chieda il permesso.
      const tipo = richiesta.headers.get("Content-Type") || "";
      if (!tipo.includes("application/json")) {
        return json({ ok: false, errore: "Content-Type richiesto" }, 415, richiesta);
      }

      let dati;
      try {
        dati = await richiesta.json();
      } catch {
        return json({ ok: false, errore: "JSON non valido" }, 400, richiesta);
      }

      // Attiva o spegne la sezione (dashboard).
      if (dati.azione === "impostazioni") {
        if (!autorizzato(richiesta, env.TOKEN_ADMIN)) {
          return json({ ok: false, errore: "codice non valido" }, 401, richiesta);
        }
        const valore = dati.chiamaCameriere ? "1" : "0";
        await env.DB.prepare(
          "INSERT INTO impostazioni (chiave, valore) VALUES ('chiamaCameriere', ?) " +
            "ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore"
        ).bind(valore).run();
        return json({ ok: true, chiamaCameriere: valore === "1" }, 200, richiesta);
      }

      // Il cameriere accende le notifiche per la sua fila.
      if (dati.azione === "iscrizione") {
        if (!autorizzato(richiesta, env.TOKEN_STAFF)) {
          return json({ ok: false, errore: "codice non valido" }, 401, richiesta);
        }
        const endpoint = String(dati.endpoint || "");
        const fila = String(dati.fila || "").toUpperCase();
        if (!/^https:\/\//.test(endpoint) || endpoint.length > 500 || !/^[A-H]$/.test(fila)) {
          return json({ ok: false, errore: "dati non validi" }, 400, richiesta);
        }
        await env.DB.prepare(
          "INSERT INTO iscrizioni (endpoint, fila, creata) VALUES (?, ?, ?) " +
            "ON CONFLICT(endpoint) DO UPDATE SET fila = excluded.fila"
        ).bind(endpoint, fila, new Date().toISOString()).run();
        return json({ ok: true }, 200, richiesta);
      }

      if (dati.azione === "disiscrizione") {
        if (!autorizzato(richiesta, env.TOKEN_STAFF)) {
          return json({ ok: false, errore: "codice non valido" }, 401, richiesta);
        }
        await env.DB.prepare("DELETE FROM iscrizioni WHERE endpoint = ?")
          .bind(String(dati.endpoint || "")).run();
        return json({ ok: true }, 200, richiesta);
      }

      // Segna una chiamata come servita (staff).
      if (dati.azione === "fatto") {
        if (!autorizzato(richiesta, env.TOKEN_STAFF)) {
          return json({ ok: false, errore: "codice non valido" }, 401, richiesta);
        }
        const id = parseInt(dati.id, 10);
        if (!id) return json({ ok: false, errore: "id mancante" }, 400, richiesta);
        await env.DB.prepare("UPDATE chiamate SET stato = 'FATTO' WHERE id = ?").bind(id).run();
        return json({ ok: true }, 200, richiesta);
      }

      // Nuova chiamata dal menu (clienti): solo a sezione attiva.
      if (!(await sezioneAttiva(env))) {
        return json({ ok: false, errore: "servizio non attivo" }, 403, richiesta);
      }

      const tavolo = String(dati.tavolo || "").trim().slice(0, 25);
      if (!/^Fila [A-H] · tavolo [0-9]{1,3}$/.test(tavolo)) {
        return json({ ok: false, errore: "tavolo non valido" }, 400, richiesta);
      }

      // Anti-doppione: ignora se lo stesso tavolo ha gia' una chiamata in attesa.
      const esistente = await env.DB.prepare(
        "SELECT id FROM chiamate WHERE tavolo = ? AND stato = 'IN ATTESA' LIMIT 1"
      ).bind(tavolo).first();
      if (esistente) return json({ ok: true, doppione: true }, 200, richiesta);

      await env.DB.prepare(
        "INSERT INTO chiamate (ora, tavolo, stato) VALUES (?, ?, 'IN ATTESA')"
      ).bind(new Date().toISOString(), tavolo).run();

      // Avvisa i telefoni dei camerieri di quella fila senza far aspettare il cliente.
      const fila = tavolo.charAt(5);
      ctx.waitUntil(avvisaFila(env, fila));

      return json({ ok: true }, 200, richiesta);
    }

    return json({ ok: false, errore: "metodo non supportato" }, 405, richiesta);
  },
};
