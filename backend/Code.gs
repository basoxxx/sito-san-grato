// ============================================
// BACKEND "CHIAMA IL CAMERIERE" - San Grato
// Da incollare in Google Apps Script (script.google.com)
// collegato a un Foglio Google. Vedi README.md
// ============================================

function rispondi(oggetto) {
  return ContentService
    .createTextOutput(JSON.stringify(oggetto))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var dati = JSON.parse(e.postData.contents);
  var foglio = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Segna una chiamata come servita (dalla pagina chiamate.html)
  if (dati.azione === "fatto") {
    var riga = parseInt(dati.riga, 10);
    if (riga >= 2 && riga <= foglio.getLastRow()) {
      foglio.getRange(riga, 3).setValue("FATTO");
    }
    return rispondi({ ok: true });
  }

  // Nuova chiamata dal menu
  var tavolo = String(dati.tavolo || "?").slice(0, 10);
  foglio.appendRow([new Date(), "Tavolo " + tavolo, "IN ATTESA"]);
  return rispondi({ ok: true });
}

function doGet(e) {
  // Lista chiamate (per chiamate.html)
  if (e && e.parameter && e.parameter.azione === "lista") {
    var foglio = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var valori = foglio.getDataRange().getValues();
    var chiamate = [];
    // Salta la riga di intestazione, prendi al massimo le ultime 100
    var inizio = Math.max(1, valori.length - 100);
    for (var i = inizio; i < valori.length; i++) {
      chiamate.push({
        riga: i + 1,
        ora: valori[i][0],
        tavolo: String(valori[i][1] || ""),
        stato: String(valori[i][2] || "")
      });
    }
    return rispondi({ ok: true, chiamate: chiamate });
  }
  return rispondi({ ok: true, servizio: "San Grato" });
}
