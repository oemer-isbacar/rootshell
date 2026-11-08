# Mitmachen bei rootshell

Danke, dass du rootshell besser machen willst! Am meisten helfen **neue Lektionen, Missionen, Prüfungsfragen und Wargame-Level** – und Fehlerberichte („Schritt X wird nicht abgehakt, obwohl …“).

## Schnellstart

```bash
git clone https://github.com/oemer-isbacar/rootshell.git
cd rootshell
npm install
npm start          # http://localhost:8086
npm test           # Inhalts-Test – muss vor jedem Pull Request grün sein
```

Alle Texte sind **Deutsch**, in der Du-Form, kurz und konkret. Fachbegriffe beim ersten Auftreten kurz erklären.

## Wo liegt was?

| Datei | Inhalt |
|---|---|
| `lessons.js` | Linux Teil 1–3 (Mini-Linux, VM, Selbst-Hosting) |
| `lessons-script.js` | Teil 4: Skripte (Bash + PowerShell) |
| `lessons-sec.js` | Teil 5: IT-Security (Blue Team) |
| `lessons-net.js` | Teil 6: Netzwerk |
| `lessons-devops.js` | Teil 7: Git & Docker |
| `lessons-ps.js`, `lessons-win.js` | Windows-Kurs |
| `drills.js` (+ Karten am Ende der `lessons-*.js`) | Trainingskarten |
| `missions.js` | Missionen (wird von App **und** Server geladen) |
| `quiz.js` | Prüfungsfragen |
| `wargame.js` | Wargame-Level |
| `app.js` | Oberfläche; neue Gruppen in `GROUPS` eintragen |

Eine neue `lessons-*.js` muss in `index.html` (Reihenfolge = Reihenfolge im Kurs) und in `PUBLIC` in `server.js` eingetragen werden. `npm test` meldet, wenn das fehlt.

## Lektion

```js
window.LESSONS.push({
  id: "net9-beispiel",            // eindeutig
  mode: "ssh",                    // "browser" (Mini-Linux) | "ssh" (Ubuntu-VM) | "ps" (PowerShell 7) | "win" (Sandbox)
  group: "net",                   // Teil-Überschrift, siehe GROUPS in app.js
  title: "Kurzer Titel",
  intro: `Ein, zwei Sätze: Worum geht es, warum ist das wichtig?`,
  steps: [
    {
      title: "Was der Schritt tut",
      text: `Erklärung vor dem Befehl (HTML erlaubt).`,
      cmd: "ip route",            // Text oder Liste – wird per „übernehmen“ ins Terminal geschrieben
      check: { cmd: /^ip\s+r(oute)?\b/, out: /default via/ },
      explain: `Wird nach dem Erledigen eingeblendet: Hintergrund, Prüfungswissen.`,
    },
  ],
  outro: `Optional: Abschluss, Ausblick.`,
});
```

**Prüfungen (`check`)** sind das Herz der App. Ein Schritt gilt als erledigt, wenn
- `cmd` auf die eingegebene Zeile passt,
- `out` auf die Ausgabe passt (optional) und `notOut` nicht,
- und keine typische Fehlermeldung in der Ausgabe steht (`Permission denied`, `command not found` …). Soll genau so ein Fehler gezeigt werden, muss `out` ihn treffen.

Tipps: Regex großzügig schreiben (`apt(-get)?`, `\s+`), Ausgaben prüfen, die es auf jedem System gibt. `{{IP}}` wird durch die IP der Übungs-VM ersetzt. Schritte ohne `check` bekommen einen „Erledigt“-Knopf.

## Trainingskarte

```js
{ id: "sn-beispiel", mode: "ssh", lvl: 2, after: "net2-routing",
  q: "Aufgabe – <b>was</b>, nicht wie.", hint: "Optionaler Tipp.", a: "ip route get 8.8.8.8",
  check: { cmd: /ip\s+r(oute)?\s+get/ } }
```

`lvl`: 1 = Befehl fast genannt, 2 = Option selbst finden, 3 = kombinieren/suchen. `after`: Lektion, die zur Hälfte erledigt sein muss. **Die Musterlösung `a` muss zu `check.cmd` passen** – das prüft `npm test`.

## Mission

```js
{
  id: "mnet-beispiel", level: 2, title: "🌐 Titel",
  story: `Was der Anwender meldet – ohne die Ursache zu verraten.`,
  goal: `Was am Ende funktionieren muss.`,
  hints: [`Tipp 1 (Richtung)`, `Tipp 2 (Werkzeug)`, `Tipp 3 (fast die Lösung)`],
  solution: `<code>sudo …</code>`,
  test: `…`,                      // optional: ausführbare Lösung für npm run test:vm, wenn solution Fließtext ist
  setup: `…bash als root, baut den Fehler ein, endet mit echo ok`,
  verify: `…bash als root; Exit 0 = gelöst. Jede Bedingung mit eigener ❌-Meldung, am Ende echo "✅ …"`,
}
```

Regeln:
- `setup` muss **mehrfach** laufen können (Mission neu vorbereiten) und darf nichts zerstören, was der Lernende nicht reparieren kann.
- `verify` prüft das **Ergebnis**, nicht den Weg – außer der Weg ist der Lernstoff (z. B. `git revert` statt `reset`).
- In den Template-Strings `\${…}` statt `${…}` schreiben, sonst setzt JavaScript ein.
- Security-Missionen spielen nur **harmlose** Artefakte ein und üben die Verteidiger-Seite.
- Vor dem Pull Request: `npm run test:vm -- deine-mission-id` (Snapshot + Zurücksetzen passiert automatisch).

## Prüfungsfrage

```js
{ id: "q-beispiel", topic: "Netzwerk", track: "all",   // "linux" | "windows" | "all"
  q: "Frage (HTML erlaubt)", o: ["richtige Antwort", "falsch", "falsch", "falsch"], a: 0,
  e: "Erklärung – auch, warum die falschen Antworten falsch sind." }
```

Die Antworten werden beim Anzeigen gemischt, `a` darf also immer 0 sein. Stil: wie IHK-Aufgaben, eindeutig richtig, plausible falsche Antworten.

## Wargame-Level

```js
{ id: "w16", title: "Titel", tools: "find, grep",
  task: `Auftrag ohne Lösungsweg.`, hint: `Tipp.`,
  setup: (f) => `mkdir -p ~/wargame/l16 && cd ~/wargame/l16 && echo "${f}" > …` }
```

Das Setup läuft im **Mini-Linux** (BusyBox, `sh`, kein bash/python, `tar` ohne `-z`). Es bekommt das zufällige Flag `f` und muss es so verstecken, dass es mit den genannten Werkzeugen findbar ist. Attrappen (`FLAG{falsch-…}`) sind erwünscht.

## Warum JavaScript-Dateien statt JSON?

Die Prüfungen sind reguläre Ausdrücke und teils Funktionen – das lässt sich in JSON nur umständlich abbilden. Stattdessen sichert `npm test` die Struktur ab (Pflichtfelder, eindeutige IDs, gültige Verweise, passende Musterlösungen), und die Dateien bleiben direkt im Browser ladbar, ohne Build-Schritt.
