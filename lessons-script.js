/* Skript-Kurs: Bash-Skripte in der Übungs-VM (mode "ssh", group "script")
 * und PowerShell-Skripte mit PowerShell 7 in der VM (mode "ps", group "ps-script").
 * Hinweis: In Template-Strings muss ${ als \${ geschrieben werden.
 */
window.LESSONS.push(
/* ===================================================================== */
/* LINUX · TEIL 4 – BASH-SKRIPTE                                          */
/* ===================================================================== */
{
  id: "x1-first", mode: "ssh", vm: "uebung", topic: "script", stage: 2, group: "script", title: "Dein erstes richtiges Skript",
  intro: `Ab jetzt schreibst du eigene Werkzeuge. Ein Bash-Skript ist eine Textdatei mit Befehlen, die nacheinander ausgeführt werden – genau die Befehle, die du schon kennst. Deine Skripte kommen nach <code>~/bin</code>. Mehrzeilige Blöcke kopierst du mit „übernehmen“ und drückst Enter.`,
  steps: [
    { title: "Ordner für deine Skripte", cmd: "mkdir -p ~/bin && cd ~/bin && pwd", check: { cmd: /mkdir.*bin/, out: /\/bin/ } },
    { title: "Das Skript schreiben", text: `Die erste Zeile <code>#!/bin/bash</code> heißt <b>Shebang</b>: Sie sagt dem System, welches Programm das Skript ausführt. Zeilen mit <code>#</code> sind Kommentare.`,
      cmd: `cat > ~/bin/hallo.sh << 'EOF'
#!/bin/bash
# hallo.sh – mein erstes Skript
echo "Hallo $USER, heute ist $(date +%A), der $(date +%d.%m.%Y)."
echo "Dieser Rechner heißt $(hostname) und läuft $(uptime -p)."
EOF`, check: { cmd: /cat\s*>\s*~\/bin\/hallo\.sh/ },
      explain: `<code>$(befehl)</code> setzt die Ausgabe eines Befehls in den Text ein (<b>Befehlsersetzung</b>). Das <code>'EOF'</code> in Anführungszeichen sorgt dafür, dass beim Schreiben der Datei noch nichts ersetzt wird – erst beim Ausführen.` },
    { title: "Ausführbar machen und starten", cmd: ["chmod +x ~/bin/hallo.sh", "~/bin/hallo.sh"], check: { cmd: /hallo\.sh\s*$/, out: /Hallo/ },
      explain: `Ohne das Ausführrecht (<code>x</code>) kommt „Permission denied“. Alternativ geht immer <code>bash hallo.sh</code> – dann braucht es kein <code>x</code> und keinen Shebang.` },
    { title: "Ohne Pfad aufrufen", text: `Befehle wie <code>ls</code> findet die Shell, weil ihr Ordner in der Variable <code>PATH</code> steht. Nimm <code>~/bin</code> dazu:`,
      cmd: ["echo $PATH", 'export PATH="$HOME/bin:$PATH"', "hallo.sh"], check: { cmd: /^hallo\.sh/, out: /Hallo/ },
      explain: `Das <code>export</code> gilt nur für diese Sitzung. Ubuntu nimmt <code>~/bin</code> aber bei jeder neuen Anmeldung automatisch in den PATH auf (steht in <code>~/.profile</code>). Wo ein Befehl liegt, zeigt <code>which hallo.sh</code>.` },
    { title: "Fehlersuche mit -x", text: `<code>bash -n</code> prüft nur die Syntax, <code>bash -x</code> zeigt jede Zeile, bevor sie läuft – mit <code>+</code> davor:`,
      cmd: ["bash -n ~/bin/hallo.sh && echo Syntax ok", "bash -x ~/bin/hallo.sh"], check: { cmd: /bash\s+-x/, out: /^\+ /m },
      explain: `Im Skript selbst schaltest du das mit <code>set -x</code> ein und mit <code>set +x</code> wieder aus – praktisch, wenn nur ein Teil untersucht werden soll.` },
  ],
},
{
  id: "x2-vars", mode: "ssh", vm: "uebung", topic: "script", stage: 2, prep: "mkdir -p /home/ubuntu/bin && chown ubuntu:ubuntu /home/ubuntu/bin", group: "script", title: "Variablen, Parameter & Rechnen",
  intro: `Skripte werden erst nützlich, wenn sie mit verschiedenen Werten arbeiten: Variablen, Parameter beim Aufruf und Eingaben.`,
  steps: [
    { title: "Variablen und Anführungszeichen", cmd: ['ORT="Calw Stadt"', 'echo "Ich bin in $ORT"', "echo 'Ich bin in $ORT'"], check: { cmd: /^echo\s+'[^']*\$ORT/, out: /in \$ORT/ },
      explain: `Kein Leerzeichen um das <code>=</code>! In <b>doppelten</b> Anführungszeichen werden Variablen ersetzt, in <b>einfachen</b> nicht. Faustregel: Variablen immer in doppelte Anführungszeichen setzen (<code>"$ORT"</code>), sonst zerfallen Werte mit Leerzeichen in mehrere Wörter.` },
    { title: "Ein Skript mit Parametern", cmd: `cat > ~/bin/gruss.sh << 'EOF'
#!/bin/bash
# Aufruf: gruss.sh NAME [ANZAHL]
NAME="\${1:-Welt}"     # 1. Parameter – oder "Welt", wenn keiner da ist
ANZAHL="\${2:-1}"      # 2. Parameter – oder 1
echo "Skript $0 wurde mit $# Parameter(n) aufgerufen: $*"
for ((i = 1; i <= ANZAHL; i++)); do
  echo "$i. Hallo $NAME!"
done
EOF
chmod +x ~/bin/gruss.sh`, check: { cmd: /cat\s*>\s*~\/bin\/gruss\.sh/ } },
    { title: "Aufrufen", cmd: ["~/bin/gruss.sh", "~/bin/gruss.sh Ömer 3"], check: { cmd: /gruss\.sh\s+\S+\s+\d/, out: /3\. Hallo/ },
      explain: `<table><tr><td><code>$1</code>, <code>$2</code> …</td><td>Parameter</td></tr><tr><td><code>$0</code></td><td>Name des Skripts</td></tr><tr><td><code>$#</code></td><td>Anzahl der Parameter</td></tr><tr><td><code>"$@"</code></td><td>alle Parameter einzeln (für Schleifen)</td></tr><tr><td><code>\${VAR:-wert}</code></td><td>Standardwert, falls leer</td></tr></table>` },
    { title: "Rechnen", text: `Bash rechnet mit ganzen Zahlen in <code>$(( … ))</code>:`,
      cmd: ["echo $(( 17 + 4 * 2 ))", "BELEGT=$(df --output=pcent / | tail -1 | tr -dc 0-9)", 'echo "Belegt: $BELEGT %, frei: $(( 100 - BELEGT )) %"'],
      check: { cmd: /\$\(\(\s*100\s*-/, out: /frei: \d+ %/ },
      explain: `<code>tr -dc 0-9</code> löscht alles außer Ziffern – so wird aus „ 23%“ die Zahl 23. Kommazahlen kann Bash nicht; dafür nimmt man <code>bc</code> oder <code>awk</code>.` },
    { title: "Eingaben abfragen", text: `Tipp nach dem Befehl einen Servernamen ein und drück Enter:`,
      cmd: `read -p "Welcher Server? " SERVER && echo "Prüfe $SERVER …"`, check: { cmd: /^read\s/, out: /Prüfe/ },
      explain: `<code>read -s</code> zeigt die Eingabe nicht an (für Passwörter). Für Skripte, die nachts laufen, sind Abfragen ungeeignet – dort nimmst du Parameter.` },
  ],
},
{
  id: "x3-if", mode: "ssh", vm: "uebung", topic: "script", stage: 2, prep: "mkdir -p /home/ubuntu/bin && chown ubuntu:ubuntu /home/ubuntu/bin", group: "script", title: "Bedingungen & Exit-Codes",
  intro: `Jeder Befehl meldet beim Beenden einen <b>Exit-Code</b>: 0 heißt Erfolg, alles andere Fehler. Darauf bauen <code>if</code>, <code>&amp;&amp;</code> und <code>||</code> auf – und Monitoring-Systeme, die deine Skripte überwachen.`,
  steps: [
    { title: "Exit-Codes ansehen", cmd: ["grep -q ubuntu /etc/passwd; echo $?", "grep -q gibtsnicht /etc/passwd; echo $?"], check: { cmd: /gibtsnicht.*echo\s+\$\?/, out: /^1\s*$/m },
      explain: `<code>-q</code> = quiet: grep gibt nichts aus, sondern meldet das Ergebnis nur über den Exit-Code.` },
    { title: "Tests mit [[ ]]", cmd: ['[[ -d /etc ]] && echo "/etc ist ein Ordner" || echo "kein Ordner"', 'n=7; [[ $n -gt 5 ]] && echo "$n ist größer als 5"'],
      check: { cmd: /\[\[\s*\$n\s+-gt/, out: /größer als 5/ },
      explain: `<table><tr><td><code>-f datei</code> / <code>-d ordner</code></td><td>existiert (Datei / Ordner)</td></tr><tr><td><code>-z "$x"</code> / <code>-n "$x"</code></td><td>leer / nicht leer</td></tr><tr><td><code>-eq -ne -lt -gt -le -ge</code></td><td>Zahlen vergleichen</td></tr><tr><td><code>==</code> / <code>!=</code></td><td>Text vergleichen (in <code>[[ ]]</code> auch mit Mustern: <code>== *.log</code>)</td></tr></table>` },
    { title: "Ein Prüfskript", cmd: `cat > ~/bin/dienst.sh << 'EOF'
#!/bin/bash
# Prüft, ob ein Dienst läuft. Exit-Code: 0 = läuft, 1 = läuft nicht, 2 = falscher Aufruf
if [[ $# -ne 1 ]]; then
  echo "Aufruf: $0 DIENST" >&2
  exit 2
fi
if systemctl is-active --quiet "$1"; then
  echo "✅ $1 läuft"
else
  echo "❌ $1 ist aus"
  exit 1
fi
EOF
chmod +x ~/bin/dienst.sh`, check: { cmd: /cat\s*>\s*~\/bin\/dienst\.sh/ },
      explain: `<code>&gt;&amp;2</code> schreibt die Meldung auf den Fehlerkanal (stderr). <code>exit</code> beendet das Skript mit dem angegebenen Code.` },
    { title: "Alle drei Fälle testen", cmd: ['~/bin/dienst.sh cron; echo "Exit: $?"', '~/bin/dienst.sh gibtsnicht; echo "Exit: $?"', '~/bin/dienst.sh; echo "Exit: $?"'],
      check: { cmd: /dienst\.sh\s*;\s*echo/, out: /Exit: 2/, err: true },
      explain: `Genau so arbeiten Monitoring-Werkzeuge wie Nagios oder Icinga: Sie starten ein Prüfskript und werten nur den Exit-Code aus.` },
    { title: "Mehrere Fälle: case", cmd: `TAG=$(date +%u); case $TAG in 6|7) echo "Wochenende – kein Backup" ;; 1) echo "Montag – Vollbackup" ;; *) echo "Tag $TAG – inkrementelles Backup" ;; esac`,
      check: { cmd: /case\s/, out: /backup/i },
      explain: `<code>case</code> ist übersichtlicher als viele <code>elif</code>. Typisch in Skripten mit Unterbefehlen: <code>case "$1" in start) … ;; stop) … ;; *) echo "Aufruf: $0 start|stop" ;; esac</code>.` },
  ],
},
{
  id: "x4-loops", mode: "ssh", vm: "uebung", topic: "script", stage: 2, group: "script", title: "Schleifen & Dateien verarbeiten",
  intro: `Hier spart ein Skript am meisten Arbeit: dieselbe Aufgabe für 3, 300 oder 3000 Dateien, Server oder Benutzer.`,
  steps: [
    { title: "for über eine Liste", cmd: `for srv in web01 db01 mail01; do echo "Sichere $srv …"; done`, check: { cmd: /^for\s+\w+\s+in\s/, out: /mail01/ } },
    { title: "for über Dateien", cmd: `for f in /etc/*.conf; do [[ -r $f ]] || continue; echo "$(wc -l < "$f") $f"; done | sort -n | tail -5`,
      check: { cmd: /for\s+f\s+in\s+\/etc/, out: /\.conf/ },
      explain: `<code>continue</code> springt zum nächsten Durchlauf – hier für Dateien, die du nicht lesen darfst. <code>break</code> würde die Schleife ganz verlassen. Die ganze Schleife lässt sich in eine Pipe schicken.` },
    { title: "Eine CSV-Datei anlegen", cmd: `cat > ~/mitarbeiter.csv << 'EOF'
vorname;nachname;abteilung
Lena;Hoffmann;Vertrieb
Max;Becker;IT
Sara;Yilmaz;Buchhaltung
EOF`, check: { cmd: /mitarbeiter\.csv/ } },
    { title: "Zeile für Zeile lesen", cmd: `tail -n +2 ~/mitarbeiter.csv | while IFS=';' read -r vor nach abt; do echo "\${vor,,}.\${nach,,} → $abt"; done`,
      check: { cmd: /while\s+IFS=/, out: /lena\.hoffmann/ },
      explain: `<code>tail -n +2</code> überspringt die Kopfzeile. <code>IFS=';'</code> legt das Trennzeichen fest, <code>-r</code> lässt Backslashes in Ruhe. <code>\${vor,,}</code> macht den Wert klein (<code>\${vor^^}</code> groß). So entstehen aus einer Excel-Liste Benutzernamen.` },
    { title: "Warten, bis etwas klappt", cmd: `n=0; until ping -c1 -W1 1.1.1.1 >/dev/null; do ((n++)); echo "Versuch $n fehlgeschlagen"; sleep 1; done; echo "Netz da nach $n Fehlversuchen"`,
      check: { cmd: /^n=0;\s*until|until\s/, out: /Netz da/ },
      explain: `<code>until</code> läuft, <b>bis</b> der Befehl Erfolg meldet, <code>while</code> <b>solange</b> er Erfolg meldet. Typisch beim Start: warten, bis die Datenbank erreichbar ist. In echt baust du noch eine Höchstzahl an Versuchen ein.` },
    { title: "Zahlenbereiche", cmd: ["for i in {1..5}; do touch ~/test-$i.log; done; ls ~/test-*.log", "rm ~/test-*.log"], check: { cmd: /\{1\.\.5\}/, out: /test-5\.log/ },
      explain: `<code>{01..12}</code> erzeugt auch führende Nullen – praktisch für Monatsordner. Mit Variablen geht <code>for ((i=1; i&lt;=n; i++))</code> oder <code>$(seq 1 $n)</code>.` },
  ],
},
{
  id: "x5-func", mode: "ssh", vm: "uebung", topic: "script", stage: 2, prep: "mkdir -p /home/ubuntu/bin && chown ubuntu:ubuntu /home/ubuntu/bin", group: "script", title: "Funktionen, Fehler & Logging",
  intro: `Skripte, die nachts unbeaufsichtigt laufen, müssen Fehler bemerken, sauber aufräumen und protokollieren, was passiert ist.`,
  steps: [
    { title: "Eine Funktion zum Protokollieren", cmd: [`log() { echo "$(date '+%F %T') [$1] \${*:2}"; }`, `log INFO "Backup gestartet"`], check: { cmd: /^log\s+INFO/, out: /\[INFO\] Backup gestartet/ },
      explain: `In Funktionen sind <code>$1</code>, <code>$2</code> … die Parameter der Funktion. <code>\${*:2}</code> heißt „alle Parameter ab dem zweiten“. Funktionen müssen im Skript <b>vor</b> ihrem ersten Aufruf stehen.` },
    { title: "Der strenge Modus", text: `Normalerweise macht ein Skript nach einem Fehler einfach weiter – gefährlich, wenn danach z. B. etwas gelöscht wird. Die Zeile <code>set -euo pipefail</code> stoppt beim ersten Fehler:`,
      cmd: [`cat > ~/bin/streng.sh << 'EOF'
#!/bin/bash
set -euo pipefail
echo "Schritt 1"
cp /gibt/es/nicht /tmp/
echo "Schritt 2 – wird nie erreicht"
EOF
chmod +x ~/bin/streng.sh`, `~/bin/streng.sh; echo "Exit: $?"`],
      check: { cmd: /streng\.sh\s*;\s*echo/, out: /Exit: 1/, err: true },
      explain: `<code>-e</code> = bei Fehler abbrechen, <code>-u</code> = unbekannte Variablen sind ein Fehler (Tippfehler in Variablennamen!), <code>-o pipefail</code> = ein Fehler irgendwo in einer Pipe zählt. Gehört in jedes ernsthafte Skript.` },
    { title: "Aufräumen mit trap", cmd: [`cat > ~/bin/aufraeumen.sh << 'EOF'
#!/bin/bash
set -euo pipefail
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"; echo "🧹 $TMP gelöscht"' EXIT
trap 'echo "❌ Abbruch in Zeile $LINENO" >&2' ERR
echo "Arbeite in $TMP"
touch "$TMP/zwischenstand.txt"
false   # simuliert einen Fehler
echo "nie erreicht"
EOF
chmod +x ~/bin/aufraeumen.sh`, "~/bin/aufraeumen.sh"],
      check: { cmd: /aufraeumen\.sh\s*$/, out: /gelöscht/, err: true },
      explain: `<code>trap … EXIT</code> läuft immer, wenn das Skript endet – ob erfolgreich oder nicht. Ideal, um temporäre Dateien oder Sperrdateien zu entfernen.` },
    { title: "Ins Systemprotokoll schreiben", cmd: [`logger -t meinskript "Backup fertig: 42 Dateien"`, "journalctl -t meinskript --no-pager -n 3"], check: { cmd: /journalctl\s+-t/, out: /Backup fertig/ },
      explain: `So landen Meldungen deiner Skripte im zentralen Log (journald/syslog) – dort sucht jeder Admin zuerst und von dort kann das Monitoring sie einsammeln.` },
    { title: "Qualitätsprüfung mit shellcheck", text: `<code>shellcheck</code> findet typische Fehler in Skripten, z. B. fehlende Anführungszeichen:`,
      cmd: ["sudo apt-get install -y -qq shellcheck", "shellcheck ~/bin/gruss.sh ~/bin/dienst.sh && echo 'Keine Beanstandungen'"], check: { cmd: /^shellcheck\s/, err: true },
      explain: `Jede Meldung hat eine Nummer wie <code>SC2086</code> – danach kannst du im Netz suchen. In VS Code gibt es eine Erweiterung, die das schon beim Tippen prüft.` },
  ],
},
{
  id: "x6-report", mode: "ssh", vm: "server", topic: "script", stage: 3, group: "script", title: "Projekt: Systembericht mit Optionen & cron",
  intro: `Zum Abschluss ein Skript wie aus dem Admin-Alltag: Es sammelt den Zustand des Servers, versteht Optionen wie <code>-o datei</code> und <code>-h</code> und läuft jeden Morgen automatisch.`,
  steps: [
    { title: "Das Skript", cmd: `cat > ~/bin/sysbericht.sh << 'EOF'
#!/bin/bash
# sysbericht.sh – kurzer Zustandsbericht des Servers
# Aufruf: sysbericht.sh [-o DATEI] [-h]
set -euo pipefail

AUSGABE=""
hilfe() { echo "Aufruf: $(basename "$0") [-o DATEI] [-h]"; }

while getopts "o:h" opt; do
  case $opt in
    o) AUSGABE="$OPTARG" ;;
    h) hilfe; exit 0 ;;
    *) hilfe >&2; exit 2 ;;
  esac
done

bericht() {
  echo "=== Systembericht $(hostname) – $(date '+%F %T') ==="
  echo "Laufzeit:  $(uptime -p)"
  echo "Last:      $(cut -d' ' -f1-3 /proc/loadavg)"
  echo "RAM frei:  $(free -h | awk '/^Mem/ {print $7}')"
  echo
  echo "--- Plattenplatz ---"
  df -h -x tmpfs -x squashfs -x devtmpfs -x efivarfs --output=target,pcent,avail
  echo
  echo "--- Top 3 Prozesse (CPU) ---"
  ps -eo pcpu,comm --sort=-pcpu | head -4
  echo
  echo "--- Fehlgeschlagene Dienste ---"
  systemctl --failed --no-legend --plain | grep . || echo "keine"
}

if [[ -n $AUSGABE ]]; then
  bericht > "$AUSGABE"
  echo "Bericht gespeichert: $AUSGABE"
else
  bericht
fi
EOF
chmod +x ~/bin/sysbericht.sh`, check: { cmd: /cat\s*>\s*~\/bin\/sysbericht\.sh/ },
      explain: `<code>getopts "o:h"</code> liest Optionen: <code>o:</code> erwartet einen Wert (landet in <code>$OPTARG</code>), <code>h</code> nicht. Unbekannte Optionen landen im Fall <code>*</code>.` },
    { title: "Ausprobieren", cmd: ["~/bin/sysbericht.sh", "~/bin/sysbericht.sh -o ~/bericht.txt && cat ~/bericht.txt", "~/bin/sysbericht.sh -h"],
      check: { cmd: /sysbericht\.sh\s+-o/, out: /Bericht gespeichert/ } },
    { title: "Jeden Werktag um 7 Uhr", text: `Dein eigener Benutzer hat auch eine crontab – für Skripte, die keine Root-Rechte brauchen:`,
      cmd: ["mkdir -p ~/berichte", `(crontab -l 2>/dev/null; echo "0 7 * * 1-5 $HOME/bin/sysbericht.sh -o $HOME/berichte/bericht.txt") | crontab -`, "crontab -l"],
      check: { cmd: /crontab\s+-l\s*$/, out: /sysbericht/ },
      explain: `In cron gibt es kein <code>~</code> und nur einen minimalen PATH – deshalb immer volle Pfade. Ein <code>%</code> hat in der crontab eine Sonderbedeutung und muss als <code>\\%</code> geschrieben werden (z. B. für <code>$(date +\\%F)</code> im Dateinamen).` },
    { title: "Wie geht's weiter?", text: `<ul><li>Im Tab <b>🎯 Missionen</b> warten Skript-Aufgaben ohne Anleitung: ein Backup mit Rotation, eine Platzwarnung mit Exit-Codes und eine Log-Auswertung. Geprüft wird mit <b>eigenen Testdaten</b> – dein Skript muss also wirklich allgemein funktionieren.</li><li>Im <b>🔁 Training</b> kommen Skript-Karten dazu.</li><li>Gewohnheit für die Praxis: jedes Skript mit Kopfkommentar, <code>set -euo pipefail</code>, Hilfe bei falschem Aufruf und sinnvollen Exit-Codes.</li></ul>` },
  ],
},

/* ===================================================================== */
/* WINDOWS · TEIL 4 – POWERSHELL-SKRIPTE (PowerShell 7 in der VM)        */
/* ===================================================================== */
{
  id: "y1-param", mode: "ps", vm: "uebung", topic: "ps-script", stage: 2, prep: "command -v pwsh >/dev/null || { echo \"Installiere PowerShell 7 …\"; snap install powershell --classic >/dev/null; }; mkdir -p /home/ubuntu/ps-lab /home/ubuntu/skripte && chown ubuntu:ubuntu /home/ubuntu/ps-lab /home/ubuntu/skripte", group: "ps-script", title: "Skripte mit Parametern & Hilfe",
  intro: `Ein gutes Skript bedient sich wie ein Cmdlet: mit benannten Parametern, Prüfung der Eingaben und eingebauter Hilfe. Deine Skripte kommen nach <code>~/skripte</code>. Mehrzeilige Blöcke mit „übernehmen“ einfügen und Enter drücken.`,
  steps: [
    { title: "Das Skript", cmd: `New-Item ~/skripte -ItemType Directory -Force | Out-Null
Set-Content ~/skripte/Get-Ordnerbericht.ps1 -Value @'
<#
.SYNOPSIS
  Zeigt die größten Dateien eines Ordners.
.EXAMPLE
  ./Get-Ordnerbericht.ps1 -Pfad /var/log -Anzahl 3
#>
param(
    [Parameter(Mandatory)]
    [string]$Pfad,

    [ValidateRange(1, 50)]
    [int]$Anzahl = 5,

    [switch]$Rekursiv
)
Get-ChildItem -Path $Pfad -File -Recurse:$Rekursiv -ErrorAction SilentlyContinue |
    Sort-Object Length -Descending |
    Select-Object -First $Anzahl Name, @{ n = 'KB'; e = { [math]::Round($_.Length / 1KB, 1) } }
'@`, check: { cmd: /set-content.*get-ordnerbericht\.ps1/i },
      explain: `<code>param()</code> muss ganz oben stehen (nur Kommentare davor). <code>[Parameter(Mandatory)]</code> = Pflicht, <code>= 5</code> = Standardwert, <code>[switch]</code> = Schalter ohne Wert (an/aus).` },
    { title: "Aufrufen", cmd: ["~/skripte/Get-Ordnerbericht.ps1 -Pfad /var/log", "~/skripte/Get-Ordnerbericht.ps1 -Pfad /usr/share -Anzahl 3 -Rekursiv"],
      check: { cmd: /-rekursiv/i, out: /KB/ },
      explain: `Mit <kbd>Tab</kbd> nach dem Bindestrich vervollständigt PowerShell sogar die Parameter deines eigenen Skripts.` },
    { title: "Eingaben prüfen lassen", text: `Was passiert bei einem unzulässigen Wert?`, cmd: "~/skripte/Get-Ordnerbericht.ps1 -Pfad /etc -Anzahl 99",
      check: { cmd: /-anzahl\s+99/i, out: /validate|50/i, err: true },
      explain: `<code>[ValidateRange()]</code>, <code>[ValidateSet('a','b')]</code>, <code>[ValidatePattern()]</code> und <code>[ValidateScript({ … })]</code> prüfen Eingaben, bevor dein Code läuft – du sparst dir viele <code>if</code>-Abfragen.` },
    { title: "Eingebaute Hilfe", cmd: ["Get-Help ~/skripte/Get-Ordnerbericht.ps1", "Get-Help ~/skripte/Get-Ordnerbericht.ps1 -Examples"], check: { cmd: /get-help.*-examples/i, out: /EXAMPLE/ },
      explain: `Der Kommentarblock <code>&lt;# … #&gt;</code> mit <code>.SYNOPSIS</code>, <code>.DESCRIPTION</code>, <code>.PARAMETER</code> und <code>.EXAMPLE</code> wird automatisch zur Hilfe – so wie bei den eingebauten Cmdlets.` },
  ],
},
{
  id: "y2-logic", mode: "ps", vm: "uebung", topic: "ps-script", stage: 2, prep: "command -v pwsh >/dev/null || { echo \"Installiere PowerShell 7 …\"; snap install powershell --classic >/dev/null; }; mkdir -p /home/ubuntu/ps-lab /home/ubuntu/skripte && chown ubuntu:ubuntu /home/ubuntu/ps-lab /home/ubuntu/skripte", group: "ps-script", title: "Vergleiche, if & switch",
  intro: `PowerShell vergleicht mit Operatoren wie <code>-eq</code> statt <code>==</code>. Dazu kommen mächtige Werkzeuge für Muster: <code>-like</code>, <code>-match</code> und <code>switch</code>.`,
  steps: [
    { title: "Vergleichsoperatoren", cmd: [`5 -gt 3`, `'Server01' -like 'server*'`, `'web-03' -match '\\d+$'; $Matches[0]`, `'IT' -in 'IT', 'Vertrieb'`], check: { cmd: /-in\s+'IT'/i, out: /True/ },
      explain: `<table><tr><td><code>-eq -ne -gt -ge -lt -le</code></td><td>gleich, ungleich, größer, kleiner …</td></tr><tr><td><code>-like</code></td><td>Platzhalter <code>*</code> und <code>?</code></td></tr><tr><td><code>-match</code></td><td>regulärer Ausdruck, Treffer in <code>$Matches</code></td></tr><tr><td><code>-in</code> / <code>-contains</code></td><td>Wert in Liste</td></tr></table>` },
    { title: "Groß- und Kleinschreibung", cmd: [`'ABC' -eq 'abc'`, `'ABC' -ceq 'abc'`], check: { cmd: /-ceq/i, out: /False/ },
      explain: `Standardmäßig ignoriert PowerShell die Schreibweise. Mit <code>c</code> davor (<code>-ceq</code>, <code>-clike</code>, <code>-cmatch</code>) wird sie beachtet.` },
    { title: "switch statt vieler elseif", cmd: `$code = 404; switch ($code) { 200 { 'OK' } { $_ -ge 500 } { 'Serverfehler' } { $_ -ge 400 } { 'Clientfehler' } default { 'Unbekannt' } }`,
      check: { cmd: /switch\s*\(\$code\)/i, out: /Clientfehler/ },
      explain: `Ein Fall kann ein Wert oder ein Skriptblock mit Bedingung sein. <code>$_</code> ist der geprüfte Wert. Ohne <code>break</code> werden <b>alle</b> passenden Fälle ausgeführt.` },
    { title: "switch über viele Werte", cmd: `$conf = 0; $rest = 0; switch -Wildcard (Get-ChildItem /etc -File -Name) { '*.conf' { $conf++ } default { $rest++ } }; "conf: $conf, andere: $rest"`,
      check: { cmd: /switch\s+-wildcard/i, out: /conf: \d+/ },
      explain: `Bekommt <code>switch</code> eine Liste, prüft es jedes Element. Mit <code>-Wildcard</code> oder <code>-Regex</code> vergleicht es mit Mustern, mit <code>-File datei.txt</code> sogar Zeile für Zeile.` },
    { title: "if, elseif, else", cmd: `$p = '/etc/nginx'; if (Test-Path $p -PathType Container) { "$p ist ein Ordner" } elseif (Test-Path $p) { "$p ist eine Datei" } else { "$p gibt es nicht" }`,
      check: { cmd: /elseif/i, out: /\/etc\/nginx (ist|gibt)/ } },
  ],
},
{
  id: "y3-loops", mode: "ps", vm: "uebung", topic: "ps-script", stage: 2, prep: "command -v pwsh >/dev/null || { echo \"Installiere PowerShell 7 …\"; snap install powershell --classic >/dev/null; }; mkdir -p /home/ubuntu/ps-lab /home/ubuntu/skripte && chown ubuntu:ubuntu /home/ubuntu/ps-lab /home/ubuntu/skripte", group: "ps-script", title: "Schleifen & Ergebnisse sammeln",
  intro: `In Skripten sammelst du oft Ergebnisse – etwa den Zustand vieler Server – und gibst sie am Ende als Tabelle oder CSV aus. Der Trick: eigene Objekte bauen.`,
  steps: [
    { title: "Namen erzeugen", cmd: `1..5 | ForEach-Object { 'Server{0:D2}' -f $_ }`, check: { cmd: /-f\s+\$_/i, out: /Server05/ },
      explain: `<code>-f</code> ist der Format-Operator: <code>{0}</code> ist der erste Wert, <code>:D2</code> heißt zweistellig mit führender Null.` },
    { title: "Eigene Objekte sammeln", cmd: `$ergebnis = foreach ($ziel in 'example.com', 'github.com', 'gibt-es-nicht.invalid') {
    [PSCustomObject]@{
        Ziel     = $ziel
        Erreicht = [bool](Test-Connection $ziel -TcpPort 443 -TimeoutSeconds 2 -ErrorAction SilentlyContinue)
    }
}
$ergebnis`, check: { cmd: /pscustomobject/i, out: /invalid\s+False/ },
      explain: `Alles, was eine Schleife ausgibt, landet in der Variable davor. Das ist schneller und einfacher als <code>$liste += …</code>.` },
    { title: "Weiterverarbeiten", cmd: [`$ergebnis | Export-Csv ~/skripte/erreichbar.csv`, `Import-Csv ~/skripte/erreichbar.csv | Where-Object Erreicht -eq 'False'`],
      check: { cmd: /import-csv.*erreichbar/i, out: /invalid/ },
      explain: `Nach dem Weg durch die CSV-Datei ist alles Text – deshalb der Vergleich mit <code>'False'</code> in Anführungszeichen.` },
    { title: "Wiederholen bis Erfolg", cmd: `$versuch = 0; do { $versuch++; "Versuch $versuch"; $ok = (Get-Random -Maximum 3) -eq 0 } until ($ok -or $versuch -ge 5); if ($ok) { "Geklappt nach $versuch Versuchen" } else { "Aufgegeben" }`,
      check: { cmd: /until\s*\(/i, out: /Geklappt|Aufgegeben/ },
      explain: `Hier simuliert <code>Get-Random</code> einen wackeligen Dienst. In echten Skripten steht da z. B. ein Webaufruf – mit Höchstzahl an Versuchen und <code>Start-Sleep</code> dazwischen.` },
    { title: "continue und break", cmd: `foreach ($n in 1..20) { if ($n % 2) { continue }; if ($n -gt 10) { break }; $n }`, check: { cmd: /continue/i, out: /^10\s*$/m } },
  ],
},
{
  id: "y4-func", mode: "ps", vm: "uebung", topic: "ps-script", stage: 2, prep: "command -v pwsh >/dev/null || { echo \"Installiere PowerShell 7 …\"; snap install powershell --classic >/dev/null; }; mkdir -p /home/ubuntu/ps-lab /home/ubuntu/skripte && chown ubuntu:ubuntu /home/ubuntu/ps-lab /home/ubuntu/skripte", group: "ps-script", title: "Funktionen wie echte Cmdlets",
  intro: `Mit <code>[CmdletBinding()]</code> wird aus einer einfachen Funktion eine <b>erweiterte Funktion</b>: Sie nimmt Daten aus der Pipeline, kennt <code>-Verbose</code> und <code>-WhatIf</code> und fühlt sich an wie ein eingebautes Cmdlet.`,
  steps: [
    { title: "Funktion mit Pipeline-Eingabe", cmd: `function Get-Dateialter {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [System.IO.FileInfo]$Datei
    )
    process {
        Write-Verbose "Prüfe $($Datei.FullName)"
        [PSCustomObject]@{
            Name = $Datei.Name
            Tage = [int]((Get-Date) - $Datei.LastWriteTime).TotalDays
        }
    }
}`, check: { cmd: /function\s+get-dateialter/i },
      explain: `Der <code>process</code>-Block läuft für <b>jedes</b> Objekt aus der Pipeline einmal. Für Vorbereitung und Abschluss gibt es <code>begin</code> und <code>end</code>.` },
    { title: "In der Pipeline benutzen", cmd: "Get-ChildItem /var/log -File | Get-Dateialter | Sort-Object Tage -Descending | Select-Object -First 5",
      check: { cmd: /\|\s*get-dateialter/i, out: /Tage/ } },
    { title: "Was passiert gerade? -Verbose", cmd: "Get-Item /etc/hostname | Get-Dateialter -Verbose", check: { cmd: /-verbose/i, out: /VERBOSE: Prüfe/ },
      explain: `<code>Write-Verbose</code> bleibt stumm, bis jemand <code>-Verbose</code> angibt – perfekt für Details bei der Fehlersuche, ohne die normale Ausgabe zuzumüllen.` },
    { title: "Sicherheitsnetz -WhatIf", cmd: [`function Remove-Testdatei {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$Pfad)
    if ($PSCmdlet.ShouldProcess($Pfad, 'Löschen')) { Remove-Item $Pfad; "gelöscht: $Pfad" }
}`, "New-Item ~/skripte/weg.txt -Force | Out-Null", "Remove-Testdatei ~/skripte/weg.txt -WhatIf", "Remove-Testdatei ~/skripte/weg.txt"],
      check: { cmd: /remove-testdatei.*-whatif/i, out: /What if/i },
      explain: `Mit <code>SupportsShouldProcess</code> bekommt deine Funktion <code>-WhatIf</code> (nur zeigen) und <code>-Confirm</code> (nachfragen) geschenkt. Für alles, was löscht oder ändert, ein Muss.` },
    { title: "Eigenes Modul", text: `Funktionen, die du immer wieder brauchst, packst du in ein <b>Modul</b> (<code>.psm1</code>):`,
      cmd: [`Set-Content ~/skripte/AdminTools.psm1 -Value @'
function Get-Gruss {
    param([string]$Name = $env:USER)
    "Hallo $Name, es ist $(Get-Date -Format t) Uhr."
}
Export-ModuleMember -Function Get-Gruss
'@`, "Import-Module ~/skripte/AdminTools.psm1 -Force", "Get-Gruss", "Get-Command -Module AdminTools"],
      check: { cmd: /^get-gruss/i, out: /Hallo/ },
      explain: `Legst du das Modul in einen Ordner unter <code>$env:PSModulePath</code> (z. B. <code>~/.local/share/powershell/Modules/AdminTools/</code>), lädt PowerShell es automatisch.` },
  ],
},
{
  id: "y5-robust", mode: "ps", vm: "uebung", topic: "ps-script", stage: 2, prep: "command -v pwsh >/dev/null || { echo \"Installiere PowerShell 7 …\"; snap install powershell --classic >/dev/null; }; mkdir -p /home/ubuntu/ps-lab /home/ubuntu/skripte && chown ubuntu:ubuntu /home/ubuntu/ps-lab /home/ubuntu/skripte", group: "ps-script", title: "Robuste Skripte: Fehler, Exit-Codes & Protokoll",
  intro: `Ein Skript, das nachts als geplante Aufgabe läuft, muss drei Dinge können: Fehler sauber abfangen, protokollieren, was passiert ist, und per <b>Exit-Code</b> melden, ob alles geklappt hat.`,
  steps: [
    { title: "Das Skript", cmd: `Set-Content ~/skripte/Kopiere-Konfig.ps1 -Value @'
param([string]$Quelle = '/etc/hostname', [string]$Ziel = "$HOME/skripte/sicherung")
$ErrorActionPreference = 'Stop'      # jeder Fehler bricht ab → catch greift
$log = "$HOME/skripte/kopiere.log"
function Write-Log([string]$Text, [string]$Level = 'INFO') {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Text" | Tee-Object -FilePath $log -Append
}
try {
    Write-Log "Start: $Quelle -> $Ziel"
    New-Item $Ziel -ItemType Directory -Force | Out-Null
    Copy-Item $Quelle $Ziel
    Write-Log "Fertig"
    exit 0
}
catch [System.Management.Automation.ItemNotFoundException] {
    Write-Log "Quelle fehlt: $Quelle" 'FEHLER'
    exit 2
}
catch {
    Write-Log "Unerwartet: $($_.Exception.Message)" 'FEHLER'
    exit 1
}
'@`, check: { cmd: /set-content.*kopiere-konfig\.ps1/i },
      explain: `<code>$ErrorActionPreference = 'Stop'</code> macht aus jedem Fehler einen abbrechenden Fehler – sonst greift <code>catch</code> bei vielen Cmdlets gar nicht. Mehrere <code>catch</code>-Blöcke reagieren auf verschiedene Fehlerarten.` },
    { title: "Drei Läufe, drei Exit-Codes", cmd: [`~/skripte/Kopiere-Konfig.ps1; "Exit-Code: $LASTEXITCODE"`, `~/skripte/Kopiere-Konfig.ps1 -Quelle /gibt/es/nicht; "Exit-Code: $LASTEXITCODE"`, `~/skripte/Kopiere-Konfig.ps1 -Ziel /root/verboten; "Exit-Code: $LASTEXITCODE"`],
      check: { cmd: /-quelle\s+\/gibt/i, out: /Exit-Code: 2/, err: true },
      explain: `<code>$LASTEXITCODE</code> enthält den Exit-Code des letzten Skripts oder Programms. Die Aufgabenplanung, cron und Monitoring-Systeme werten genau diesen Wert aus.` },
    { title: "Das Protokoll", cmd: "Get-Content ~/skripte/kopiere.log", check: { cmd: /get-content.*kopiere\.log/i, out: /\[FEHLER\]/, err: true } },
    { title: "Eigene Fehler werfen", cmd: [`function Test-Port { param([int]$Port) if ($Port -notin 1..65535) { throw "Ungültiger Port: $Port" }; "Port $Port ok" }`, `try { Test-Port 99999 } catch { "Abgefangen: $_" }`],
      check: { cmd: /test-port\s+99999/i, out: /Abgefangen: Ungültiger Port/ },
      explain: `<code>throw</code> bricht ab und liefert eine eigene Fehlermeldung – sinnvoll, wenn Eingaben unsinnig sind und das Weitermachen Schaden anrichten würde.` },
    { title: "Alles mitschneiden", text: `<code>Start-Transcript -Path ~/skripte/lauf.txt</code> schreibt ab dann <b>alles</b> mit, was in der Konsole passiert, bis <code>Stop-Transcript</code>. Praktisch am Anfang eines Skripts, das unbeaufsichtigt läuft – so siehst du am nächsten Morgen genau, was los war.` },
  ],
},
{
  id: "y6-project", mode: "ps", vm: "uebung", topic: "ps-script", stage: 2, prep: "command -v pwsh >/dev/null || { echo \"Installiere PowerShell 7 …\"; snap install powershell --classic >/dev/null; }; mkdir -p /home/ubuntu/ps-lab /home/ubuntu/skripte && chown ubuntu:ubuntu /home/ubuntu/ps-lab /home/ubuntu/skripte", group: "ps-script", title: "Projekt: Aufräum-Skript mit -WhatIf",
  intro: `Zum Abschluss baust du ein Werkzeug, das in fast jeder Firma läuft: Es löscht alte Dateien (Logs, Downloads, temporäre Dateien) – mit Parametern, Eingabeprüfung, Probelauf und Ergebnisbericht.`,
  steps: [
    { title: "Das Skript", cmd: `Set-Content ~/skripte/Remove-AlteDateien.ps1 -Value @'
<#
.SYNOPSIS
  Löscht Dateien, die älter als N Tage sind – mit -WhatIf für den Probelauf.
.EXAMPLE
  ./Remove-AlteDateien.ps1 -Pfad /var/tmp/logs -Tage 30 -WhatIf
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidateScript({ Test-Path $_ -PathType Container })]
    [string]$Pfad,

    [ValidateRange(1, 3650)]
    [int]$Tage = 30,

    [string]$Filter = '*'
)
$grenze = (Get-Date).AddDays(-$Tage)
$alt = @(Get-ChildItem $Pfad -File -Filter $Filter | Where-Object LastWriteTime -lt $grenze)
$geloescht = 0
foreach ($d in $alt) {
    if ($PSCmdlet.ShouldProcess($d.Name, "Löschen (geändert $($d.LastWriteTime.ToString('dd.MM.yyyy')))")) {
        Remove-Item $d.FullName
        $geloescht++
    }
}
[PSCustomObject]@{ Gefunden = $alt.Count; Geloescht = $geloescht; Grenze = $grenze.ToString('dd.MM.yyyy') }
'@`, check: { cmd: /set-content.*remove-altedateien\.ps1/i } },
    { title: "Testdaten mit altem Datum", cmd: `New-Item ~/skripte/alt -ItemType Directory -Force | Out-Null; 1..6 | ForEach-Object { $f = New-Item ~/skripte/alt/log$_.txt -Force; $f.LastWriteTime = (Get-Date).AddDays(-10 * $_) }; Get-ChildItem ~/skripte/alt | Select-Object Name, LastWriteTime`,
      check: { cmd: /lastwritetime\s*=/i, out: /log6\.txt/ },
      explain: `<code>LastWriteTime</code> lässt sich setzen – so entstehen Dateien, die 10, 20 … 60 Tage alt wirken.` },
    { title: "Probelauf", cmd: "~/skripte/Remove-AlteDateien.ps1 -Pfad ~/skripte/alt -Tage 25 -WhatIf", check: { cmd: /-whatif/i, out: /What if/i } },
    { title: "Ernstfall", cmd: ["~/skripte/Remove-AlteDateien.ps1 -Pfad ~/skripte/alt -Tage 25", "Get-ChildItem ~/skripte/alt -Name"], check: { cmd: /remove-altedateien\.ps1.*-tage\s+25\s*$/i, out: /\b4\s+4\b/ } },
    { title: "Falscher Ordner?", cmd: "~/skripte/Remove-AlteDateien.ps1 -Pfad /gibt/es/nicht", check: { cmd: /-pfad\s+\/gibt/i, out: /validat/i, err: true },
      explain: `Die Prüfung schlägt an, bevor irgendetwas gelöscht wird. Mit <code>-Verbose</code> würde das Skript zusätzlich jede Datei melden, mit <code>-Confirm</code> vor jeder nachfragen.` },
    { title: "Wie geht's weiter?", text: `<ul><li>Im Tab <b>🎯 Missionen</b> warten Skript-Aufgaben ohne Anleitung: eine Benutzerliste umwandeln und eine Log-Rotation. Geprüft wird mit <b>eigenen Testdaten</b>.</li><li>Unter Windows planst du so ein Skript mit der Aufgabenplanung (Lektion „Skripte &amp; geplante Aufgaben“ im Sandbox-Teil), unter Linux mit cron.</li><li>Gewohnheit für die Praxis: Hilfe-Kommentar, <code>[CmdletBinding()]</code>, geprüfte Parameter, <code>-WhatIf</code> bei allem, was löscht, und ein Exit-Code fürs Monitoring.</li></ul>` },
  ],
},
);

window.DRILLS.push(
/* ---------- Bash-Skripte (VM) ---------- */
{ id: "sc-chmod", mode: "ssh", lvl: 1, after: "x1-first", q: "Mach die Datei <code>~/bin/hallo.sh</code> ausführbar.", a: "chmod +x ~/bin/hallo.sh", check: { cmd: /chmod\s+(?:[ugoa]*\+x|[0-7]?[57][0-7][0-7])\s+\S*hallo\.sh/ } },
{ id: "sc-syntax", mode: "ssh", lvl: 1, after: "x1-first", q: "Prüfe <code>~/bin/gruss.sh</code> auf Syntaxfehler, <b>ohne</b> es auszuführen.", a: "bash -n ~/bin/gruss.sh", check: { cmd: /bash\s+-n\s+\S*gruss\.sh/ } },
{ id: "sc-exit", mode: "ssh", lvl: 1, after: "x3-if", q: "Führe <code>ls /gibtsnicht</code> aus und zeige danach seinen Exit-Code.", a: "ls /gibtsnicht; echo $?", check: { cmd: /echo\s+\$\?/, out: /^2\s*$/m, err: true } },
{ id: "sc-var", mode: "ssh", lvl: 2, after: "x2-vars", q: "Speichere das heutige Datum im Format <code>2026-11-07</code> in der Variable <code>HEUTE</code> und gib sie aus.", a: "HEUTE=$(date +%F); echo $HEUTE", check: { cmd: /HEUTE=\$\(date\s+['"]?\+%(?:F|Y-%m-%d)/, out: /\d{4}-\d\d-\d\d/ } },
{ id: "sc-default", mode: "ssh", lvl: 2, after: "x2-vars", hint: "Ein Standardwert für leere Variablen: <code>${VAR:-…}</code>", q: "Gib den Inhalt von <code>$STADT</code> aus – oder <code>unbekannt</code>, wenn die Variable leer ist. Ohne <code>if</code>.", a: "echo \"${STADT:-unbekannt}\"", check: { cmd: /\$\{STADT:-/ } },
{ id: "sc-loop", mode: "ssh", lvl: 2, after: "x4-loops", q: "Gib mit einer Schleife die Zahlen 1 bis 10 untereinander aus.", a: "for i in {1..10}; do echo $i; done", check: { cmd: /^(for|while|until)\s/, out: /^10\s*$/m } },
{ id: "sc-months", mode: "ssh", lvl: 2, after: "x4-loops", q: "Lege die Ordner <code>~/archiv/2026-01</code> bis <code>~/archiv/2026-12</code> an – mit <b>einem</b> Befehl.", hint: "Klammererweiterung mit führender Null: <code>{01..12}</code>", a: "mkdir -p ~/archiv/2026-{01..12}", check: { cmd: /\{01\.\.12\}|seq\s+-w|for\s/ } },
{ id: "sc-disk", mode: "ssh", lvl: 3, after: "x3-if", q: "Gib <code>wenig Platz</code> aus, wenn <code>/</code> zu mehr als 80 % belegt ist, sonst <code>alles gut</code> – in einer Zeile.", hint: "Prozentzahl: <code>df --output=pcent / | tail -1 | tr -dc 0-9</code>", a: "[[ $(df --output=pcent / | tail -1 | tr -dc 0-9) -gt 80 ]] && echo \"wenig Platz\" || echo \"alles gut\"", check: { cmd: /df/, out: /wenig Platz|alles gut/ } },
{ id: "sc-func", mode: "ssh", lvl: 3, after: "x5-func", q: "Schreibe eine Funktion <code>quadrat</code>, die das Quadrat ihres Parameters ausgibt, und rufe sie mit 12 auf.", a: "quadrat() { echo $(( $1 * $1 )); }; quadrat 12", check: { cmd: /quadrat\s+12/, out: /^144\s*$/m } },
{ id: "sc-csv", mode: "ssh", lvl: 3, after: "x4-loops", q: "Gib aus <code>~/mitarbeiter.csv</code> nur die Vornamen der Abteilung <code>IT</code> aus.", hint: "Entweder <code>while IFS=';' read …</code> mit <code>if</code> oder <code>awk -F';'</code>.", a: "awk -F';' '$3 == \"IT\" {print $1}' ~/mitarbeiter.csv", check: { cmd: /mitarbeiter\.csv/, out: /^Max\s*$/m } },
/* ---------- PowerShell-Skripte (VM) ---------- */
{ id: "psc-help", mode: "ps", lvl: 1, after: "y1-param", q: "Zeige die Beispiele aus der Hilfe von <code>~/skripte/Get-Ordnerbericht.ps1</code>.", a: "Get-Help ~/skripte/Get-Ordnerbericht.ps1 -Examples", check: { cmd: /get-help.*ordnerbericht.*-ex/i } },
{ id: "psc-lastexit", mode: "ps", lvl: 1, after: "y5-robust", q: "Welchen Exit-Code hatte das zuletzt gestartete Skript oder Programm?", a: "$LASTEXITCODE", check: { cmd: /\$lastexitcode/i } },
{ id: "psc-names", mode: "ps", lvl: 2, after: "y3-loops", q: "Gib die Namen <code>PC01</code> bis <code>PC10</code> aus (immer zweistellig).", a: "1..10 | ForEach-Object { 'PC{0:D2}' -f $_ }", check: { cmd: /1\.\.10/, out: /PC01[\s\S]*PC10/ } },
{ id: "psc-obj", mode: "ps", lvl: 2, after: "y3-loops", q: "Erzeuge ein Objekt mit den Eigenschaften <code>Server = web01</code> und <code>Port = 443</code>.", a: "[PSCustomObject]@{ Server = 'web01'; Port = 443 }", check: { cmd: /pscustomobject/i, out: /web01/ } },
{ id: "psc-switch", mode: "ps", lvl: 2, after: "y2-logic", q: "Gib mit <code>switch</code> <code>Wochenende</code> oder <code>Arbeitstag</code> aus – je nach heutigem Wochentag.", hint: "<code>(Get-Date).DayOfWeek</code> liefert z. B. <code>Saturday</code>.", a: "switch ((Get-Date).DayOfWeek) { { $_ -in 'Saturday', 'Sunday' } { 'Wochenende' } default { 'Arbeitstag' } }", check: { cmd: /switch/i, out: /Wochenende|Arbeitstag/ } },
{ id: "psc-match", mode: "ps", lvl: 3, after: "y2-logic", q: "Hol mit <code>-match</code> die Zahl aus dem Text <code>'Fehlercode: 4711 (Datenbank)'</code> heraus und gib nur sie aus.", a: "if ('Fehlercode: 4711 (Datenbank)' -match '\\d+') { $Matches[0] }", check: { cmd: /-match/i, out: /^4711\s*$/m } },
{ id: "psc-throw", mode: "ps", lvl: 3, after: "y5-robust", q: "Fange den Fehler aus <code>throw 'Kaputt'</code> ab und gib stattdessen <code>Fehler: Kaputt</code> aus.", a: "try { throw 'Kaputt' } catch { \"Fehler: $_\" }", check: { cmd: /throw/i, out: /Fehler: Kaputt/ } },
);
