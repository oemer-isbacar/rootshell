/* Lektionen für Linux Lab
 * mode: "browser" (Mini-Linux im Browser, BusyBox, du bist root) | "ssh" (echte Ubuntu-VM)
 * Schritt: { title, text, cmd (in Terminal übernehmen), win (Befehl für Windows/PowerShell),
 *            task, hint, explain (wird nach Erledigung gezeigt), check: {cmd, out, notOut} | function(cmd, out) }
 * Ohne check → Button „Erledigt“.
 */
window.LESSONS = [
/* ===================================================================== */
/* TEIL 1 – GRUNDLAGEN IM MINI-LINUX                                     */
/* ===================================================================== */
{
  id: "b1-start", mode: "browser", title: "Erste Schritte in der Shell",
  intro: `Links läuft ein <b>echtes Linux</b> (Kernel 6.x + BusyBox) – direkt in deinem Browser. Du kannst nichts kaputt machen: Notfalls oben auf „Neu starten“. Die Zeile <code>~ #</code> ist der <b>Prompt</b>: <code>~</code> = du bist in deinem Home-Verzeichnis, <code>#</code> = du bist <b>root</b> (Administrator).`,
  steps: [
    { title: "Wer bin ich?", text: `Tippe den Befehl ins Terminal und drück <kbd>Enter</kbd>. Du kannst auch „übernehmen“ klicken – Enter drückst du dann selbst.`,
      cmd: "whoami", check: { cmd: /^whoami$/, out: /root/ },
      explain: `<code>root</code> ist der Superuser mit allen Rechten. Auf echten Servern arbeitest du normalerweise als normaler Benutzer und holst dir Rechte mit <code>sudo</code>.` },
    { title: "Wo bin ich?", text: `<code>pwd</code> = <i>print working directory</i>.`, cmd: "pwd", check: { cmd: /^pwd$/, out: /\// },
      explain: `<code>/root</code> ist das Home-Verzeichnis von root. Normale Benutzer haben ihr Home unter <code>/home/name</code>. Das Kürzel dafür ist <code>~</code>.` },
    { title: "Was liegt hier?", text: `<code>ls</code> listet den Inhalt eines Verzeichnisses. Mit <code>-la</code> siehst du <b>alle</b> Dateien (auch versteckte, die mit <code>.</code> beginnen) als <b>l</b>ange Liste.`,
      cmd: "ls -la", check: { cmd: /^ls\s+(-la|-al|-l\s+-a|-a\s+-l)\b/ },
      explain: `Die Einträge <code>.</code> (aktuelles Verzeichnis) und <code>..</code> (übergeordnetes Verzeichnis) gibt es in jedem Ordner.` },
    { title: "Welches System läuft hier?", cmd: "uname -a", check: { cmd: /^uname\s+-a/, out: /Linux/ },
      explain: `Zeigt Kernel-Name, Hostname, Kernel-Version und Architektur. Genauere Infos zur Distribution stehen in <code>/etc/os-release</code> – probier <code>cat /etc/os-release</code>.` },
    { title: "Text ausgeben", text: `<code>echo</code> gibt Text aus – praktisch in Skripten.`, cmd: 'echo "Hallo Linux"',
      task: "Lass die Shell deinen Namen ausgeben.", check: { cmd: /^echo\s+\S/ } },
    { title: "Hilfe bekommen", text: `Fast jeder Befehl kennt <code>--help</code>. Auf vollwertigen Systemen gibt es außerdem <code>man befehl</code> (Handbuch, Beenden mit <kbd>q</kbd>).`,
      cmd: "ls --help", check: { cmd: /--help|^man\s/ } },
    { title: "Aufräumen", text: `<code>clear</code> leert den Bildschirm (oder <kbd>Strg</kbd>+<kbd>L</kbd>).`, cmd: "clear", check: { cmd: /^clear$/ } },
  ],
  outro: `💡 <b>Tab-Vervollständigung</b>: Tippe <code>cat /etc/os</code> und drück <kbd>Tab</kbd> – die Shell ergänzt den Rest. Mit <kbd>↑</kbd> holst du alte Befehle zurück.`,
},
{
  id: "b2-nav", mode: "browser", title: "Im Dateisystem navigieren",
  intro: `Linux hat <b>einen</b> Verzeichnisbaum, der bei <code>/</code> (Root-Verzeichnis) beginnt – keine Laufwerksbuchstaben wie C:\\. Festplatten werden irgendwo in diesen Baum „eingehängt“ (gemountet).`,
  steps: [
    { title: "Zur Wurzel", cmd: "cd /", check: { cmd: /^cd\s+\/$/ } },
    { title: "Die wichtigsten Verzeichnisse", text: `Schau dir die oberste Ebene an:`, cmd: "ls /", check: { cmd: /^ls(\s+-\w+)*(\s+\/)?$/, out: /etc/ },
      explain: `<table><tr><th>Ordner</th><th>Inhalt</th></tr>
      <tr><td><code>/etc</code></td><td>Konfigurationsdateien</td></tr>
      <tr><td><code>/home</code></td><td>Home-Verzeichnisse der Benutzer</td></tr>
      <tr><td><code>/root</code></td><td>Home von root</td></tr>
      <tr><td><code>/bin</code>, <code>/usr/bin</code></td><td>Programme</td></tr>
      <tr><td><code>/sbin</code></td><td>Systemprogramme (Admin)</td></tr>
      <tr><td><code>/var</code></td><td>Variable Daten: Logs (<code>/var/log</code>), Webseiten, Datenbanken</td></tr>
      <tr><td><code>/tmp</code></td><td>Temporäre Dateien</td></tr>
      <tr><td><code>/dev</code></td><td>Geräte (Festplatten = <code>/dev/sda</code> …)</td></tr>
      <tr><td><code>/proc</code>, <code>/sys</code></td><td>Virtuelle Dateisysteme mit Kernel-Infos</td></tr>
      <tr><td><code>/mnt</code>, <code>/media</code></td><td>Einhängepunkte für Laufwerke</td></tr></table>` },
    { title: "In /etc wechseln", text: `Ein <b>absoluter Pfad</b> beginnt immer mit <code>/</code>.`, cmd: "cd /etc", check: { cmd: /^cd\s+\/etc\/?$/ } },
    { title: "Eine Ebene hoch", text: `<code>..</code> ist das übergeordnete Verzeichnis. Das ist ein <b>relativer Pfad</b> – relativ zu dort, wo du gerade bist.`,
      cmd: "cd ..", check: { cmd: /^cd\s+\.\.\/?$/ } },
    { title: "Relativ wechseln", task: "Du bist jetzt in <code>/</code>. Wechsle mit einem <b>relativen</b> Pfad nach <code>/var/log</code> (also ohne führenden Schrägstrich).",
      hint: `<code>cd var/log</code>`, check: { cmd: /^cd\s+var\/log\/?$/ } },
    { title: "Ab nach Hause", text: `<code>cd</code> ohne Argument (oder <code>cd ~</code>) bringt dich immer ins Home-Verzeichnis. <code>cd -</code> springt zum vorherigen Ordner.`,
      cmd: "cd ~", check: { cmd: /^cd(\s+~\/?)?$/ } },
    { title: "Baumansicht", text: `<code>tree</code> zeigt Ordner als Baum. <code>-L 1</code> begrenzt auf eine Ebene.`, cmd: "tree -L 1 /", check: { cmd: /^tree\b/ } },
  ],
},
{
  id: "b3-files", mode: "browser", title: "Dateien & Ordner verwalten",
  intro: `Die Werkzeuge, die du jeden Tag brauchst: anlegen, kopieren, verschieben, löschen. Achtung: Es gibt <b>keinen Papierkorb</b> – <code>rm</code> löscht sofort.`,
  steps: [
    { title: "Ordner anlegen", text: `<code>-p</code> legt auch fehlende Elternordner mit an.`, cmd: "mkdir -p projekte/webseite",
      check: { cmd: /^mkdir\s+(-p\s+)?\S*projekte/ } },
    { title: "Leere Datei anlegen", text: `<code>touch</code> erstellt eine leere Datei (oder aktualisiert den Zeitstempel einer bestehenden).`,
      cmd: "touch projekte/notizen.txt", check: { cmd: /^touch\s+\S+/ } },
    { title: "Text in eine Datei schreiben", text: `<code>&gt;</code> leitet die Ausgabe in eine Datei um (<b>überschreibt!</b>). <code>&gt;&gt;</code> hängt an.`,
      cmd: ['echo "Zeile 1" > projekte/notizen.txt', 'echo "Zeile 2" >> projekte/notizen.txt'],
      task: "Schreib mindestens zwei Zeilen in die Datei – die zweite mit <code>&gt;&gt;</code>.", check: { cmd: /^echo\s.*>>\s*\S+/ } },
    { title: "Datei anzeigen", cmd: "cat projekte/notizen.txt", check: { cmd: /^cat\s+\S*notizen/, out: /Zeile|\w/ } },
    { title: "Kopieren", text: `<code>cp quelle ziel</code>. Ordner kopierst du mit <code>cp -r</code>.`, cmd: "cp projekte/notizen.txt projekte/notizen.bak",
      check: { cmd: /^cp\s+/ } },
    { title: "Verschieben / Umbenennen", text: `<code>mv</code> verschiebt – und Umbenennen ist unter Linux einfach Verschieben.`,
      cmd: "mv projekte/notizen.bak projekte/webseite/", check: { cmd: /^mv\s+/ } },
    { title: "Kontrollieren", cmd: "ls -R projekte", check: { cmd: /^(ls\s+-R|tree)\b/ } },
    { title: "Löschen", text: `<code>rm datei</code> löscht eine Datei, <code>rm -r ordner</code> einen Ordner samt Inhalt, <code>rmdir</code> nur leere Ordner.`,
      cmd: "rm projekte/webseite/notizen.bak", check: { cmd: /^rm\s+/ },
      explain: `⚠️ <code>rm -rf /</code> & Co. löschen alles ohne Rückfrage. Gewöhn dir an, vor <code>rm -r</code> kurz mit <code>ls</code> zu prüfen, was du löschst.` },
  ],
},
{
  id: "b4-read", mode: "browser", title: "Dateien lesen & durchsuchen",
  intro: `Logs und Konfigdateien lesen, gezielt suchen – das ist im Admin-Alltag die halbe Miete.`,
  steps: [
    { title: "Benutzerliste lesen", text: `In <code>/etc/passwd</code> steht jeder Benutzer in einer Zeile.`, cmd: "cat /etc/passwd", check: { cmd: /\/etc\/passwd/, out: /root:/ },
      explain: `Aufbau: <code>name:x:UID:GID:Beschreibung:Home:Shell</code>. Das <code>x</code> heißt: Passwort-Hash steht in <code>/etc/shadow</code> (nur root lesbar).` },
    { title: "Seitenweise lesen", text: `<code>less</code> zum Blättern: <kbd>Leertaste</kbd>/<kbd>b</kbd> = Seite vor/zurück, <kbd>/</kbd>suchbegriff = suchen, <kbd>q</kbd> = beenden.`,
      cmd: "less /etc/services", check: { cmd: /^(less|more)\s/ } },
    { title: "Anfang und Ende", text: `<code>head</code> zeigt die ersten, <code>tail</code> die letzten Zeilen. <code>-n 5</code> = 5 Zeilen.`,
      cmd: ["head -n 5 /etc/services", "tail -n 3 /etc/passwd"], task: "Probier beide aus.", check: { cmd: /^tail\b/ },
      explain: `Für Logs Gold wert: <code>tail -f /var/log/datei</code> zeigt laufend neue Zeilen (Beenden mit <kbd>Strg</kbd>+<kbd>C</kbd>).` },
    { title: "Zählen", text: `<code>wc -l</code> zählt Zeilen.`, cmd: "wc -l /etc/services", check: { cmd: /^wc\b/ } },
    { title: "In Dateien suchen: grep", text: `<code>grep muster datei</code> zeigt alle Zeilen, die das Muster enthalten. <code>-i</code> ignoriert Groß/Klein, <code>-n</code> zeigt Zeilennummern, <code>-r</code> sucht rekursiv in Ordnern.`,
      cmd: "grep -n ssh /etc/services", task: "Finde heraus, welchen Port <b>https</b> nutzt.", hint: `<code>grep https /etc/services</code>`,
      check: { cmd: /^grep\b.*https/, out: /443/ } },
    { title: "Dateien finden: find", text: `<code>find startordner -name muster</code>.`, cmd: 'find /etc -name "*.conf"', check: { cmd: /^find\s/ },
      explain: `Weitere nützliche Filter: <code>-type f</code> (nur Dateien), <code>-type d</code> (nur Ordner), <code>-size +10M</code> (größer als 10 MB – im BusyBox-find hier: <code>-size +10000k</code>), <code>-mtime -1</code> (in den letzten 24 h geändert).` },
  ],
},
{
  id: "b5-pipes", mode: "browser", title: "Pipes & Umleitungen",
  intro: `Die Stärke von Linux: kleine Werkzeuge, die man mit <code>|</code> (Pipe) verkettet. Die Ausgabe des einen wird zur Eingabe des nächsten.`,
  steps: [
    { title: "Erste Pipe", text: `Wie viele Einträge hat <code>/etc</code>?`, cmd: "ls /etc | wc -l", check: { cmd: /\|\s*wc/ } },
    { title: "Sortieren", cmd: "cut -d: -f1 /etc/passwd | sort", check: { cmd: /\|\s*sort/ },
      explain: `<code>cut -d: -f1</code> schneidet das 1. Feld aus, wobei <code>:</code> das Trennzeichen ist – also nur die Benutzernamen.` },
    { title: "Mehrere Pipes", text: `Welche Shells werden wie oft genutzt?`, cmd: "cut -d: -f7 /etc/passwd | sort | uniq -c", check: { cmd: /uniq\s+-c/ },
      explain: `<code>uniq</code> entfernt doppelte <b>aufeinanderfolgende</b> Zeilen – deshalb vorher <code>sort</code>. <code>-c</code> zählt mit.` },
    { title: "Fehler umleiten", text: `Programme haben zwei Ausgaben: <b>stdout</b> (1, normal) und <b>stderr</b> (2, Fehler). <code>2&gt;</code> leitet nur Fehler um, <code>/dev/null</code> ist der „Mülleimer“.`,
      cmd: "ls /gibtsnicht 2> /dev/null", check: { cmd: /2>\s*\/dev\/null/ },
      explain: `<code>&gt; datei 2&gt;&amp;1</code> leitet beides in dieselbe Datei. Das siehst du oft in Cronjobs.` },
    { title: "Mitschreiben mit tee", text: `<code>tee</code> zeigt die Ausgabe an <b>und</b> schreibt sie in eine Datei.`, cmd: "ps | tee prozesse.txt", check: { cmd: /\|\s*tee\s/ } },
    { title: "Mini-Challenge", task: "Zähle, wie viele Zeilen in <code>/etc/services</code> das Wort <code>tcp</code> enthalten – mit einer Pipe.",
      hint: `<code>grep tcp /etc/services | wc -l</code> (oder kürzer: <code>grep -c tcp /etc/services</code>)`,
      check: (cmd, out) => /grep/.test(cmd) && /tcp/.test(cmd) && (/\|\s*wc/.test(cmd) || /-c/.test(cmd)) && /^\s*\d+\s*$/m.test(out) },
  ],
},
{
  id: "b6-perms", mode: "browser", title: "Benutzer & Rechte",
  intro: `Jede Datei gehört einem <b>Benutzer</b> und einer <b>Gruppe</b>. Rechte gibt es für drei Klassen: <b>u</b>ser (Besitzer), <b>g</b>roup, <b>o</b>thers – jeweils <b>r</b>ead, <b>w</b>rite, e<b>x</b>ecute.`,
  steps: [
    { title: "Rechte ansehen", cmd: "ls -l /etc/passwd /etc/shadow", check: { cmd: /^ls\s+-l/ },
      explain: `<code>-rw-r--r--</code> zerlegt: <code>-</code> Typ (d = Ordner) · <code>rw-</code> Besitzer · <code>r--</code> Gruppe · <code>r--</code> andere.<br>
      Oktal: r=4, w=2, x=1 → <code>rw-r--r--</code> = <b>644</b>, <code>rwxr-x---</code> = <b>750</b>.` },
    { title: "Skript anlegen", cmd: `echo 'echo "Ich laufe!"' > hallo.sh`, check: { cmd: /hallo\.sh/ } },
    { title: "Ausführen – geht nicht", cmd: "./hallo.sh", check: { cmd: /^\.\/hallo\.sh/, out: /denied|Permission/i },
      explain: `„Permission denied“: Die Datei hat kein <b>x</b>-Recht.` },
    { title: "Ausführbar machen", cmd: "chmod +x hallo.sh", check: { cmd: /^chmod\s+(\S*x|7\d\d|[0-7]?[1357]\d\d)\s+\S*hallo/ } },
    { title: "Jetzt klappt's", cmd: "./hallo.sh", check: { cmd: /hallo\.sh/, out: /Ich laufe/ } },
    { title: "Oktal-Schreibweise", task: "Setze die Rechte von <code>hallo.sh</code> auf <b>rwxr-x---</b> (Besitzer alles, Gruppe lesen+ausführen, andere nichts) und prüfe mit <code>ls -l</code>.",
      hint: `<code>chmod 750 hallo.sh</code>`, check: { out: /-rwxr-x---.*hallo\.sh/ } },
    { title: "Benutzer anlegen", text: `Unter BusyBox heißt das <code>adduser -D name</code> (ohne Passwort). Auf Ubuntu/Debian: <code>sudo adduser name</code>. Dieses Mini-Linux hat noch kein <code>/home</code> – das legen wir vorher an.`,
      cmd: ["mkdir -p /home", "adduser -D azubi"], check: { cmd: /^adduser\b/ } },
    { title: "Besitzer ändern", text: `<code>chown benutzer:gruppe datei</code>.`, cmd: ["chown azubi:azubi hallo.sh", "ls -l hallo.sh"],
      check: { cmd: /^ls\s+-l/, out: /azubi\s+azubi.*hallo/ } },
    { title: "Identität prüfen", text: `<code>id</code> zeigt UID, GID und Gruppen eines Benutzers.`, cmd: "id azubi", check: { cmd: /^id\b/, out: /uid=/ } },
  ],
  outro: `🎓 <b>Prüfungsklassiker:</b> SUID (4), SGID (2), Sticky-Bit (1) – z. B. <code>chmod 1777 /tmp</code>. Schau dir <code>ls -ld /tmp</code> an: das <code>t</code> am Ende ist das Sticky-Bit (nur der Besitzer darf seine Dateien löschen).`,
},
{
  id: "b7-proc", mode: "browser", title: "Prozesse",
  intro: `Jedes laufende Programm ist ein Prozess mit einer eindeutigen <b>PID</b>.`,
  steps: [
    { title: "Prozesse anzeigen", cmd: "ps", check: { cmd: /^ps\b/, out: /PID/ },
      explain: `PID 1 ist <code>init</code> – der erste Prozess, Eltern aller anderen. Auf Ubuntu ist das <code>systemd</code>.` },
    { title: "Prozess im Hintergrund", text: `Ein <code>&amp;</code> am Ende startet einen Befehl im Hintergrund.`, cmd: "sleep 600 &", check: { cmd: /&\s*$/ } },
    { title: "Jobs ansehen", cmd: "jobs", check: { cmd: /^jobs/ } },
    { title: "PID herausfinden", cmd: "pidof sleep", check: { cmd: /^(pidof|pgrep|ps)\b/ } },
    { title: "Prozess beenden", text: `<code>kill PID</code> schickt das Signal TERM (15, „bitte beenden“). <code>kill -9 PID</code> = KILL (sofort, nicht abfangbar). <code>killall name</code> beendet nach Name.`,
      cmd: "killall sleep", check: { cmd: /^(kill|killall|pkill)\b/ } },
    { title: "Live-Übersicht", text: `<code>top</code> zeigt CPU/RAM live. Beenden mit <kbd>q</kbd>. (Auf Ubuntu ist <code>htop</code> schöner.)`, cmd: "top", check: { cmd: /^h?top/ } },
  ],
},
{
  id: "b8-vi", mode: "browser", title: "Der Editor vi",
  intro: `<code>vi</code> (bzw. <code>vim</code>) ist auf praktisch jedem Linux vorhanden – du musst ihn mindestens überleben können. Er hat <b>Modi</b>: Normalmodus (Befehle) und Einfügemodus (Text tippen).`,
  steps: [
    { title: "Datei öffnen", cmd: "vi test.txt", text: `<ol><li><kbd>i</kbd> drücken → Einfügemodus (unten steht „I“)</li><li>Text tippen</li><li><kbd>Esc</kbd> → zurück in den Normalmodus</li><li><code>:wq</code> + <kbd>Enter</kbd> → speichern & beenden</li></ol>`,
      task: "Schreib eine Zeile Text in <code>test.txt</code> und speichere.", check: { cmd: /^vi\s+\S+/ } },
    { title: "Ergebnis prüfen", cmd: "cat test.txt", check: { cmd: /^cat\s+test\.txt/, out: /\S/ } },
    { title: "Wichtige vi-Befehle", text: `<table>
      <tr><td><code>:q!</code></td><td>beenden <b>ohne</b> speichern (Notausgang!)</td></tr>
      <tr><td><code>:w</code> / <code>:wq</code></td><td>speichern / speichern + beenden</td></tr>
      <tr><td><code>dd</code></td><td>Zeile löschen</td></tr>
      <tr><td><code>yy</code> / <code>p</code></td><td>Zeile kopieren / einfügen</td></tr>
      <tr><td><code>u</code></td><td>rückgängig</td></tr>
      <tr><td><code>/text</code></td><td>suchen (<code>n</code> = nächster Treffer)</td></tr>
      <tr><td><code>gg</code> / <code>G</code></td><td>Anfang / Ende der Datei</td></tr>
      <tr><td><code>o</code></td><td>neue Zeile darunter + Einfügemodus</td></tr></table>
      Auf Ubuntu gibt es auch <code>nano</code> – einfacher, die Tastenkürzel stehen unten (<kbd>Strg</kbd>+<kbd>O</kbd> speichern, <kbd>Strg</kbd>+<kbd>X</kbd> beenden).` },
  ],
},
{
  id: "b9-script", mode: "browser", title: "Shell-Skripte",
  intro: `Alles, was du tippst, kannst du auch in eine Datei schreiben und automatisieren. Mehrzeiligen Text schreibst du bequem mit einem <b>Here-Document</b> (<code>&lt;&lt; 'EOF'</code> … <code>EOF</code>).`,
  steps: [
    { title: "Variablen", cmd: ['NAME="Ömer"', 'echo "Hallo $NAME"'], check: { cmd: /^echo\s.*\$\w+/ },
      explain: `Keine Leerzeichen um das <code>=</code>! Mit <code>$(befehl)</code> speicherst du eine Ausgabe: <code>HEUTE=$(date +%F)</code>.` },
    { title: "Skript schreiben", text: `Kopier den Block komplett (übernehmen) und drück Enter. Die erste Zeile <code>#!/bin/sh</code> („Shebang“) sagt, welcher Interpreter das Skript ausführt.`,
      cmd: `cat > backup.sh << 'EOF'
#!/bin/sh
# Sichert einen Ordner als Archiv mit Datum im Namen
QUELLE="$1"
ZIEL="/tmp/backup-$(date +%F).tar.gz"
if [ -z "$QUELLE" ]; then
  echo "Aufruf: $0 <ordner>"
  exit 1
fi
tar -cf - "$QUELLE" | gzip > "$ZIEL" && echo "Backup erstellt: $ZIEL"
EOF`, check: { cmd: /backup\.sh/ },
      explain: `<code>tar -cf -</code> schreibt das Archiv auf stdout, <code>gzip</code> komprimiert es – wieder eine Pipe. Auf Ubuntu geht das kürzer mit <code>tar -czf ziel.tar.gz ordner</code> (das BusyBox-tar hier kann kein <code>-z</code>).` },
    { title: "Ausführbar machen & testen", cmd: ["chmod +x backup.sh", "./backup.sh"], task: "Starte es erst <b>ohne</b> Argument …", check: { cmd: /backup\.sh\s*$/, out: /Aufruf/ } },
    { title: "Mit Argument", cmd: "./backup.sh projekte", check: { cmd: /backup\.sh\s+\S/, out: /Backup erstellt/ },
      explain: `<code>$1</code> ist das erste Argument, <code>$0</code> der Skriptname, <code>$#</code> die Anzahl. <code>&&</code> führt den nächsten Befehl nur bei Erfolg aus (Exit-Code 0).` },
    { title: "Schleifen", cmd: "for i in 1 2 3; do echo \"Durchlauf $i\"; done", check: { cmd: /^for\s/, out: /Durchlauf|\w/ } },
    { title: "Exit-Code prüfen", text: `Jeder Befehl liefert einen Exit-Code: 0 = Erfolg, alles andere = Fehler. <code>$?</code> enthält den letzten.`,
      cmd: ["ls /gibtsnicht", "echo $?"], check: { cmd: /echo\s+\$\?/ } },
  ],
},
{
  id: "b10-sys", mode: "browser", title: "System & Archive",
  intro: `Speicher, Laufzeit, Hardware – und Dateien packen. Das brauchst du beim Troubleshooting ständig.`,
  steps: [
    { title: "Plattenplatz", text: `<code>-h</code> = „human readable“ (MB/GB statt Blöcke).`, cmd: "df -h", check: { cmd: /^df\b/ } },
    { title: "Ordnergröße", cmd: "du -sh /etc", check: { cmd: /^du\b/ } },
    { title: "Arbeitsspeicher", cmd: "free -m", check: { cmd: /^free\b/, out: /Mem/ } },
    { title: "Laufzeit & Last", cmd: "uptime", check: { cmd: /^uptime/ },
      explain: `Die drei Zahlen bei „load average“ sind die durchschnittliche Last der letzten 1, 5 und 15 Minuten. Faustregel: über Anzahl CPU-Kerne = Engpass.` },
    { title: "CPU-Infos aus /proc", cmd: "cat /proc/cpuinfo | grep 'model name'", check: { cmd: /\/proc\/cpuinfo/ } },
    { title: "Kernel-Meldungen", cmd: "dmesg | tail", check: { cmd: /^dmesg/ } },
    { title: "Archiv entpacken", text: `<code>tar</code>: <b>c</b>reate, e<b>x</b>tract, lis<b>t</b>, <b>f</b> = Dateiname (<code>-</code> = stdin/stdout), <b>v</b> = verbose, <b>C</b> = Zielordner. Dein Backup aus der Skript-Lektion liegt in /tmp. <code>zcat</code> entpackt gzip auf stdout.`,
      cmd: ["ls /tmp/*.tar.gz", "zcat /tmp/backup-*.tar.gz | tar -tvf -", "mkdir -p /tmp/restore && zcat /tmp/backup-*.tar.gz | tar -xf - -C /tmp/restore && ls -R /tmp/restore"],
      check: { cmd: /tar\s+-?x/ },
      explain: `Auf Ubuntu (GNU tar) einfach: <code>tar -xzf archiv.tar.gz -C ziel</code> bzw. <code>tar -tzf</code> zum Ansehen.` },
  ],
  outro: `✅ <b>Teil 1 geschafft!</b> Du kennst jetzt die Grundlagen. In Teil 2 arbeitest du auf einer echten Ubuntu-VM und installierst die Dienste, die in der FISI-Ausbildung und Prüfung immer wieder vorkommen.`,
},

/* ===================================================================== */
/* TEIL 2 – ECHTE VM: INSTALLATIONEN & DIENSTE (FISI)                    */
/* ===================================================================== */
{
  id: "v0-setup", mode: "ssh", title: "Deine Übungs-VM einrichten",
  intro: `Für Installationen brauchst du ein vollwertiges Linux mit Internet. Die App erstellt dir dafür eine <b>Ubuntu-VM</b> mit Multipass (läuft unter Windows auf Hyper-V). Alles geht über die <b>⚙ VM-Zentrale</b> – du musst kein extra Programm öffnen.`,
  steps: [
    { title: "VM-Zentrale öffnen", text: `Oben rechts auf <b>⚙ VM-Zentrale</b> klicken. Dort siehst du, ob dein PC bereit ist: Windows-Edition, Hyper-V, Multipass.<br><button class="primary" data-action="vm-center">⚙ VM-Zentrale öffnen</button>`, event: "vm-center-opened" },
    { title: "Voraussetzungen erfüllen", text: `Ist etwas rot, hilft dir die Zentrale mit einem Knopf weiter:<ul><li><b>Hyper-V</b> aktivieren (Windows fragt nach Admin-Rechten, danach Neustart)</li><li><b>Multipass</b> installieren (über winget)</li></ul>Windows <b>Home</b> hat kein Hyper-V – dort nutzt Multipass VirtualBox (bitte vorher VirtualBox installieren).`, event: "env-ready" },
    { title: "VM erstellen", text: `In der Zentrale auf <b>VM erstellen</b> klicken. Beim ersten Mal lädt Multipass Ubuntu herunter (~600 MB), das dauert ein paar Minuten. Die App legt danach automatisch den Sicherungspunkt <b>„frisch“</b> an.`, event: "vm-created",
      explain: `Die VM heißt <code>fis-lab</code>, hat 2 CPU-Kerne, 2 GB RAM und 15 GB Platte. Die App meldet sich per SSH-Schlüssel an – kein Passwort nötig. Das Passwort des Benutzers <code>ubuntu</code> ist <code>linuxlab</code>.` },
    { title: "Verbinden", text: `Läuft die VM, verbindet sich das Terminal automatisch. Sonst: <b>🔌 Verbinden</b>.`, event: "ssh-connected" },
    { title: "Bin ich drin?", cmd: "cat /etc/os-release", check: { cmd: /os-release|lsb_release|hostnamectl/, out: /Ubuntu|Debian/i } },
    { title: "Passwort ändern", text: `Gute Gewohnheit: Standard-Passwörter sofort ändern. (Die App selbst nutzt einen Schlüssel – du sperrst dich also nicht aus.)`, cmd: "passwd", check: { cmd: /^passwd/, out: /success|erfolgreich|updated/i } },
    { title: "Pause & Feierabend", text: `Eine laufende VM belegt RAM und CPU deines PCs. Deshalb:<ul><li><b>☕ Pause</b> – friert die VM ein (Arbeitsspeicher wird gesichert), weiter geht's in Sekunden genau dort.</li><li><b>🌙 Feierabend</b> – fährt die VM sauber herunter.</li><li>In der Zentrale kannst du einstellen, dass die VM nach X Minuten ohne Eingabe automatisch pausiert.</li></ul>` },
    { title: "Snapshots = Rettungsanker", text: `Vor Experimenten in der Zentrale einen <b>Snapshot</b> anlegen. Kaputt gemacht? Einfach zurückspielen.<br><br><b>Eigene Proxmox-VM?</b> Geht auch: „🔌 Verbinden“ → „Andere Maschine“ und IP + Benutzer eintragen.` },
  ],
},
{
  id: "v1-apt", mode: "ssh", title: "Paketverwaltung mit apt",
  intro: `Software kommt unter Debian/Ubuntu aus <b>Paketquellen</b> (Repositories) und wird mit <code>apt</code> verwaltet. Abhängigkeiten löst apt automatisch auf. Für Admin-Aufgaben brauchst du <code>sudo</code>.`,
  steps: [
    { title: "Paketlisten aktualisieren", text: `<code>update</code> lädt nur die Liste verfügbarer Pakete neu – es installiert nichts.`, cmd: "sudo apt update",
      check: { cmd: /apt(-get)?\s+update/, out: /Reading package lists|Paketlisten|Done|Fertig/i } },
    { title: "Updates einspielen", cmd: "sudo apt upgrade -y", check: { cmd: /apt(-get)?\s+(full-|dist-)?upgrade/ },
      explain: `<code>upgrade</code> aktualisiert installierte Pakete. <code>full-upgrade</code> darf dafür auch Pakete entfernen. Manche Updates (Kernel) brauchen einen Neustart: <code>cat /var/run/reboot-required</code>.` },
    { title: "Paket suchen", cmd: "apt search htop", check: { cmd: /apt(-cache)?\s+search/ } },
    { title: "Paketinfos", cmd: "apt show htop", check: { cmd: /apt(-cache)?\s+show/ } },
    { title: "Installieren", cmd: "sudo apt install -y htop tree net-tools curl", check: { cmd: /apt(-get)?\s+install\s.*htop/ } },
    { title: "Ist es da?", cmd: ["which htop", "dpkg -l | grep htop"], check: { cmd: /dpkg\s+-l|which\s+htop|apt\s+list\s+--installed/ , out: /htop/ } },
    { title: "Entfernen", text: `<code>remove</code> lässt Konfigurationsdateien übrig, <code>purge</code> löscht sie mit. <code>autoremove</code> räumt nicht mehr benötigte Abhängigkeiten auf.`,
      cmd: ["sudo apt remove -y tree", "sudo apt autoremove -y"], check: { cmd: /apt(-get)?\s+(remove|purge)/ } },
    { title: "Paketquellen ansehen", cmd: "cat /etc/apt/sources.list.d/ubuntu.sources", check: { cmd: /sources/ },
      explain: `Zusätzliche Quellen (z. B. von Docker) landen als eigene Datei in <code>/etc/apt/sources.list.d/</code>. Einzelne .deb-Dateien installierst du mit <code>sudo apt install ./paket.deb</code>.` },
  ],
},
{
  id: "v2-users", mode: "ssh", title: "Benutzer, Gruppen & sudo",
  intro: `Typische Admin-Aufgabe: Mitarbeiter anlegen, Gruppen zuordnen, Admin-Rechte vergeben.`,
  steps: [
    { title: "Benutzer anlegen", text: `<code>adduser</code> fragt interaktiv nach Passwort und Daten (Felder mit Enter überspringen). <code>useradd</code> ist die Low-Level-Variante.`,
      cmd: "sudo adduser azubi", check: { cmd: /(adduser|useradd)\s+.*azubi/ } },
    { title: "Gruppe anlegen", cmd: "sudo groupadd it-team", check: { cmd: /(groupadd|addgroup)\s/ } },
    { title: "Benutzer zur Gruppe hinzufügen", text: `<b>Wichtig:</b> <code>-aG</code> = <b>a</b>ppend. Ohne <code>-a</code> fliegt der Benutzer aus allen anderen Zusatzgruppen!`,
      cmd: "sudo usermod -aG it-team azubi", check: { cmd: /usermod\s+-aG|gpasswd\s+-a|adduser\s+azubi\s+\S/ } },
    { title: "Admin-Rechte geben", text: `Mitglieder der Gruppe <code>sudo</code> dürfen Befehle als root ausführen.`,
      cmd: "sudo usermod -aG sudo azubi", check: { cmd: /(usermod\s+-aG\s+sudo|gpasswd\s+-a\s+azubi\s+sudo|adduser\s+azubi\s+sudo)/ } },
    { title: "Kontrollieren", cmd: "id azubi", check: { cmd: /^(id|groups)\s+azubi/, out: /it-team/ } },
    { title: "Als azubi arbeiten", text: `<code>su - azubi</code> wechselt den Benutzer (mit dessen Umgebung). Probier dort <code>sudo whoami</code> und kehr mit <code>exit</code> zurück.`,
      cmd: ["su - azubi", "sudo whoami"], check: { cmd: /^sudo\s+whoami/, out: /root/ } },
    { title: "Gruppen-Ordner einrichten", text: `Ein gemeinsamer Ordner für das Team, in dem neue Dateien automatisch der Gruppe gehören (SGID-Bit = die <code>2</code> vorne):`,
      cmd: "sudo mkdir -p /srv/it-team && sudo chown root:it-team /srv/it-team && sudo chmod 2770 /srv/it-team && ls -ld /srv/it-team",
      check: { cmd: /ls\s+-ld?\s+\/srv\/it-team/, out: /drwxrws---/ } },
    { title: "Wichtige Dateien", text: `<table><tr><td><code>/etc/passwd</code></td><td>Benutzerkonten</td></tr><tr><td><code>/etc/shadow</code></td><td>Passwort-Hashes</td></tr><tr><td><code>/etc/group</code></td><td>Gruppen</td></tr><tr><td><code>/etc/sudoers</code></td><td>sudo-Regeln – nur mit <code>sudo visudo</code> bearbeiten!</td></tr></table>
      Benutzer sperren: <code>sudo usermod -L name</code> · löschen inkl. Home: <code>sudo deluser --remove-home name</code>` },
  ],
},
{
  id: "v3-systemd", mode: "ssh", title: "Dienste mit systemd",
  intro: `Auf modernen Distributionen startet und überwacht <b>systemd</b> alle Dienste (Daemons). Das Werkzeug dazu: <code>systemctl</code>. Logs liest du mit <code>journalctl</code>.`,
  steps: [
    { title: "Status eines Dienstes", text: `Mit <kbd>q</kbd> raus, falls die Ausgabe in einem Pager hängt.`, cmd: "systemctl status ssh --no-pager", check: { cmd: /systemctl\s+status/, out: /Active:/ } },
    { title: "Alle laufenden Dienste", cmd: "systemctl list-units --type=service --state=running --no-pager", check: { cmd: /list-units/ } },
    { title: "Neustart & Reload", text: `<code>restart</code> = stoppen + starten. <code>reload</code> = Konfiguration neu lesen, ohne Verbindungen zu trennen (nicht jeder Dienst kann das).`,
      cmd: "sudo systemctl restart cron", check: { cmd: /systemctl\s+(restart|reload)/ } },
    { title: "Autostart", text: `<code>enable</code> = beim Booten starten, <code>disable</code> = nicht. <code>--now</code> startet/stoppt zusätzlich sofort.`,
      cmd: "systemctl is-enabled cron", check: { cmd: /is-enabled|enable|disable/ } },
    { title: "Logs eines Dienstes", text: `<code>-u</code> = Unit, <code>-n 20</code> = letzte 20 Zeilen, <code>-f</code> = live mitlesen, <code>-p err</code> = nur Fehler, <code>-b</code> = seit letztem Boot.`,
      cmd: "journalctl -u ssh -n 20 --no-pager", check: { cmd: /journalctl/ } },
    { title: "Eigenen Dienst bauen", text: `Ein Mini-Dienst, der jede Minute die Uhrzeit ins Journal schreibt:`,
      cmd: `sudo tee /etc/systemd/system/zeitlog.service << 'EOF'
[Unit]
Description=Schreibt regelmaessig die Uhrzeit ins Log

[Service]
ExecStart=/bin/sh -c 'while true; do echo "Es ist $(date +%T)"; sleep 60; done'
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF`, check: { cmd: /zeitlog\.service/ } },
    { title: "Dienst aktivieren", cmd: ["sudo systemctl daemon-reload", "sudo systemctl enable --now zeitlog", "systemctl status zeitlog --no-pager"],
      check: { cmd: /systemctl\s+status\s+zeitlog/, out: /active \(running\)/ },
      explain: `Nach Änderungen an Unit-Dateien immer <code>daemon-reload</code>. Logs: <code>journalctl -u zeitlog -f</code>. Aufräumen: <code>sudo systemctl disable --now zeitlog</code>.` },
  ],
},
{
  id: "v4-net", mode: "ssh", title: "Netzwerk-Grundlagen",
  intro: `IP-Adressen, Routen, DNS, offene Ports – damit findest du 90 % aller Netzwerkprobleme.`,
  steps: [
    { title: "IP-Adressen", text: `Der moderne Befehl ist <code>ip</code> (das alte <code>ifconfig</code> gibt's nur noch mit net-tools).`, cmd: "ip -br a", check: { cmd: /^ip\s+(-\w+\s+)*(a|addr|address)\b/ } },
    { title: "Routing-Tabelle", text: `Die Zeile <code>default via …</code> ist dein Standard-Gateway.`, cmd: "ip r", check: { cmd: /^ip\s+(r|route)\b/, out: /default/ } },
    { title: "Erreichbarkeit testen", cmd: "ping -c 3 1.1.1.1", check: { cmd: /^ping\s/, out: /packets transmitted/ } },
    { title: "DNS-Auflösung", text: `Wenn <code>ping 1.1.1.1</code> klappt, aber <code>ping google.de</code> nicht → DNS-Problem!`, cmd: ["resolvectl status | head -20", "dig +short google.de"],
      check: { cmd: /^(dig|nslookup|host|resolvectl)\b/ } },
    { title: "Offene Ports", text: `<code>ss -tulpn</code>: <b>t</b>cp, <b>u</b>dp, <b>l</b>istening, <b>p</b>rozess, <b>n</b>umerisch.`, cmd: "sudo ss -tulpn", check: { cmd: /^(sudo\s+)?(ss|netstat)\s+-\w*l/, out: /:22\b/ } },
    { title: "Netzwerk-Konfiguration (netplan)", text: `Ubuntu konfiguriert Netzwerk über YAML-Dateien in <code>/etc/netplan/</code>.`, cmd: "sudo cat /etc/netplan/*.yaml", check: { cmd: /netplan/ },
      explain: `Beispiel für eine <b>statische IP</b> (nur lesen – auf der Multipass-VM nicht anwenden, sonst ist sie weg):
<pre class="file">network:
  version: 2
  ethernets:
    eth0:
      addresses: [192.168.10.20/24]
      routes:
        - to: default
          via: 192.168.10.1
      nameservers:
        addresses: [192.168.10.1, 1.1.1.1]</pre>
Anwenden mit <code>sudo netplan try</code> (setzt nach 120 s automatisch zurück, wenn du nicht bestätigst) bzw. <code>sudo netplan apply</code>.` },
    { title: "Hostname", cmd: "hostnamectl", check: { cmd: /^hostnamectl/ } },
  ],
},
{
  id: "v5-ssh", mode: "ssh", title: "SSH-Server absichern",
  intro: `SSH ist der Standardzugang zu jedem Linux-Server. Best Practice: Login per <b>Schlüssel</b> statt Passwort, kein direkter root-Login.`,
  steps: [
    { title: "Schlüsselpaar erzeugen", text: `Ed25519 ist der moderne Standard. Fragen einfach mit Enter bestätigen.`, cmd: "ssh-keygen -t ed25519", check: { cmd: /ssh-keygen/ },
      explain: `<code>~/.ssh/id_ed25519</code> = <b>privater</b> Schlüssel (geheim!), <code>.pub</code> = öffentlicher Schlüssel (darf jeder sehen).` },
    { title: "Öffentlichen Schlüssel hinterlegen", text: `Auf dem Zielserver gehört der Public Key in <code>~/.ssh/authorized_keys</code>. <code>ssh-copy-id</code> macht das automatisch – hier zum Üben auf den Benutzer azubi derselben Maschine:`,
      cmd: "ssh-copy-id azubi@localhost", check: { cmd: /ssh-copy-id/ } },
    { title: "Login per Schlüssel testen", cmd: "ssh azubi@localhost", task: "Du solltest ohne Passwort reinkommen. Mit <code>exit</code> zurück.", check: { cmd: /^ssh\s+\S+@/ } },
    { title: "sshd-Konfiguration härten", text: `Statt die Hauptdatei zu ändern, legt man eine eigene Datei in <code>sshd_config.d</code> an:`,
      cmd: `echo "PermitRootLogin no" | sudo tee /etc/ssh/sshd_config.d/10-haertung.conf`, check: { cmd: /PermitRootLogin/ },
      explain: `Auf echten Servern zusätzlich <code>PasswordAuthentication no</code> – aber erst, wenn der Schlüssel-Login sicher funktioniert, sonst sperrst du dich aus! (In diesem Lab lassen wir Passwörter an, damit die App sich weiter verbinden kann.)` },
    { title: "Konfiguration prüfen & neu laden", text: `<code>sshd -t</code> prüft die Syntax. Kein Output = alles gut. Immer <b>vor</b> dem Neuladen testen!`,
      cmd: "sudo sshd -t && sudo systemctl reload ssh", check: { cmd: /sshd\s+-t/, notOut: /error|bad/i } },
  ],
},
{
  id: "v6-ufw", mode: "ssh", title: "Firewall mit ufw",
  intro: `<b>ufw</b> (Uncomplicated Firewall) ist ein einfaches Frontend für die Kernel-Firewall (nftables/iptables). Prinzip: eingehend alles verbieten, nur Benötigtes erlauben.`,
  steps: [
    { title: "Status", cmd: "sudo ufw status verbose", check: { cmd: /ufw\s+status/ } },
    { title: "ZUERST SSH erlauben!", text: `⚠️ Sonst sperrst du dich beim Aktivieren selbst aus.`, cmd: "sudo ufw allow OpenSSH", check: { cmd: /ufw\s+allow\s+(OpenSSH|22|ssh)/i } },
    { title: "Standardregeln", cmd: ["sudo ufw default deny incoming", "sudo ufw default allow outgoing"], check: { cmd: /ufw\s+default\s+deny/ } },
    { title: "Aktivieren", text: `Die Warnung „Command may disrupt existing ssh connections“ mit <kbd>y</kbd> bestätigen – SSH ist ja erlaubt.`, cmd: "sudo ufw enable", check: { cmd: /ufw\s+(--force\s+)?enable/ } },
    { title: "Webserver-Ports freigeben", cmd: ["sudo ufw allow 80/tcp", "sudo ufw allow 443/tcp"], check: { cmd: /ufw\s+allow\s+(80|443|http)/ } },
    { title: "Nur aus einem Netz erlauben", text: `Z. B. Datenbank nur aus dem internen Netz:`, cmd: "sudo ufw allow from 192.168.10.0/24 to any port 3306 proto tcp", check: { cmd: /ufw\s+allow\s+from/ } },
    { title: "Regeln nummeriert & löschen", cmd: ["sudo ufw status numbered", "sudo ufw delete 5"], task: "Lass dir die Regeln nummeriert anzeigen.", check: { cmd: /ufw\s+status\s+numbered/ } },
  ],
},
{
  id: "v7-web", mode: "ssh", title: "Webserver: Apache & nginx",
  intro: `Ein Webserver liefert Webseiten per HTTP/HTTPS aus. <b>Apache</b> und <b>nginx</b> sind die beiden großen. Wir installieren Apache, richten einen virtuellen Host ein und schauen uns nginx im Vergleich an.`,
  steps: [
    { title: "Apache installieren", cmd: "sudo apt install -y apache2", check: { cmd: /apt(-get)?\s+install\s.*apache2/ } },
    { title: "Läuft er?", cmd: "systemctl status apache2 --no-pager", check: { cmd: /status\s+apache2/, out: /active \(running\)/ } },
    { title: "Seite abrufen", cmd: "curl -I http://localhost", check: { cmd: /^curl\s/, out: /HTTP\/1\.1 200|Apache/ },
      explain: `Du kannst die Seite auch im Windows-Browser öffnen: <code>http://IP-DEINER-VM</code> (ufw muss Port 80 erlauben).` },
    { title: "Eigene Seite", text: `Das Standard-Webverzeichnis ist <code>/var/www/html</code>.`, cmd: `echo "<h1>Hallo vom FIS-Lab</h1>" | sudo tee /var/www/html/index.html && curl http://localhost`,
      check: { cmd: /curl/, out: /FIS-Lab/ } },
    { title: "Virtual Host anlegen", text: `Mehrere Websites auf einem Server = virtuelle Hosts. Unterschieden wird am Hostnamen.`,
      cmd: `sudo mkdir -p /var/www/intranet && echo "<h1>Intranet</h1>" | sudo tee /var/www/intranet/index.html
sudo tee /etc/apache2/sites-available/intranet.conf << 'EOF'
<VirtualHost *:80>
    ServerName intranet.lab
    DocumentRoot /var/www/intranet
    ErrorLog \${APACHE_LOG_DIR}/intranet-error.log
    CustomLog \${APACHE_LOG_DIR}/intranet-access.log combined
</VirtualHost>
EOF`, check: { cmd: /intranet\.conf|EOF/ } },
    { title: "Aktivieren & testen", text: `<code>a2ensite</code>/<code>a2dissite</code> (Sites) und <code>a2enmod</code>/<code>a2dismod</code> (Module) sind Debian/Ubuntu-Helfer.`,
      cmd: ["sudo a2ensite intranet && sudo apache2ctl configtest && sudo systemctl reload apache2", "curl -H 'Host: intranet.lab' http://localhost"],
      check: { cmd: /curl.*intranet/, out: /Intranet/ } },
    { title: "Logs lesen", cmd: "sudo tail -n 5 /var/log/apache2/access.log", check: { cmd: /\/var\/log\/apache2/ } },
    { title: "nginx im Vergleich", text: `nginx kann nicht gleichzeitig auf Port 80 laufen. Deshalb stoppen wir Apache kurz:`,
      cmd: ["sudo systemctl stop apache2", "sudo apt install -y nginx", "curl -sI http://localhost | grep -i server"], check: { cmd: /curl/, out: /Server:\s*nginx/i },
      explain: `nginx-Konfig: <code>/etc/nginx/sites-available/</code>, Syntaxcheck <code>sudo nginx -t</code>. Wieder zurück: <code>sudo systemctl disable --now nginx && sudo systemctl start apache2</code>.` },
  ],
  outro: `🔒 <b>HTTPS:</b> In der Praxis holst du dir mit <code>certbot</code> (Let's Encrypt) ein Zertifikat – das braucht eine öffentliche Domain. Für ein Lab reicht ein selbstsigniertes: <code>sudo a2enmod ssl && sudo a2ensite default-ssl && sudo systemctl reload apache2</code>, dann <code>curl -kI https://localhost</code>.`,
},
{
  id: "v8-db", mode: "ssh", topic: "db", stage: 3, title: "Datenbank: MariaDB",
  intro: `MariaDB ist der freie MySQL-Nachfolger. Typisch: Server installieren, absichern, Datenbank + Benutzer für eine Anwendung anlegen.`,
  steps: [
    { title: "Installieren", cmd: "sudo apt install -y mariadb-server", check: { cmd: /apt(-get)?\s+install\s.*mariadb-server/ } },
    { title: "Läuft & lauscht?", cmd: "sudo ss -tlnp | grep 3306", check: { cmd: /3306/, out: /3306/ },
      explain: `Standardmäßig lauscht MariaDB nur auf <code>127.0.0.1</code> – gut so! Für Zugriff von außen <code>bind-address</code> in <code>/etc/mysql/mariadb.conf.d/50-server.cnf</code> ändern und die Firewall gezielt öffnen.` },
    { title: "Absichern", text: `Interaktives Skript: Root-Passwort/Unix-Socket, anonyme Benutzer und Test-DB entfernen. Empfehlung: Unix-Socket-Auth beibehalten, Rest mit <b>Y</b> bestätigen.`,
      cmd: "sudo mariadb-secure-installation", check: { cmd: /(mariadb|mysql)[-_]secure[-_]installation/ } },
    { title: "Datenbank & Benutzer anlegen", text: `<code>sudo mariadb</code> meldet dich per Unix-Socket als DB-root an.`,
      cmd: `sudo mariadb -e "CREATE DATABASE inventar; CREATE USER 'app'@'localhost' IDENTIFIED BY 'Geheim_123'; GRANT ALL PRIVILEGES ON inventar.* TO 'app'@'localhost'; FLUSH PRIVILEGES;"`,
      check: { cmd: /CREATE\s+DATABASE/i } },
    { title: "Als App-Benutzer arbeiten", cmd: `mariadb -u app -p'Geheim_123' inventar -e "CREATE TABLE geraete (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50), ip VARCHAR(15)); INSERT INTO geraete (name, ip) VALUES ('switch01','192.168.10.2'),('drucker','192.168.10.50'); SELECT * FROM geraete;"`,
      check: { cmd: /SELECT/i, out: /switch01/ } },
    { title: "Backup & Restore", cmd: ["sudo mariadb-dump inventar > inventar.sql", "head -n 30 inventar.sql"], check: { cmd: /(mariadb|mysql)-?dump/ },
      explain: `Zurückspielen: <code>sudo mariadb inventar &lt; inventar.sql</code>. Das ist ein klassischer Cronjob-Kandidat (nächste Lektionen).` },
  ],
},
{
  id: "v8b-lemp", mode: "ssh", title: "LEMP-Stack: nginx + MariaDB + PHP",
  intro: `<b>LEMP</b> = <b>L</b>inux + <b>E</b>ngine-X (nginx) + <b>M</b>ariaDB/MySQL + <b>P</b>HP. Der Klassiker für Webanwendungen (WordPress, Nextcloud, …). Die Variante mit Apache heißt <b>LAMP</b>. Unterschied: Apache bindet PHP direkt als Modul ein, nginx reicht PHP-Anfragen per <b>FastCGI</b> an einen eigenen Dienst weiter: <b>PHP-FPM</b>.`,
  steps: [
    { title: "Pakete installieren", text: `Apache belegt Port 80 – den schalten wir ab (falls installiert).`,
      cmd: ["sudo systemctl disable --now apache2 2>/dev/null", "sudo apt install -y nginx mariadb-server php-fpm php-mysql"], check: { cmd: /apt(-get)?\s+install\s.*php-fpm/ } },
    { title: "PHP-FPM-Socket finden", text: `nginx und PHP-FPM sprechen über einen <b>Unix-Socket</b> miteinander – eine Datei statt eines Netzwerkports.`,
      cmd: "ls -l /run/php/", check: { cmd: /\/run\/php/, out: /php.*fpm\.sock/ },
      explain: `<code>php-fpm.sock</code> ist ein Link auf die Version (z. B. <code>php8.3-fpm.sock</code>). Wer die Version fest einträgt, bekommt nach einem PHP-Update evtl. „502 Bad Gateway“ – das ist eine der Missionen 😉` },
    { title: "Server-Block anlegen", text: `In nginx heißen virtuelle Hosts <b>Server-Blöcke</b>.`,
      cmd: `sudo mkdir -p /var/www/lemp
sudo tee /etc/nginx/sites-available/lemp << 'EOF'
server {
    listen 80 default_server;
    server_name _;
    root /var/www/lemp;
    index index.php index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php-fpm.sock;
    }
}
EOF`, check: { cmd: /sites-available\/lemp/ } },
    { title: "Aktivieren", text: `Link nach <code>sites-enabled</code>, Standardseite raus, testen, neu laden:`,
      cmd: "sudo ln -sf /etc/nginx/sites-available/lemp /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx",
      check: { cmd: /nginx\s+-t/, out: /successful/ } },
    { title: "PHP testen", cmd: [`echo "<?php phpinfo();" | sudo tee /var/www/lemp/info.php`, `curl -s http://localhost/info.php | grep -o "PHP Version [0-9.]*" | head -1`],
      check: { cmd: /curl/, out: /PHP Version \d/ },
      explain: `⚠️ <code>info.php</code> verrät Angreifern viel über dein System – auf echten Servern nach dem Test wieder löschen: <code>sudo rm /var/www/lemp/info.php</code>` },
    { title: "Datenbank für die App", cmd: `sudo mariadb -e "CREATE DATABASE IF NOT EXISTS lemp; CREATE USER IF NOT EXISTS 'web'@'localhost' IDENTIFIED BY 'Web_123'; GRANT ALL PRIVILEGES ON lemp.* TO 'web'@'localhost'; CREATE TABLE IF NOT EXISTS lemp.notizen (id INT AUTO_INCREMENT PRIMARY KEY, text VARCHAR(200), erstellt TIMESTAMP DEFAULT CURRENT_TIMESTAMP); INSERT INTO lemp.notizen (text) VALUES ('LEMP läuft'), ('Gelernt im FIS-Lab');"`,
      check: { cmd: /CREATE\s+DATABASE/i, notOut: /ERROR/ } },
    { title: "PHP-Seite mit Datenbank", text: `Eine kleine Notiz-App: PHP liest die Tabelle aus MariaDB und nginx liefert das Ergebnis aus.`,
      cmd: [`sudo tee /var/www/lemp/index.php << 'EOF'
<?php
$db = new mysqli('localhost', 'web', 'Web_123', 'lemp');
if ($db->connect_error) { die('DB-Fehler: ' . $db->connect_error); }
if (!empty($_POST['text'])) {
    $stmt = $db->prepare('INSERT INTO notizen (text) VALUES (?)');
    $stmt->bind_param('s', $_POST['text']);
    $stmt->execute();
}
echo '<h1>Notizen auf ' . gethostname() . '</h1><ul>';
foreach ($db->query('SELECT text, erstellt FROM notizen ORDER BY id DESC') as $row) {
    echo '<li>' . htmlspecialchars($row['text']) . ' <small>(' . $row['erstellt'] . ')</small></li>';
}
echo '</ul><form method="post"><input name="text" placeholder="Neue Notiz"><button>Speichern</button></form>';
EOF`, "curl -s http://localhost/"], check: { cmd: /curl/, out: /LEMP l/ } },
    { title: "Im Windows-Browser öffnen", text: `Öffne <a href="http://{{IP}}/" target="_blank">http://{{IP}}/</a> und speichere eine Notiz. Falls die Firewall aktiv ist: <code>sudo ufw allow 80/tcp</code>.`,
      explain: `<code>htmlspecialchars</code> und <code>prepare</code>/<code>bind_param</code> schützen vor XSS bzw. SQL-Injection – Pflicht, sobald Benutzereingaben im Spiel sind.` },
  ],
  outro: `🎓 <b>LAMP vs. LEMP</b> – Apache: <code>.htaccess</code>-Dateien, mod_php, sehr flexibel. nginx: sehr schnell bei vielen gleichzeitigen Verbindungen, oft als <b>Reverse Proxy</b> vor anderen Diensten. Logs: <code>/var/log/nginx/</code>, PHP: <code>journalctl -u php*-fpm</code>.`,
},
{
  id: "v9-samba", mode: "ssh", title: "Dateifreigabe: Samba",
  intro: `Mit <b>Samba</b> stellt ein Linux-Server Windows-Freigaben (SMB/CIFS) bereit – Standard in gemischten Netzen.`,
  steps: [
    { title: "Installieren", cmd: "sudo apt install -y samba smbclient", check: { cmd: /apt(-get)?\s+install\s.*samba/ } },
    { title: "Freigabe-Ordner", text: `Wir nutzen den Gruppenordner aus der Benutzer-Lektion (oder legen ihn an):`,
      cmd: "sudo mkdir -p /srv/it-team && sudo groupadd -f it-team && sudo chown root:it-team /srv/it-team && sudo chmod 2770 /srv/it-team", check: { cmd: /\/srv\/it-team/ } },
    { title: "Freigabe konfigurieren", cmd: `sudo tee -a /etc/samba/smb.conf << 'EOF'

[it-team]
   path = /srv/it-team
   valid users = @it-team
   read only = no
   create mask = 0660
   directory mask = 2770
EOF`, check: { cmd: /smb\.conf|EOF/ } },
    { title: "Konfiguration prüfen", cmd: "testparm -s", check: { cmd: /^testparm/, out: /\[it-team\]/ } },
    { title: "Samba-Passwort setzen", text: `Samba hat eine eigene Passwort-Datenbank. Der Benutzer muss aber als Linux-Benutzer existieren.`,
      cmd: ["sudo usermod -aG it-team ubuntu", "sudo smbpasswd -a ubuntu"], check: { cmd: /smbpasswd\s+-a/ } },
    { title: "Neustart & Test", cmd: ["sudo systemctl restart smbd", "smbclient -L localhost -U ubuntu"], check: { cmd: /smbclient\s+-L/, out: /it-team/ } },
    { title: "Von Windows aus", text: `Im Explorer: <code>\\\\IP-DEINER-VM\\it-team</code> eingeben. Oder Netzlaufwerk verbinden:`,
      win: "net use Z: \\\\IP-DEINER-VM\\it-team /user:ubuntu",
      explain: `Firewall nicht vergessen: <code>sudo ufw allow Samba</code>` },
  ],
},
{
  id: "v10-dns", mode: "ssh", title: "DNS-Server: BIND9",
  intro: `Ein eigener DNS-Server für das interne Netz (Zone <code>lab.local</code>). Prüfungsrelevant: Zonendatei, SOA, A-, CNAME-, MX-Records.`,
  steps: [
    { title: "Installieren", cmd: "sudo apt install -y bind9 bind9-utils dnsutils", check: { cmd: /apt(-get)?\s+install\s.*bind9/ } },
    { title: "Zone deklarieren", cmd: `sudo tee -a /etc/bind/named.conf.local << 'EOF'
zone "lab.local" {
    type master;
    file "/etc/bind/db.lab.local";
};
EOF`, check: { cmd: /named\.conf\.local|EOF/ } },
    { title: "Zonendatei schreiben", cmd: `sudo tee /etc/bind/db.lab.local << 'EOF'
$TTL 3600
@       IN  SOA ns1.lab.local. admin.lab.local. (
            2026110601 ; Serial (JJJJMMTTnn) - bei jeder Aenderung erhoehen!
            3600       ; Refresh
            900        ; Retry
            604800     ; Expire
            3600 )     ; Negative TTL
@       IN  NS    ns1.lab.local.
@       IN  MX 10 mail.lab.local.
ns1     IN  A     127.0.0.1
server  IN  A     192.168.10.10
mail    IN  A     192.168.10.11
drucker IN  A     192.168.10.50
www     IN  CNAME server
EOF`, check: { cmd: /db\.lab\.local|EOF/ } },
    { title: "Syntax prüfen", cmd: "sudo named-checkconf && sudo named-checkzone lab.local /etc/bind/db.lab.local", check: { cmd: /named-checkzone/, out: /OK/ } },
    { title: "Neu laden & abfragen", cmd: ["sudo systemctl reload named", "dig @127.0.0.1 www.lab.local"], check: { cmd: /^dig\s/, out: /192\.168\.10\.10/ },
      explain: `In der ANSWER SECTION siehst du erst den CNAME (www → server) und dann den A-Record. <code>dig @127.0.0.1 lab.local MX +short</code> zeigt den Mailserver.` },
    { title: "Record-Typen merken", text: `<table><tr><td><b>A</b> / <b>AAAA</b></td><td>Name → IPv4 / IPv6</td></tr><tr><td><b>CNAME</b></td><td>Alias auf anderen Namen</td></tr><tr><td><b>MX</b></td><td>Mailserver der Domain (mit Priorität)</td></tr><tr><td><b>NS</b></td><td>zuständiger Nameserver</td></tr><tr><td><b>PTR</b></td><td>IP → Name (Reverse-Zone)</td></tr><tr><td><b>SOA</b></td><td>Verwaltungsinfos der Zone</td></tr><tr><td><b>TXT</b></td><td>Freitext, z. B. SPF/DKIM</td></tr></table>` },
  ],
},
{
  id: "v11-dhcp", mode: "ssh", title: "DHCP-Server: Kea",
  intro: `<b>Kea</b> ist der moderne DHCP-Server von ISC (Nachfolger von isc-dhcp-server). ⚠️ In diesem Lab schreiben und <b>prüfen</b> wir die Konfiguration nur, denn ein zweiter DHCP-Server im Netz kann echte Geräte durcheinanderbringen.`,
  steps: [
    { title: "Installieren", cmd: "sudo apt install -y kea-dhcp4-server", check: { cmd: /apt(-get)?\s+install\s.*kea/ } },
    { title: "Konfiguration schreiben", text: `Kea nutzt JSON. Wir sichern zuerst das Original.`,
      cmd: `sudo cp /etc/kea/kea-dhcp4.conf /etc/kea/kea-dhcp4.conf.orig
sudo tee /etc/kea/kea-dhcp4.conf << 'EOF'
{
  "Dhcp4": {
    "interfaces-config": { "interfaces": [ "eth0" ] },
    "lease-database": { "type": "memfile", "persist": true, "name": "/var/lib/kea/kea-leases4.csv" },
    "valid-lifetime": 86400,
    "subnet4": [
      {
        "id": 1,
        "subnet": "192.168.10.0/24",
        "pools": [ { "pool": "192.168.10.100 - 192.168.10.200" } ],
        "option-data": [
          { "name": "routers", "data": "192.168.10.1" },
          { "name": "domain-name-servers", "data": "192.168.10.10" },
          { "name": "domain-name", "data": "lab.local" }
        ],
        "reservations": [
          { "hw-address": "aa:bb:cc:dd:ee:01", "ip-address": "192.168.10.50", "hostname": "drucker" }
        ]
      }
    ]
  }
}
EOF`, check: { cmd: /kea-dhcp4\.conf|EOF/ } },
    { title: "Syntax prüfen", cmd: "sudo kea-dhcp4 -t /etc/kea/kea-dhcp4.conf", check: { cmd: /kea-dhcp4\s+-t/, notOut: /ERROR|failed/i } },
    { title: "DORA verstehen", text: `So bekommt ein Client seine IP:<ol><li><b>D</b>iscover – Client ruft per Broadcast „Gibt's hier DHCP?“</li><li><b>O</b>ffer – Server bietet eine IP an</li><li><b>R</b>equest – Client fordert diese IP an</li><li><b>A</b>cknowledge – Server bestätigt, Lease beginnt</li></ol>Ports: Server UDP 67, Client UDP 68. Über Router hinweg braucht man einen <b>DHCP-Relay</b> (ip helper-address).` },
    { title: "Original wiederherstellen", text: `Damit der Dienst nicht versehentlich im Netz verteilt:`,
      cmd: "sudo cp /etc/kea/kea-dhcp4.conf.orig /etc/kea/kea-dhcp4.conf && sudo systemctl disable --now kea-dhcp4-server", check: { cmd: /kea-dhcp4\.conf\.orig/ } },
  ],
},
{
  id: "v12-storage", mode: "ssh", title: "Datenträger, Mounten & LVM",
  intro: `Festplatten partitionieren, formatieren, einhängen – und flexibel mit LVM verwalten. Wir üben gefahrlos mit <b>Image-Dateien</b> als virtuelle Festplatten (Loop-Devices).`,
  steps: [
    { title: "Blockgeräte ansehen", cmd: "lsblk", check: { cmd: /^lsblk/ } },
    { title: "Zwei virtuelle Platten", cmd: ["sudo fallocate -l 500M /srv/disk1.img && sudo fallocate -l 500M /srv/disk2.img", "sudo losetup -fP /srv/disk1.img && sudo losetup -fP /srv/disk2.img", "losetup -a"],
      check: { cmd: /losetup\s+-a/, out: /disk2\.img/ } },
    { title: "Dateisystem & Mount", text: `Gib die Loop-Nummer von disk1 an (aus <code>losetup -a</code>, z. B. <code>/dev/loop8</code>).`,
      cmd: ["DISK1=$(losetup -j /srv/disk1.img | cut -d: -f1); echo $DISK1", "sudo mkfs.ext4 $DISK1", "sudo mkdir -p /mnt/daten && sudo mount $DISK1 /mnt/daten", "df -h /mnt/daten"],
      check: { cmd: /^df\b.*\/mnt\/daten/, out: /\/mnt\/daten/ } },
    { title: "Dauerhaft einhängen: fstab", text: `Was beim Booten gemountet wird, steht in <code>/etc/fstab</code>. Am besten per <b>UUID</b>:`, cmd: ["sudo blkid $DISK1", "cat /etc/fstab"],
      check: { cmd: /blkid/ },
      explain: `Eine fstab-Zeile: <code>UUID=… /mnt/daten ext4 defaults 0 2</code>. Nach Änderungen immer mit <code>sudo mount -a</code> testen – ein Fehler in der fstab kann den Bootvorgang stoppen!` },
    { title: "Wieder aushängen", cmd: "sudo umount /mnt/daten", check: { cmd: /umount/ } },
    { title: "LVM aufbauen", text: `Die Frage „Wipe it?“ (disk1 hat noch ein ext4-Dateisystem) mit <kbd>y</kbd> beantworten.<br>LVM-Schichten: <b>PV</b> (physische Platte) → <b>VG</b> (Volume Group, Speicherpool) → <b>LV</b> (logisches Volume, wie eine Partition).`,
      cmd: ["DISK2=$(losetup -j /srv/disk2.img | cut -d: -f1)", "sudo pvcreate $DISK1 $DISK2", "sudo vgcreate vg_daten $DISK1 $DISK2", "sudo lvcreate -n lv_projekte -L 600M vg_daten", "sudo lvs"],
      check: { cmd: /lvs|lvdisplay/, out: /lv_projekte/ },
      explain: `600 MB passen auf keine der beiden 500-MB-Platten allein – LVM fasst sie zusammen.` },
    { title: "Online vergrößern", cmd: ["sudo mkfs.ext4 /dev/vg_daten/lv_projekte && sudo mount /dev/vg_daten/lv_projekte /mnt/daten", "sudo lvextend -r -L +200M /dev/vg_daten/lv_projekte", "df -h /mnt/daten"],
      check: { cmd: /lvextend/ },
      explain: `<code>-r</code> vergrößert das Dateisystem gleich mit (resize2fs). Das geht im laufenden Betrieb – ein großer Vorteil von LVM.` },
  ],
  outro: `🎓 <b>RAID-Merkhilfe:</b> RAID 0 = Striping (schnell, keine Sicherheit) · RAID 1 = Spiegelung · RAID 5 = Parität, min. 3 Platten, 1 darf ausfallen · RAID 6 = 2 dürfen ausfallen · RAID 10 = Spiegel + Striping. Unter Linux: <code>mdadm</code>. <b>RAID ersetzt kein Backup!</b>`,
},
{
  id: "v13-cron", mode: "ssh", title: "Automatisieren: cron & Backups",
  intro: `Wiederkehrende Aufgaben (Backups, Updates, Aufräumen) plant man mit <b>cron</b> oder systemd-Timern.`,
  steps: [
    { title: "Backup-Skript", cmd: `sudo tee /usr/local/bin/backup-web.sh << 'EOF'
#!/bin/bash
set -euo pipefail
ZIEL=/var/backups/web
mkdir -p "$ZIEL"
tar -czf "$ZIEL/www-$(date +%F_%H%M).tar.gz" /var/www
# Nur die letzten 7 Backups behalten
ls -1t "$ZIEL"/www-*.tar.gz | tail -n +8 | xargs -r rm --
echo "$(date): Backup OK"
EOF
sudo chmod +x /usr/local/bin/backup-web.sh`, check: { cmd: /backup-web\.sh/ } },
    { title: "Testlauf", cmd: "sudo /usr/local/bin/backup-web.sh && ls -lh /var/backups/web", check: { cmd: /backup-web\.sh/, out: /Backup OK/ } },
    { title: "Cronjob anlegen", text: `Format: <code>Minute Stunde Tag Monat Wochentag Befehl</code>.<table>
      <tr><td><code>30 2 * * *</code></td><td>täglich 02:30</td></tr><tr><td><code>*/15 * * * *</code></td><td>alle 15 Minuten</td></tr>
      <tr><td><code>0 8 * * 1-5</code></td><td>Mo–Fr um 08:00</td></tr><tr><td><code>0 0 1 * *</code></td><td>am 1. jedes Monats</td></tr></table>
      Normalerweise mit <code>sudo crontab -e</code> (Editor). Hier per Einzeiler:`,
      cmd: `(sudo crontab -l 2>/dev/null; echo "30 2 * * * /usr/local/bin/backup-web.sh >> /var/log/backup-web.log 2>&1") | sudo crontab -`, check: { cmd: /crontab\s+-\s*$/ } },
    { title: "Kontrollieren", cmd: "sudo crontab -l", check: { cmd: /crontab\s+-l/, out: /backup-web/ } },
    { title: "Backup woanders hin: rsync", text: `<code>rsync</code> kopiert nur Änderungen – ideal für Backups auf einen anderen Server (über SSH).`,
      cmd: "sudo rsync -av --delete /var/www/ /var/backups/www-spiegel/", check: { cmd: /^(sudo\s+)?rsync\s/ },
      explain: `Remote: <code>rsync -avz /var/www/ backup@nas:/sicherung/www/</code>. Merke die <b>3-2-1-Regel</b>: 3 Kopien, 2 verschiedene Medien, 1 außer Haus.` },
    { title: "systemd-Timer ansehen", text: `Die moderne Alternative zu cron:`, cmd: "systemctl list-timers --no-pager", check: { cmd: /list-timers/ } },
  ],
},
{
  id: "v14-docker", mode: "ssh", title: "Container: Docker",
  intro: `Container verpacken eine Anwendung mit allen Abhängigkeiten. Im Gegensatz zu VMs teilen sie sich den Kernel des Hosts – leichtgewichtig und schnell.`,
  steps: [
    { title: "Docker installieren", text: `Die einfachste Variante aus den Ubuntu-Quellen (in Firmen oft das offizielle Docker-Repo):`,
      cmd: "sudo apt install -y docker.io docker-compose-v2", check: { cmd: /apt(-get)?\s+install\s.*docker/ } },
    { title: "Ohne sudo nutzen", text: `Benutzer zur Gruppe docker hinzufügen, danach <b>neu verbinden</b> (oben trennen + verbinden) oder <code>newgrp docker</code>.`,
      cmd: ["sudo usermod -aG docker $USER", "newgrp docker"], check: { cmd: /usermod\s+-aG\s+docker|newgrp/ } },
    { title: "Erster Container", cmd: "docker run --rm hello-world", check: { cmd: /docker\s+run/, out: /Hello from Docker/ } },
    { title: "Webserver im Container", text: `<code>-d</code> = im Hintergrund, <code>-p 8080:80</code> = Host-Port 8080 → Container-Port 80.`,
      cmd: ["docker run -d --name web -p 8080:80 nginx", "curl -s localhost:8080 | grep title"], check: { cmd: /curl.*8080/, out: /nginx/i } },
    { title: "Container verwalten", cmd: ["docker ps", "docker logs web", "docker exec web nginx -v"], task: "Lass dir die laufenden Container anzeigen.", check: { cmd: /docker\s+(ps|container\s+ls)/, out: /web/ },
      explain: `In den Container hinein: <code>docker exec -it web bash</code> – der Prompt wechselt dann zu <code>root@&lt;id&gt;</code>. Mit <code>exit</code> kommst du wieder auf die VM zurück (sonst heißt es „docker: command not found“). Weitere: <code>docker stop web</code>, <code>docker rm web</code>, <code>docker images</code>, <code>docker pull image</code>.` },
    { title: "Docker Compose", text: `Mehrere Container als Einheit beschreiben – Standard für Homelab & Server:`,
      cmd: `mkdir -p ~/wiki && cd ~/wiki && cat > compose.yaml << 'EOF'
services:
  web:
    image: nginx:alpine
    ports:
      - "8081:80"
    volumes:
      - ./html:/usr/share/nginx/html:ro
    restart: unless-stopped
EOF
mkdir -p html && echo "<h1>Compose läuft</h1>" > html/index.html && docker compose up -d`, check: { cmd: /docker\s+compose\s+up/ } },
    { title: "Testen & Aufräumen", cmd: ["curl localhost:8081", "docker compose down", "docker rm -f web"], check: { cmd: /docker\s+compose\s+down|docker\s+rm/ } },
  ],
},
{
  id: "v15-trouble", mode: "ssh", title: "Troubleshooting-Checkliste",
  intro: `Wenn „der Server nicht geht“: systematisch von unten nach oben (OSI-Modell) prüfen. Diese Befehle solltest du im Schlaf können.`,
  steps: [
    { title: "Fehler seit dem Boot", cmd: "journalctl -p err -b --no-pager | tail -20", check: { cmd: /journalctl.*-p\s*err/ } },
    { title: "Fehlgeschlagene Dienste", cmd: "systemctl --failed", check: { cmd: /systemctl\s+--failed|list-units\s+--failed/ } },
    { title: "Platte voll?", cmd: ["df -h", "sudo du -xh / --max-depth=1 2>/dev/null | sort -h | tail"], check: { cmd: /^(sudo\s+)?du\s/ } },
    { title: "Wer frisst Ressourcen?", cmd: "htop", text: `<kbd>F6</kbd> sortieren, <kbd>F9</kbd> Prozess beenden, <kbd>q</kbd> raus.`, check: { cmd: /^h?top/ } },
    { title: "Wer hat sich angemeldet?", cmd: ["last -n 10", "sudo grep 'Failed password' /var/log/auth.log | tail"], check: { cmd: /^last|auth\.log/ } },
    { title: "Netzwerk Schicht für Schicht", text: `<ol><li>Link da? <code>ip -br link</code></li><li>IP da? <code>ip -br a</code></li><li>Gateway erreichbar? <code>ping -c2 $(ip r | awk '/default/{print $3}')</code></li><li>Internet? <code>ping -c2 1.1.1.1</code></li><li>DNS? <code>dig +short ubuntu.com</code></li><li>Dienst lauscht? <code>sudo ss -tlnp</code></li><li>Firewall? <code>sudo ufw status</code></li></ol>` },
  ],
  outro: `🏁 <b>Glückwunsch!</b> Du hast die wichtigsten Linux-Admin-Themen der FISI-Ausbildung einmal praktisch durchgespielt. Tipp: Setz die VM per Snapshot zurück und mach die Lektionen nochmal – ohne „übernehmen“-Button.`,
},
/* ===================================================================== */
/* TEIL 3 – SELBST HOSTEN                                                */
/* ===================================================================== */
{
  id: "s1-kuma", mode: "ssh", group: "self", title: "Selbst hosten: Uptime Kuma",
  intro: `Ab hier wird's praktisch für dein eigenes <b>Homelab</b>: Dienste, die du wirklich nutzen kannst. Fast alles läuft heute als <b>Docker-Container mit Compose</b>. Voraussetzung: Lektion „Container: Docker“. Erster Dienst: <b>Uptime Kuma</b> – überwacht Webseiten und Server und meldet Ausfälle.`,
  steps: [
    { title: "Projektordner & Compose-Datei", text: `Pro Dienst ein Ordner mit <code>compose.yaml</code> – so bleibt alles übersichtlich und sicherbar.`,
      cmd: `mkdir -p ~/selfhost/kuma && cd ~/selfhost/kuma && cat > compose.yaml << 'EOF'
services:
  kuma:
    image: louislam/uptime-kuma:1
    container_name: kuma
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
EOF`, check: { cmd: /selfhost\/kuma|compose\.yaml/ } },
    { title: "Starten", cmd: "docker compose up -d", check: { cmd: /compose\s+up/ },
      explain: `Falls „permission denied“: entweder <code>sudo</code> davor oder dich in die Gruppe <code>docker</code> aufnehmen (Lektion Docker) und neu verbinden.` },
    { title: "Läuft er?", cmd: "docker compose ps", check: { cmd: /compose\s+ps|docker\s+ps/, out: /kuma/ } },
    { title: "Einrichten", text: `Öffne <a href="http://{{IP}}:3001" target="_blank">http://{{IP}}:3001</a>, leg ein Admin-Konto an und füge Monitore hinzu, z. B.:<ul><li>HTTP: <code>http://{{IP}}</code> (deine LEMP-Seite)</li><li>Ping: <code>1.1.1.1</code></li><li>TCP-Port: <code>{{IP}}</code> Port <code>22</code></li></ul>Dann stopp mal nginx (<code>sudo systemctl stop nginx</code>) und schau, wie Kuma reagiert.` },
  ],
},
{
  id: "s2-gitea", mode: "ssh", group: "self", title: "Selbst hosten: Gitea (eigenes Git)",
  intro: `<b>Gitea</b> ist ein schlankes „eigenes GitHub“: Repositories, Issues, Wiki – auf deinem Server. Perfekt für Skripte und Konfigurationen deines Homelabs.`,
  steps: [
    { title: "Compose-Datei", cmd: `mkdir -p ~/selfhost/gitea && cd ~/selfhost/gitea && cat > compose.yaml << 'EOF'
services:
  gitea:
    image: gitea/gitea:1.22
    container_name: gitea
    environment:
      - USER_UID=1000
      - USER_GID=1000
    ports:
      - "3000:3000"
      - "2222:22"
    volumes:
      - ./data:/data
    restart: unless-stopped
EOF`, check: { cmd: /selfhost\/gitea|compose\.yaml/ } },
    { title: "Starten", cmd: "docker compose up -d && docker compose logs --tail 5", check: { cmd: /compose\s+up/ } },
    { title: "Installation abschließen", text: `<a href="http://{{IP}}:3000" target="_blank">http://{{IP}}:3000</a> öffnen. Datenbank: <b>SQLite3</b> (reicht völlig), Server-Domain: <code>{{IP}}</code>, Basis-URL: <code>http://{{IP}}:3000/</code>. Unten ein Admin-Konto anlegen → Installieren.` },
    { title: "Erstes Repository", text: `In Gitea ein Repo <code>homelab</code> anlegen. Dann in der VM deine Compose-Dateien versionieren:`,
      cmd: ["cd ~/selfhost && git init -b main && git add */compose.yaml && git -c user.name=Azubi -c user.email=azubi@lab commit -m 'Meine Dienste'", "git log --oneline"],
      check: { cmd: /git\s+(log|commit)/ },
      explain: `Pushen: <code>git remote add origin http://{{IP}}:3000/DEINNAME/homelab.git && git push -u origin main</code>. So hast du deine Server-Konfiguration nachvollziehbar gesichert – „Infrastructure as Code“ im Kleinen.` },
  ],
},
{
  id: "s3-proxy", mode: "ssh", group: "self", title: "Reverse Proxy mit Caddy",
  intro: `Statt dir Ports zu merken (<code>:3000</code>, <code>:3001</code> …) gibt es einen <b>Reverse Proxy</b>: Er nimmt alle Anfragen an und leitet sie anhand des <b>Hostnamens</b> an den richtigen Dienst weiter. <b>Caddy</b> ist dafür besonders einfach (und holt sich bei öffentlichen Domains automatisch HTTPS-Zertifikate).`,
  steps: [
    { title: "Namen ohne eigenen DNS: nip.io", text: `<code>nip.io</code> ist ein öffentlicher DNS-Dienst, der jeden Namen mit einer IP darin auf genau diese IP auflöst: <code>kuma.{{IP}}.nip.io</code> → <code>{{IP}}</code>. Teste es:`,
      cmd: "IP=$(hostname -I | awk '{print $1}'); echo $IP; dig +short kuma.$IP.nip.io", check: { cmd: /nip\.io/, out: /\d+\.\d+\.\d+\.\d+/ } },
    { title: "Caddy konfigurieren", text: `Caddy lauscht hier auf Port <b>8088</b>, damit er nicht mit nginx kollidiert.`,
      cmd: `IP=$(hostname -I | awk '{print $1}'); mkdir -p ~/selfhost/caddy && cd ~/selfhost/caddy && cat > Caddyfile << EOF
http://kuma.$IP.nip.io:8088 {
    reverse_proxy $IP:3001
}
http://git.$IP.nip.io:8088 {
    reverse_proxy $IP:3000
}
EOF
cat > compose.yaml << 'EOF'
services:
  caddy:
    image: caddy:2
    container_name: caddy
    ports:
      - "8088:8088"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data:/data
    restart: unless-stopped
EOF
cat Caddyfile`, check: { cmd: /Caddyfile|caddy/, out: /reverse_proxy/ } },
    { title: "Starten & testen", cmd: ["docker compose up -d", `curl -s -o /dev/null -w "%{http_code}\\n" http://kuma.$IP.nip.io:8088`],
      check: { cmd: /curl.*nip\.io/, out: /\b(200|302)\b/ } },
    { title: "Im Browser", text: `<a href="http://kuma.{{IP}}.nip.io:8088" target="_blank">http://kuma.{{IP}}.nip.io:8088</a> und <a href="http://git.{{IP}}.nip.io:8088" target="_blank">http://git.{{IP}}.nip.io:8088</a> – ein Port, zwei Dienste.`,
      explain: `Im echten Homelab nimmt man eine eigene Domain (oder einen internen DNS wie Pi-hole/AdGuard Home) und lässt den Reverse Proxy auf 80/443 laufen. Caddy holt dann automatisch Let's-Encrypt-Zertifikate.` },
  ],
},
{
  id: "s4-care", mode: "ssh", group: "self", title: "Dienste pflegen: Updates, Backups, Sicherheit",
  intro: `Selbst hosten heißt auch: <b>du</b> bist der Admin. Drei Dinge entscheiden, ob dein Homelab Freude oder Ärger macht.`,
  steps: [
    { title: "Updates einspielen", text: `Neues Image holen und Container neu erstellen – die Daten bleiben im Volume.`,
      cmd: "cd ~/selfhost/kuma && docker compose pull && docker compose up -d && docker image prune -f", check: { cmd: /compose\s+pull/ } },
    { title: "Backup der Daten", text: `Alles Wichtige liegt in den <code>data</code>-Ordnern. Für ein konsistentes Backup den Dienst kurz stoppen:`,
      cmd: "cd ~/selfhost && docker compose -f kuma/compose.yaml stop && sudo tar -czf ~/selfhost-$(date +%F).tar.gz . && docker compose -f kuma/compose.yaml start && ls -lh ~/selfhost-*.tar.gz",
      check: { cmd: /tar\s+-czf/, out: /selfhost-/ } },
    { title: "Sicherheit – die goldenen Regeln", text: `<ul>
      <li><b>Nichts direkt ins Internet</b> stellen (keine Portfreigaben im Router). Für Zugriff von unterwegs: <b>VPN</b> – WireGuard oder Tailscale.</li>
      <li>Regelmäßig updaten (OS + Container). <code>unattended-upgrades</code> spielt Sicherheitsupdates automatisch ein.</li>
      <li>SSH nur mit Schlüssel, Firewall an, starke Passwörter / Passwortmanager.</li>
      <li><b>3-2-1-Backups</b> – und den Restore auch mal testen!</li></ul>` },
    { title: "Ideen für dein Homelab", text: `<table>
      <tr><th>Dienst</th><th>Wofür</th></tr>
      <tr><td>Proxmox VE</td><td>Hypervisor für einen alten PC/Mini-PC – darauf laufen deine VMs & Container</td></tr>
      <tr><td>Nextcloud</td><td>Eigene Cloud: Dateien, Kalender, Kontakte</td></tr>
      <tr><td>Immich</td><td>Fotos vom Handy automatisch sichern</td></tr>
      <tr><td>Vaultwarden</td><td>Passwortmanager (Bitwarden-kompatibel)</td></tr>
      <tr><td>AdGuard Home / Pi-hole</td><td>Werbeblocker + interner DNS fürs ganze Netz</td></tr>
      <tr><td>Home Assistant</td><td>Smart Home lokal steuern</td></tr>
      <tr><td>Paperless-ngx</td><td>Papierkram scannen, durchsuchbar ablegen</td></tr>
      <tr><td>Jellyfin</td><td>Eigenes Streaming für Filme & Musik</td></tr></table>
      Viele davon laufen auch auf einem Raspberry Pi. Fang klein an: Ein Dienst, den du wirklich nutzt, lehrt mehr als zehn, die nur herumstehen.` },
  ],
},
{
  id: "z-end", mode: "ssh", group: "self", title: "Abschluss: Und jetzt?",
  intro: `Du hast den kompletten Weg gemacht: von <code>ls</code> bis zum eigenen Reverse Proxy. 🎉`,
  steps: [
    { title: "Weiter trainieren", text: `Im Tab <b>🔁 Training</b> warten Karten auf dich, die mit der Zeit schwieriger werden. In <b>🎯 Missionen</b> löst du echte Störfälle – wie im Admin-Alltag. Kurze Einheiten an mehreren Tagen bringen mehr als ein langer Abend.` },
    { title: "VM behalten oder löschen?", text: `Deine VM belegt etwa 3–10 GB auf der Festplatte.<ul><li><b>Behalten</b>: 🌙 Feierabend → sie ist gestoppt und braucht weder RAM noch CPU. Ideal, wenn du weiterübst oder deine Dienste weiter nutzt.</li><li><b>Löschen</b>: VM-Zentrale → „VM löschen“. Du kannst jederzeit eine neue erstellen.</li></ul><button class="primary" data-action="vm-center">⚙ VM-Zentrale öffnen</button>` },
    { title: "Prüfungsvorbereitung", text: `Für die IHK-Prüfung (FISI) besonders wichtig: Rechte (Oktal, SUID/SGID/Sticky), Dienste & Ports, DNS-Records, DHCP (DORA), RAID & Backup-Strategien, Netzwerk-Troubleshooting nach OSI. Alles davon steckt in den Lektionen – wiederhole gezielt die, bei denen dir das Training Probleme anzeigt.` },
  ],
},
];
