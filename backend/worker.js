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


// ---------- NOTIFICHE TELEGRAM ----------
// Alternativa alle notifiche web: funziona uguale su iPhone e Android senza
// installare nulla. Il cameriere si registra una volta sola con un link.

function telegramAttivo(env) {
  return !!(env.TELEGRAM_TOKEN && env.TELEGRAM_TOKEN.length > 20);
}

async function telegramApi(env, metodo, corpo) {
  const risposta = await fetch(
    "https://api.telegram.org/bot" + env.TELEGRAM_TOKEN + "/" + metodo,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo || {}),
    }
  );
  return await risposta.json();
}

async function avvisaTelegram(env, fila, tavolo) {
  if (!telegramAttivo(env)) return;
  const { results } = await env.DB.prepare(
    "SELECT chat_id FROM telegram WHERE fila = ?"
  ).bind(fila).all();
  for (const riga of results) {
    try {
      const esito = await telegramApi(env, "sendMessage", {
        chat_id: riga.chat_id,
        text: "\uD83D\uDD14 " + tavolo + "\nTi stanno chiamando.",
      });
      // Chat bloccata o cancellata: tolgo la registrazione.
      if (esito && esito.ok === false && (esito.error_code === 403 || esito.error_code === 400)) {
        await env.DB.prepare("DELETE FROM telegram WHERE chat_id = ?").bind(riga.chat_id).run();
      }
    } catch (e) {
      console.log("telegram fallito:", e && e.message);
    }
  }
}

// Riceve i messaggi inviati al bot (registrazione dei camerieri).
async function gestisciTelegram(richiesta, env) {
  if (
    env.TELEGRAM_WEBHOOK_SECRET &&
    richiesta.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return new Response("no", { status: 401 });
  }

  let aggiornamento;
  try {
    aggiornamento = await richiesta.json();
  } catch {
    return new Response("ok");
  }

  const messaggio = aggiornamento.message || aggiornamento.edited_message;
  if (!messaggio || !messaggio.chat) return new Response("ok");

  const chat = String(messaggio.chat.id);
  const testo = String(messaggio.text || "").trim();
  const nome = String((messaggio.from && messaggio.from.first_name) || "").slice(0, 40);

  async function rispondi(testoRisposta) {
    await telegramApi(env, "sendMessage", { chat_id: chat, text: testoRisposta });
    return new Response("ok");
  }

  if (/^\/stop/.test(testo)) {
    await env.DB.prepare("DELETE FROM telegram WHERE chat_id = ?").bind(chat).run();
    return await rispondi("Va bene, non ti mando piu' le chiamate. Per ricominciare usa di nuovo il link dalla pagina cameriere.");
  }

  const avvio = /^\/start(?:\s+(\S+))?/.exec(testo);
  if (avvio) {
    const codice = (avvio[1] || "").toUpperCase();
    if (!codice) {
      return await rispondi("Ciao! Per ricevere le chiamate apri la pagina cameriere, scegli la tua fila e premi «Notifiche su Telegram».");
    }
    const riga = await env.DB.prepare(
      "SELECT fila, scade FROM codici_telegram WHERE codice = ?"
    ).bind(codice).first();
    if (!riga || riga.scade < Math.floor(Date.now() / 1000)) {
      return await rispondi("Questo link non e' piu' valido. Torna sulla pagina cameriere e premi di nuovo «Notifiche su Telegram».");
    }
    await env.DB.prepare(
      "INSERT INTO telegram (chat_id, fila, nome, creata) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(chat_id) DO UPDATE SET fila = excluded.fila, nome = excluded.nome"
    ).bind(chat, riga.fila, nome, new Date().toISOString()).run();
    await env.DB.prepare("DELETE FROM codici_telegram WHERE codice = ?").bind(codice).run();
    return await rispondi(
      "Perfetto" + (nome ? " " + nome : "") + "! Riceverai qui le chiamate della fila " + riga.fila +
      ".\nPer smettere scrivi /stop."
    );
  }

  return await rispondi("Per registrarti usa il link dalla pagina cameriere. Per smettere scrivi /stop.");
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

    // Messaggi in arrivo dal bot Telegram.
    if (url.pathname === "/telegram" && richiesta.method === "POST") {
      return await gestisciTelegram(richiesta, env);
    }

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

      if (azioneGet === "telegram") {
        if (!telegramAttivo(env)) return json({ ok: true, attivo: false }, 200, richiesta);
        try {
          const io = await telegramApi(env, "getMe", {});
          return json({ ok: true, attivo: true, bot: (io.result && io.result.username) || "" }, 200, richiesta);
        } catch (e) {
          return json({ ok: true, attivo: false }, 200, richiesta);
        }
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

      // Collega il bot: dice a Telegram dove mandare i messaggi. Solo il gestore.
      if (dati.azione === "telegramWebhook") {
        if (!autorizzato(richiesta, env.TOKEN_ADMIN)) {
          return json({ ok: false, errore: "codice non valido" }, 401, richiesta);
        }
        if (!telegramAttivo(env)) {
          return json({ ok: false, errore: "manca il token del bot" }, 400, richiesta);
        }
        const io = await telegramApi(env, "getMe", {});
        const esito = await telegramApi(env, "setWebhook", {
          url: new URL(richiesta.url).origin + "/telegram",
          secret_token: env.TELEGRAM_WEBHOOK_SECRET,
          allowed_updates: ["message"],
          drop_pending_updates: true,
        });
        return json({
          ok: !!esito.ok,
          bot: (io.result && io.result.username) || "",
          dettaglio: esito.description || "",
        }, 200, richiesta);
      }

      // Codice usa e getta per registrarsi al bot Telegram.
      if (dati.azione === "codiceTelegram") {
        if (!autorizzato(richiesta, env.TOKEN_STAFF)) {
          return json({ ok: false, errore: "codice non valido" }, 401, richiesta);
        }
        if (!telegramAttivo(env)) return json({ ok: false, errore: "telegram non attivo" }, 400, richiesta);
        const fila = String(dati.fila || "").toUpperCase();
        if (!/^[A-H]$/.test(fila)) return json({ ok: false, errore: "fila non valida" }, 400, richiesta);

        const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const casuali = crypto.getRandomValues(new Uint8Array(8));
        let codice = "";
        for (let i = 0; i < 8; i++) codice += alfabeto[casuali[i] % alfabeto.length];

        await env.DB.prepare("DELETE FROM codici_telegram WHERE scade < ?")
          .bind(Math.floor(Date.now() / 1000)).run();
        await env.DB.prepare("INSERT INTO codici_telegram (codice, fila, scade) VALUES (?, ?, ?)")
          .bind(codice, fila, Math.floor(Date.now() / 1000) + 900).run();

        return json({ ok: true, codice: codice }, 200, richiesta);
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
      ctx.waitUntil(avvisaTelegram(env, fila, tavolo));

      return json({ ok: true }, 200, richiesta);
    }

    return json({ ok: false, errore: "metodo non supportato" }, 405, richiesta);
  },
};
