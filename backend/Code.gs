// ============================================
// BACKEND "CHIAMA IL CAMERIERE" - San Grato
// Da incollare in Google Apps Script (script.google.com)
// collegato a un Foglio Google. Vedi README.md
// ============================================

function doPost(e) {
  var dati = JSON.parse(e.postData.contents);
  var tavolo = String(dati.tavolo || "?").slice(0, 10);

  var foglio = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  foglio.appendRow([new Date(), "Tavolo " + tavolo, "IN ATTESA"]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, servizio: "San Grato" }))
    .setMimeType(ContentService.MimeType.JSON);
}
