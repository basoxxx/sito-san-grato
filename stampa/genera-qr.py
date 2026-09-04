#!/usr/bin/env python3
"""Genera il QR del menu e i fogli da stampare per i tavoli.

Uso:  pip3 install segno && python3 stampa/genera-qr.py
Se un domani cambia l'indirizzo del sito, cambia INDIRIZZO qui sotto e rilancia.
"""
import re
import segno

INDIRIZZO = "https://basoxxx.github.io/sito-san-grato/"

# Correzione errori alta: il cartello resta leggibile anche sporco o consumato.
qr = segno.make(INDIRIZZO, error="h")
MODULI = qr.symbol_size(border=0)[0]

qr.save("stampa/qr-menu.svg", scale=10, border=0, dark="#3A2E18", light=None)
qr.save("stampa/qr-menu.png", scale=24, border=4, dark="#3A2E18", light="#FBF3DA")

_interno = re.search(r"<svg[^>]*>(.*)</svg>", open("stampa/qr-menu.svg").read(), re.S).group(1)
QR = (f'<svg viewBox="0 0 {MODULI*10} {MODULI*10}" xmlns="http://www.w3.org/2000/svg" '
      'style="width:100%;height:auto;display:block;shape-rendering:crispEdges">'
      + _interno + "</svg>")

# Zona di silenzio: 4 moduli bianchi tutt'intorno, come vuole lo standard.
BORDO = 4.4 / MODULI

TESTA = """<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>%(titolo)s</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Corben:wght@400;700&family=Nunito+Sans:wght@400;600;700;800&display=swap">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #EDE6D2; }
  body { font-family: 'Nunito Sans', 'Avenir Next', system-ui, sans-serif;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: %(pagina)s; margin: 0; }
  .foglio { background: #fff; margin: 0 auto; display: grid; }
  .carta { background: #FBF3DA; display: flex; flex-direction: column;
           align-items: center; justify-content: center; text-align: center;
           outline: 0.2mm dashed #D8C79A; outline-offset: -0.1mm; }
  .titolo { font-family: 'Corben', Georgia, serif; font-weight: 700;
            color: #E9A722; line-height: 1.02; }
  .riga { display: flex; align-items: center; justify-content: center; }
  .filo { height: 2px; background: #E9A722; border-radius: 2px; }
  .luogo { font-family: 'Corben', Georgia, serif; font-weight: 700; color: #E9A722; }
  .invito { font-weight: 800; color: #4A3B23; }
  .codice { background: #fff; border-radius: 3mm; }
  .come { font-weight: 600; color: #8A6D3B; font-style: italic; }
  .indirizzo { font-weight: 700; color: #B87A08; letter-spacing: .02em; }
  .istruzioni { max-width: 190mm; margin: 8mm auto; padding: 6mm 8mm; background: #fff;
                border: 1px solid #E7D9AE; border-radius: 4mm; color: #4A3B23; font-size: 11pt; }
  .istruzioni h1 { font-family: 'Corben', Georgia, serif; font-size: 15pt; color: #B87A08; margin: 0 0 3mm; }
  @media print { .istruzioni { display: none; } }
</style>
</head>
<body>
<div class="istruzioni">
  <h1>%(titolo)s</h1>
  <p><b>Per stampare:</b> Cmd+P &rarr; formato <b>%(pagina_it)s</b>, margini <b>nessuno</b>,
  e spunta <b>&laquo;Grafica di sfondo&raquo;</b> (altrimenti esce senza il colore crema).
  Poi taglia lungo le linee tratteggiate.</p>
  <p>Il QR porta al men&ugrave; della festa. Questo riquadro non viene stampato.</p>
</div>
%(fogli)s
</body>
</html>
"""


def carta(larg, alt, titolo_pt, u, luogo_pt, invito_pt, qr_mm, come_pt, ind_pt, bordo):
    """Un cartello. `u` e' l'unita' di spaziatura in mm, tutto il resto scala su quella."""
    return f"""<div class="carta" style="width:{larg};height:{alt};padding:{bordo}">
      <div class="titolo" style="font-size:{titolo_pt}pt">San Grato</div>
      <div class="riga" style="gap:{u}mm;margin-top:{u}mm">
        <div class="filo" style="width:{u * 4}mm"></div>
        <div class="luogo" style="font-size:{luogo_pt}pt;letter-spacing:.12em">RIVARA &middot; 2026</div>
        <div class="filo" style="width:{u * 4}mm"></div>
      </div>
      <div class="invito" style="font-size:{invito_pt}pt;margin:{u * 1.6}mm 0 {u * 1.2}mm">Il men&ugrave; sul telefono</div>
      <div class="codice" style="width:{qr_mm}mm;padding:{qr_mm * BORDO:.1f}mm">{QR}</div>
      <div class="come" style="font-size:{come_pt}pt;margin-top:{u * 1.4}mm">Inquadra il codice con la fotocamera</div>
      <div class="indirizzo" style="font-size:{ind_pt}pt;margin-top:{u * 0.7}mm">basoxxx.github.io/sito-san-grato</div>
    </div>"""


# A5 da mettere in piedi sui tavoli: 2 per foglio A4 orizzontale.
a5 = carta("148mm", "210mm", 40, 4, 13, 15, 74, 11, 9.5, "10mm")
open("stampa/qr-tavoli-a5.html", "w").write(TESTA % {
    "titolo": "QR da tavolo &middot; formato A5",
    "pagina": "A4 landscape",
    "pagina_it": "A4 orizzontale",
    "fogli": f'<div class="foglio" style="width:297mm;height:210mm;grid-template-columns:148mm 148mm">{a5}{a5}</div>' * 2,
})

# Piccoli da attaccare al tavolo: 8 per foglio A4 verticale.
pic = carta("105mm", "74mm", 19, 2, 7, 8, 32, 6.5, 5.5, "4mm")
open("stampa/qr-tavoli-piccolo.html", "w").write(TESTA % {
    "titolo": "QR da tavolo &middot; formato piccolo",
    "pagina": "A4 portrait",
    "pagina_it": "A4 verticale",
    "fogli": ('<div class="foglio" style="width:210mm;height:296mm;'
              'grid-template-columns:105mm 105mm;grid-template-rows:repeat(4,74mm)">' + pic * 8 + "</div>"),
})

print(f"QR versione {qr.version}, {MODULI} moduli · bordo bianco {74 * BORDO:.1f}mm sull'A5")
