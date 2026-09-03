// ============================================
// BACKEND "CHIAMA IL CAMERIERE" - San Grato
// Cloudflare Worker + database D1
// ============================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(oggetto, status = 200) {
  return new Response(JSON.stringify(oggetto), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(richiesta, env) {
    if (richiesta.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(richiesta.url);

    // Lista chiamate (per chiamate.html)
    if (richiesta.method === "GET" && url.searchParams.get("azione") === "lista") {
      const { results } = await env.DB.prepare(
        "SELECT id, ora, tavolo, stato FROM chiamate ORDER BY id DESC LIMIT 100"
      ).all();
      return json({ ok: true, chiamate: results });
    }

    if (richiesta.method === "GET") {
      return json({ ok: true, servizio: "San Grato" });
    }

    if (richiesta.method === "POST") {
      let dati;
      try {
        dati = await richiesta.json();
      } catch {
        return json({ ok: false, errore: "JSON non valido" }, 400);
      }

      // Segna una chiamata come servita
      if (dati.azione === "fatto") {
        const id = parseInt(dati.id, 10);
        if (!id) return json({ ok: false, errore: "id mancante" }, 400);
        await env.DB.prepare("UPDATE chiamate SET stato = 'FATTO' WHERE id = ?")
          .bind(id).run();
        return json({ ok: true });
      }

      // Nuova chiamata dal menu
      const tavolo = String(dati.tavolo || "").trim().slice(0, 10);
      if (!tavolo) return json({ ok: false, errore: "tavolo mancante" }, 400);

      // Anti-doppione: ignora se lo stesso tavolo ha già una chiamata in attesa
      const esistente = await env.DB.prepare(
        "SELECT id FROM chiamate WHERE tavolo = ? AND stato = 'IN ATTESA' LIMIT 1"
      ).bind("Tavolo " + tavolo).first();
      if (esistente) return json({ ok: true, doppione: true });

      await env.DB.prepare(
        "INSERT INTO chiamate (ora, tavolo, stato) VALUES (?, ?, 'IN ATTESA')"
      ).bind(new Date().toISOString(), "Tavolo " + tavolo).run();
      return json({ ok: true });
    }

    return json({ ok: false, errore: "metodo non supportato" }, 405);
  },
};
