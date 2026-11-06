# #_ rootshell

**Linux- und Windows-Administration lernen – an echten Systemen.**
Links eine echte Shell, rechts das Tutorial. Jeder Schritt wird automatisch abgehakt, sobald du den richtigen Befehl eintippst. Dazu kommen ein Lernkartei-Training mit steigender Schwierigkeit und Störfall-Missionen: Die App baut unbemerkt einen Fehler ein, du findest und behebst ihn, die App prüft das Ergebnis.

Gebaut für Azubis und Umschüler **Fachinformatiker Systemintegration (FISI)**, aber für alle nützlich, die Admin-Handwerk üben wollen. Alle Inhalte sind auf Deutsch.

| Kurs | Umgebung | Inhalt |
|---|---|---|
| 🐧 **Linux** | Mini-Linux im Browser (sofort, ohne Setup) + Ubuntu-VM | Shell-Grundlagen bis LEMP, DNS, DHCP, Docker, Selbst-Hosting, 10 Störfall-Missionen |
| 🪟 **Windows · PowerShell** | PowerShell 7 in der Ubuntu-VM + echtes Windows in der Windows-Sandbox | Pipeline, Skripte, CSV/JSON, Dienste, Benutzer, NTFS, Registry, Firewall, geplante Aufgaben, 8 Missionen |

Nichts davon verändert deinen PC: Die VM und die Sandbox sind Wegwerf-Umgebungen.

## Installation

**Voraussetzungen**

| | Wofür | Pflicht? |
|---|---|---|
| Windows 10/11 | Host | ja |
| [Node.js](https://nodejs.org) (LTS) | lokaler Server der App | ja |
| Windows **Pro/Enterprise/Education** mit Hyper-V + [Multipass](https://multipass.run) | Ubuntu-VM (Linux Teil 2/3, PowerShell 7) | für die VM-Kurse – die App prüft und installiert das auf Knopfdruck |
| Windows-Feature **Windows-Sandbox** | echtes Windows für die Windows-Lektionen | nur für den Sandbox-Teil |
| ca. 8 GB RAM | VM (2 GB) bzw. Sandbox (3 GB) | empfohlen |

Das Mini-Linux im Browser (Linux Teil 1) läuft ohne VM.

**Herunterladen und starten**

1. Repository herunterladen: grüner Knopf **Code → Download ZIP** und entpacken, oder
   ```bash
   git clone https://github.com/oemer-isbacar/rootshell.git
   ```
2. Im Ordner **`start.bat`** doppelklicken. Beim ersten Mal werden die Abhängigkeiten installiert (`npm install`).
3. Die App öffnet sich im Browser unter http://localhost:8086. Das schwarze Server-Fenster offen lassen, solange du lernst.

Die VM legst du in der App über **⚙ VM-Zentrale** an, die Sandbox startest du im Windows-Kurs mit **▶ Sandbox starten**. Dein Lernstand wird im Browser gespeichert.

## Zwei Umgebungen

| Modus | Was | Wofür |
|---|---|---|
| 🖥 **Mini-Linux** | Echter Linux-Kernel mit BusyBox, emuliert im Browser (v86). Startet in Sekunden und braucht kein Setup. | Teil 1: Shell, Dateien, Rechte, Prozesse, vi, Skripte |
| 🔌 **Echte VM** | Ubuntu-VM (Multipass/Hyper-V), die die App selbst anlegt und verwaltet | Teil 2 (FISI): apt, Benutzer, systemd, Netzwerk, SSH, ufw, Apache/nginx, MariaDB, **LEMP**, Samba, DNS, DHCP, LVM, cron, Docker, Fehlersuche |
| 🏠 **Selbst hosten** | Läuft auf derselben VM | Teil 3: Uptime Kuma, Gitea, Caddy als Reverse Proxy, Pflege, Backups und Ideen fürs Homelab |

## 🪟 Windows · PowerShell

Beim Start wählst du den Kurs: **🐧 Linux** oder **🪟 Windows · PowerShell**. Wechseln kannst du jederzeit oben links, der Fortschritt bleibt in beiden Kursen erhalten.

- **PowerShell 7 läuft in der Übungs-VM.** Die App installiert es beim ersten Mal automatisch (`snap install powershell`, etwa eine Minute). Sprache, Pipeline, Objekte, Skripte und Fehlerbehandlung sind dieselben wie unter Windows. Dein PC bleibt dabei unangetastet.
- **11 Lektionen** behandeln Cmdlets und Hilfe, Dateien, Pipeline (`Where-`/`Sort-`/`Select-Object`), Variablen und Hashtables, CSV/JSON-Export, Skripte, `try/catch`, `Select-String`, Netzwerk und REST-APIs sowie ein Admin-Prüfskript.
- **Windows-Verwaltung:** Dienste, lokale Benutzer, Netzwerk, Ereignisanzeige, Registry und CIM gibt es nur unter Windows. Diese Befehle kopierst du per 📋 in die PowerShell deines PCs. Es sind ausschließlich lesende `Get-`-Befehle. Für Befehle, die etwas ändern, erklärt die Lektion die Windows-Sandbox.
- **24 Trainingskarten** in drei Stufen und **4 Missionen**: CSV-Bericht, Log-Auswertung mit Falle, Aufräumen nach Datum und Onboarding aus einer Excel-CSV.

### 🪟 Teil 3: Echtes Windows in der Windows-Sandbox

Voraussetzung: Das Windows-Feature „Windows-Sandbox“ ist aktiviert (Windows Pro/Enterprise).

- **Modus „🪟 Windows-Sandbox“:** Die App startet die Sandbox selbst (▶ Sandbox starten). Links läuft dann die echte **Windows PowerShell 5.1** als Administrator. Der erste Start dauert etwa 2 Minuten, die Sandbox braucht etwa 3 GB RAM. Ihr Fenster erscheint auf dem Desktop und kann minimiert werden.
- **Alles ist Wegwerf-Windows:** ⏹ Sandbox beenden, 🌙 Feierabend oder das Schließen des Sandbox-Fensters löscht alles darin. Dein PC bleibt unberührt.
- **8 Lektionen** zum Ändern: Dienste (Spooler stoppen, deaktivieren, reparieren), lokale Benutzer und Gruppen (mit SID statt deutschem Gruppennamen), NTFS-Rechte mit `icacls` und SMB-Freigaben, Registry, Ereignisanzeige (eigene Ereignisse schreiben und filtern), Netzwerk und Firewall-Regeln, Skripte und geplante Aufgaben.
- **14 Trainingskarten** und **4 Störfall-Missionen** (🪟): ein deaktivierter Druckdienst, eine neue Kollegin mit Ordnerrechten über die Gruppe, eine Sperrregel, die eine Freigabe aushebelt, und eine geplante Nachtsicherung mit falschem Pfad. Geprüft wird per Skript direkt in der Sandbox.
- **Technik:** Die Sandbox bekommt über einen schreibgeschützten Ordner einen kleinen Agenten (`sandbox/agent.ps1` + `LabAgent.cs`). Er öffnet eine echte Windows-Konsole (ConPTY) und nimmt Prüfskripte an, nur mit zufälligem Token. Erreichbar ist er nur von deinem PC aus, denn die Sandbox hängt hinter dessen NAT.

## ⚙ VM-Zentrale

In der VM-Zentrale passiert alles, ohne dass du Multipass selbst öffnen musst:

- **Voraussetzungen prüfen:** Windows-Edition, Hyper-V (Firmware, Feature, Dienst) und Multipass. Fehlt etwas, gibt es einen Knopf dafür. Multipass wird per winget installiert, Hyper-V wird mit Admin-Abfrage aktiviert und braucht danach einen Neustart.
- **VM anlegen:** Ubuntu 24.04 mit 2 CPUs, 2 GB RAM und 15 GB Platte. Danach entsteht automatisch der Snapshot „frisch“, und die App verbindet sich per eigenem SSH-Schlüssel.
- **Pause, Fortsetzen und Herunterfahren:** Pause friert die VM ein und gibt CPU frei. Herunterfahren gibt auch den RAM frei. Ohne Eingaben pausiert die App die VM nach einstellbarer Zeit (Standard 30 Minuten).
- **Feierabend:** fährt die VM herunter, sichert das Mini-Linux und zeigt, wie viele Trainingskarten morgen fällig sind.
- **Snapshots:** anlegen, zurückspringen und löschen.
- **Behalten oder löschen:** Die VM kann bleiben, zum Beispiel als Homelab-Spielwiese, oder komplett entfernt werden. Das Löschen musst du zweimal bestätigen.

Login für manuelle SSH-Verbindungen: `ubuntu` / `linuxlab`. Das ist nur fürs lokale Lab gedacht.

## 🔁 Training (Wiederholung)

54 Befehlskarten werden mit Lernkartei-System abgefragt (Leitner, Intervalle 10 Minuten bis 35 Tage). Du tippst die Lösung echt ins Terminal, die App prüft das Ergebnis.
Die Stufen schalten sich frei, je sicherer du wirst:

- **Stufe 1:** Die Aufgabe nennt den Befehl fast direkt.
- **Stufe 2:** Du musst den passenden Befehl oder die Option selbst finden.
- **Stufe 3:** Kombinieren und suchen, zum Beispiel die große Datei irgendwo unter `/usr` finden.

Hinweis und Lösung gibt es nur auf Knopfdruck.

## 🎯 Missionen (Fehlersuche)

10 Störungen werden auf der VM versteckt eingebaut, zum Beispiel volle Platte, CPU-Fresser, kaputte nginx-Konfiguration, Firewall, Cron, SSH-Rechte, 502 Bad Gateway oder ein Container ohne Neustart. Du findest und behebst sie selbst. „Prüfen“ kontrolliert das Ergebnis, Tipps gibt es schrittweise.

## Hinweise

- Schritte werden automatisch abgehakt, sobald du den passenden Befehl ausführst.
- „Zustand speichern“ sichert das komplette Mini-Linux im Browser (IndexedDB).
- Der Server lauscht nur auf 127.0.0.1 und nimmt Anfragen nur von der eigenen Seite an. Passwörter werden nicht gespeichert. Der SSH-Schlüssel der App liegt in `data/`.
- Neue Lektionen kommen in `lessons.js` (Linux), `lessons-ps.js` und `lessons-win.js` (Windows), Karten in `drills.js` und Missionen in `missions.js`.

## Mitmachen

Fehler gefunden oder Idee für eine Lektion bzw. Mission? Gern als Issue oder Pull Request.

## Lizenz

Eigener Code: [MIT](LICENSE). Mitgelieferte Fremdkomponenten (v86, xterm.js, Linux-Image, BIOS): siehe [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
