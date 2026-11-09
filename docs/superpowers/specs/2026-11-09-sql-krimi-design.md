# Teilprojekt 2a: SQL-Krimi im Browser (Fall 1)

Stand: 2026-11-09 · Branch `feature/lernpfad-zwei-vms` · baut auf Teilprojekt 1 auf

## Ziel

Station **① Lernen** des Themas `db`: SQL lernen im Browser, ohne VM, auch in der Online-Demo.
Eigene Geschichte im Stil von SQL Island / SQL Murder Mystery (keine Kopie): Fall 1 ist geführt, jeder Schritt
führt ein SQL-Element ein. Fall 2 (offen) folgt später.

## Technik

- **sql.js** (SQLite als WebAssembly, MIT) in `lib/sql-wasm.js` + `lib/sql-wasm.wasm`, eingecheckt wie xterm/v86.
- Neuer Lektions-Modus **`sql`**: Links erscheint statt des Terminals eine SQL-Konsole
  (Eingabefeld mit Strg+Enter, Ergebnis als Tabelle, Liste der Tabellen mit Spalten, Verlauf mit ↑/↓).
- Lektionen mit `mode: "sql"` nennen ihre Datenbank über `db: "<id>"`. Die Datenbanken liegen als SQL-Text in
  `sql-cases.js` (`window.SQL_DBS`). Beim Öffnen einer Lektion wird die Datenbank frisch geladen, falls eine andere
  geladen ist; „↺ Datenbank zurücksetzen“ lädt sie neu.
- Jede ausgeführte Abfrage läuft durch die vorhandene Schrittprüfung (`onCommandFinished(sql, text)`).
  Das Ergebnis wird dafür zusätzlich als Text gerendert (`spalte | spalte` je Zeile), so funktionieren die
  bekannten `check: { cmd, out, notOut }`.
- Neues Schrittfeld `solution`: wird hinter „Lösung zeigen“ versteckt (mit „übernehmen“-Knopf), statt die
  Abfrage wie bei `cmd` offen zu zeigen. So bleibt der Rätselcharakter.
- Nur SQL, das in SQLite **und** MariaDB gleich funktioniert (Datum als Text `YYYY-MM-DD HH:MM`, `LIKE`,
  `BETWEEN`, `JOIN … ON`, `GROUP BY`, Unterabfrage mit `IN`/`=`).

## Fall 1: „Der verschwundene Laptop“

Fiktive Firma *Nordlicht Logistik GmbH*. Nach Feierabend verschwindet ein Admin-Laptop aus dem Serverraum.
Tabellen: `meldungen`, `mitarbeiter`, `zutritte` (Kartenleser), `geraete`, `tickets`, `vpn_logins`.

Schritte (je ein neues SQL-Element): `SELECT *` → `WHERE` → `AND` + `ORDER BY` → `JOIN` → `GROUP BY`/`COUNT` →
`LIKE` → Alibi per VPN → Unterabfrage → `BETWEEN` → Spur des Geräts → Auflösung als freie Aufgabe.

## Tests

`npm test` lädt sql.js in Node, baut jede Fall-Datenbank und prüft, dass jede Musterlösung (`solution`)
fehlerfrei läuft und ihre eigene Schrittprüfung besteht.

## Nicht in 2a

Fall 2, WordPress auf der Server-VM, Datenbank-Störfälle (Teilprojekt 2b/3).
