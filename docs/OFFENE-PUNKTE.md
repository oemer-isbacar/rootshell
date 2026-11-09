# Offene Punkte

Gefundene Probleme und Ideen, die noch umgesetzt werden sollen. Erledigtes hier löschen (die Geschichte steht im Git-Log).

## Fehler

### `tree -L 1 /` im Mini-Linux gibt das ganze Dateisystem aus
*Gefunden am 2026-11-09*

- **Wo:** Lektion `b2-nav` „Im Dateisystem navigieren“, Schritt „Baumansicht“ (`lessons.js`, Mini-Linux).
- **Problem:** Das Mini-Linux nutzt BusyBox 1.36.1. Dessen `tree` kennt **keine Optionen** – `-L 1` wird ignoriert,
  `tree` läuft rekursiv durch `/` inklusive `/proc` und `/sys` (über 2000 Zeilen). Unter Ubuntu (Übungs-/Server-VM)
  liefert derselbe Befehl nur ca. 25 Zeilen. Das Terminal selbst ist in Ordnung.
- **Fix-Idee:** Im Mini-Linux einen Befehl nehmen, den BusyBox kann, z. B. `tree /etc/network` (kleiner Ordner) oder
  `find / -maxdepth 1 -type d` für „eine Ebene“, und im Text erklären, dass `tree -L 1 /` auf einem vollständigen Linux
  (Ubuntu) die Tiefe begrenzt. Prüfung (`check`) entsprechend anpassen.
- **Vorbeugen:** In `npm test` für Browser-Lektionen bekannte BusyBox-Lücken prüfen (z. B. `tree` mit Optionen),
  ähnlich wie es der Wargame-Test schon für `bash`, `python` und `tar -z` tut. Vorher alle Mini-Linux-Lektionen
  einmal im Mini-Linux durchspielen (siehe unten).

## Ideen / Ausbau

- **Mini-Linux-Lektionen automatisch prüfen:** Wie `test:vm-lessons` für die VMs – alle `browser`-Lektionen im Mini-Linux
  durchspielen und jeden Schritt mit der App-Prüfung bewerten (z. B. per Headless-Browser). Hätte den `tree`-Fehler gefunden.
- **Online-Demo veröffentlichen:** `npm run build:demo` → `dist/demo`, z. B. auf GitHub Pages. Das README kündigt sie schon an.
- **Screenshots erneuern:** `docs/screenshots/` zeigt noch den Stand vor dem Lernpfad (keine Pfadleiste, eine VM, kein SQL).
