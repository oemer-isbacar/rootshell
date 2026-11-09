# Teilprojekt 1: Lernpfad-Gerüst und zwei VMs

Stand: 2026-11-09 · Branch `feature/lernpfad-zwei-vms`

## Ziel

Jedes Thema in rootshell folgt künftig demselben Pfad:

**① Lernen** (Browser) → **② Üben** (Übungs-VM, Wegwerf) → **③ Anwenden** (Server-VM, geführte Installation echter Dienste) → **④ Störfall** (Mission)

Teilprojekt 1 baut nur das Gerüst dafür. Inhalte (SQL-Krimi, WordPress, DB-Störfälle) folgen in Teilprojekt 2,
das Einsortieren der vorhandenen Lektionen in Teilprojekt 4.

## Zwei VMs

| Profil | Multipass-Name | Größe | Basis-Snapshot | Rolle |
|---|---|---|---|---|
| `uebung` | `rs-uebung` | 1 CPU · 1 GB · 8 GB | `basis` | Wegwerf: Übungen und Missionen, wird vor jeder Übung/Mission zurückgesetzt |
| `server` | `fis-lab` | 2 CPU · 2 GB · 15 GB | `frisch` | Bleibt: dein Server, die App installiert dort nichts heimlich |

- Eine bestehende VM `fis-lab` ist automatisch die Server-VM (keine Migration nötig).
- `vmctl` kennt nur diese zwei Profile (Whitelist). Jede Aktion nimmt `vm: "uebung" | "server"`, Standard `server`.
- `/api/env` liefert `vms: { uebung, server }` mit Zustand, IP, Snapshots. Die alten Felder `vm`, `snapshots`, `vmName`
  bleiben als Spiegel der Server-VM erhalten.
- Es läuft immer nur eine VM: `launch` und `start` pausieren vorher die andere (Schritt im selben Job).
- Der SSH-Schlüssel der App gilt für beide VMs.

### Übung vorbereiten

`POST /api/vm/prepare` mit `{ lesson }`: Übungs-VM auf `basis` zurücksetzen (fehlt der Snapshot, wird er angelegt),
starten, dann das `prep`-Skript der Lektion als root ausführen. Der Server liest `prep` selbst aus den Lektionsdateien
(der Browser schickt nur die Lektions-ID, nie ein Skript).

### Missionen

Linux-Missionen laufen in der Übungs-VM. „Mission starten“ setzt die Übungs-VM vorher auf `basis` zurück.
Sandbox-Missionen bleiben unverändert.

## Lektionen und Lernpfad

Neue, optionale Felder:

| Feld | Werte | Bedeutung |
|---|---|---|
| `topic` | ID aus `topics.js` | Thema |
| `stage` | 1, 2, 3 | Lernen / Üben / Anwenden; Missionen mit `topic` sind Stufe 4 |
| `vm` | `uebung`, `server` | für `ssh`/`ps`-Lektionen; ohne Angabe `server` |
| `prep` | Bash-Skript | wird nach dem Zurücksetzen in der Übungs-VM ausgeführt (nur mit `vm: "uebung"`) |

- `topics.js` definiert `window.TOPICS = [{ id, title }]`. Anfangs nur `db`.
- Lektionen mit `topic` zeigen oben eine Pfadleiste ①–④; jede Station ist anklickbar und zeigt ✓, wenn erledigt.
  Am Lektionsende führt ein Knopf zur nächsten Station. Nichts wird gesperrt.
- Das Terminal verbindet sich mit der VM der aktuellen Lektion; die Statusleiste zeigt „🧪 Übungs-VM“ bzw. „🖥 Server-VM“.

## VM-Zentrale

Zwei Karten (Übungs-VM, Server-VM) mit Zustand, Knöpfen und Snapshots. Übungs-VM: „⟲ Auf Basis“; Server-VM:
„⟲ Auf Werkszustand“. Feierabend und Auto-Pause gelten für beide.

## Fehlerfälle

- Übungs-VM fehlt → Übung/Mission bietet „Übungs-VM anlegen“ an.
- Snapshot `basis` fehlt → wird vor dem Zurücksetzen angelegt.
- `prep` scheitert → Job schlägt fehl, Log in der VM-Zentrale, Übung gilt als nicht vorbereitet.

## Tests

- `npm test`: `topic` existiert in `topics.js`, `stage` ∈ 1–3, `prep` nur mit `vm: "uebung"`, `vm` ∈ {uebung, server}.
- `test:vm` / `test:vm-lessons`: Option `--vm uebung|server`; Missionen standardmäßig `uebung`.
- Manuell am PC: Übungs-VM anlegen, `basis`, Übung vorbereiten, zwischen VMs wechseln, Mission in der Übungs-VM.

## Nicht in Teilprojekt 1

Inhalte (außer einer Beispiel-Übung `db` zum Durchspielen des Pfads), sql.js, Umsortieren vorhandener Lektionen.
