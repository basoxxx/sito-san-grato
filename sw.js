// Service worker: riceve le notifiche push anche a pagina chiusa o schermo spento.
// Il server manda solo una "sveglia" senza dati: e' questo file che poi chiede
// al server quali chiamate ci sono per la fila del cameriere.

const DEPOSITO = 'sg-cameriere';

async function leggiConfig() {
  try {
    const deposito = await caches.open(DEPOSITO);
    const risposta = await deposito.match('config');
    if (!risposta) return null;
    return await risposta.json();
  } catch (e) {
    return null;
  }
}

async function testoNotifica() {
  const cfg = await leggiConfig();
  if (!cfg || !cfg.backendUrl || !cfg.codice || !cfg.fila) {
    return { titolo: 'Nuova chiamata', corpo: 'Apri la pagina per vedere il tavolo.' };
  }
  try {
    const risposta = await fetch(cfg.backendUrl + '?azione=lista&v=' + Date.now(), {
      headers: { Authorization: 'Bearer ' + cfg.codice },
    });
    if (!risposta.ok) throw new Error(risposta.status);
    const dati = await risposta.json();
    const inizio = 'Fila ' + cfg.fila + ' · tavolo ';
    const tavoli = (dati.chiamate || [])
      .filter(function (c) { return c.stato !== 'FATTO' && String(c.tavolo).indexOf(inizio) === 0; })
      .map(function (c) { return String(c.tavolo).slice(inizio.length); });
    if (tavoli.length === 0) return null; // gia' servita da un collega
    if (tavoli.length === 1) {
      return { titolo: 'Fila ' + cfg.fila + ' · tavolo ' + tavoli[0], corpo: 'Ti stanno chiamando.' };
    }
    return {
      titolo: 'Fila ' + cfg.fila + ' · ' + tavoli.length + ' chiamate',
      corpo: 'Tavoli ' + tavoli.join(', '),
    };
  } catch (e) {
    return { titolo: 'Nuova chiamata', corpo: 'Apri la pagina per vedere il tavolo.' };
  }
}

self.addEventListener('push', function (evento) {
  evento.waitUntil(
    testoNotifica().then(function (n) {
      if (!n) return;
      return self.registration.showNotification(n.titolo, {
        body: n.corpo,
        tag: 'chiamata',
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 120, 300, 120, 300],
        icon: 'icona.png',
        badge: 'icona.png',
      });
    })
  );
});

self.addEventListener('notificationclick', function (evento) {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (finestre) {
      for (const finestra of finestre) {
        if (finestra.url.indexOf('cameriere.html') !== -1) return finestra.focus();
      }
      return self.clients.openWindow('cameriere.html');
    })
  );
});

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (evento) { evento.waitUntil(self.clients.claim()); });
