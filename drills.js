/* Trainingskarten (Wiederholung nach dem Lernkartei-Prinzip)
 * lvl 1 = Abrufen (Ziel ist klar beschrieben)
 * lvl 2 = Anwenden (Optionen/Kombinationen selbst finden)
 * lvl 3 = Suchen & Lösen (nur das Problem ist bekannt – du musst selbst forschen)
 * after: Lektion, die (zur Hälfte) erledigt sein muss, damit die Karte auftaucht
 * setup: (nur Mini-Linux) Befehle, die vorher still ausgeführt werden
 */
window.DRILLS = [
/* ---------- Mini-Linux · Stufe 1 ---------- */
{ id: "d-whoami", mode: "browser", lvl: 1, after: "b1-start", q: "Mit welchem Benutzer bist du gerade angemeldet?", a: "whoami", check: { cmd: /^(whoami|id)\b/ } },
{ id: "d-pwd", mode: "browser", lvl: 1, after: "b1-start", q: "In welchem Verzeichnis befindest du dich gerade?", a: "pwd", check: { cmd: /^pwd$/ } },
{ id: "d-lsa", mode: "browser", lvl: 1, after: "b1-start", q: "Zeige <b>alle</b> Dateien im aktuellen Ordner – auch versteckte – als ausführliche Liste.", a: "ls -la", check: { cmd: /^ls\s+(-la|-al|-l\s+-a|-a\s+-l|-lA|-Al)\b/ } },
{ id: "d-kernel", mode: "browser", lvl: 1, after: "b1-start", q: "Welche Kernel-Version läuft? Lass sie dir anzeigen.", a: "uname -r", check: { cmd: /^uname\s+-[a-z]*[ra]/ } },
{ id: "d-cdroot", mode: "browser", lvl: 1, after: "b2-nav", q: "Wechsle in das oberste Verzeichnis des Dateisystems.", a: "cd /", check: { cmd: /^cd\s+\/$/ } },
{ id: "d-cdhome", mode: "browser", lvl: 1, after: "b2-nav", q: "Spring zurück in dein Home-Verzeichnis – mit dem kürzesten möglichen Befehl.", a: "cd", check: { cmd: /^cd(\s+~)?$/ } },
{ id: "d-config", mode: "browser", lvl: 1, after: "b2-nav", q: "Wechsle in das Verzeichnis, in dem Linux seine Konfigurationsdateien ablegt.", a: "cd /etc", check: { cmd: /^cd\s+\/etc\/?$/ } },
{ id: "d-mkdirp", mode: "browser", lvl: 1, after: "b3-files", q: "Lege in einem Rutsch die Ordnerstruktur <code>kunden/2026/rechnungen</code> an.", a: "mkdir -p kunden/2026/rechnungen", check: { cmd: /^mkdir\s+-p\s+\S*kunden\/2026\/rechnungen/ } },
{ id: "d-append", mode: "browser", lvl: 1, after: "b3-files", q: "Hänge die Zeile <code>Neuer Eintrag</code> an die Datei <code>log.txt</code> an, <b>ohne</b> den bisherigen Inhalt zu überschreiben.", a: 'echo "Neuer Eintrag" >> log.txt', check: { cmd: /^echo\s.*>>\s*log\.txt/ } },
{ id: "d-rmr", mode: "browser", lvl: 1, after: "b3-files", setup: "mkdir -p alt/kram && touch alt/kram/a alt/b", q: "Lösche den Ordner <code>alt</code> samt Inhalt.", a: "rm -r alt", check: { cmd: /^rm\s+-[a-z]*r[a-z]*\s+alt\/?$/ } },
{ id: "d-tail", mode: "browser", lvl: 1, after: "b4-read", q: "Zeige die <b>letzten 3 Zeilen</b> von <code>/etc/passwd</code>.", a: "tail -n 3 /etc/passwd", check: { cmd: /^tail\s+(-n\s*3|-3)\s+\/etc\/passwd/ } },
{ id: "d-grepi", mode: "browser", lvl: 1, after: "b4-read", q: "Durchsuche <code>/etc/services</code> nach <code>FTP</code> – Groß-/Kleinschreibung soll egal sein.", a: "grep -i ftp /etc/services", check: { cmd: /^grep\s+(-\w*i\w*\s+)/, out: /ftp/i } },
{ id: "d-chmodx", mode: "browser", lvl: 1, after: "b6-perms", setup: "echo 'echo los' > start.sh", q: "Mach <code>start.sh</code> ausführbar und starte es.", a: "chmod +x start.sh && ./start.sh", check: { out: /^los$/m } },
{ id: "d-bg", mode: "browser", lvl: 1, after: "b7-proc", q: "Starte <code>sleep 300</code> so, dass du die Shell weiter benutzen kannst.", a: "sleep 300 &", check: { cmd: /^sleep\s+\d+\s*&$/ } },
{ id: "d-df", mode: "browser", lvl: 1, after: "b10-sys", q: "Wie viel Plattenplatz ist noch frei? (in lesbaren Einheiten)", a: "df -h", check: { cmd: /^df\s+-\w*h/ } },
{ id: "d-free", mode: "browser", lvl: 1, after: "b10-sys", q: "Wie viel Arbeitsspeicher ist belegt? (in MB)", a: "free -m", check: { cmd: /^free\b/ } },

/* ---------- Mini-Linux · Stufe 2 ---------- */
{ id: "d-countusers", mode: "browser", lvl: 2, after: "b5-pipes", q: "Wie viele Benutzerkonten gibt es auf dem System? Antworte mit einer Zahl – ein Befehl.", a: "wc -l < /etc/passwd   (oder: cat /etc/passwd | wc -l)", check: { cmd: /passwd/, out: /^\s*\d+\s*$/m } },
{ id: "d-sortshells", mode: "browser", lvl: 2, after: "b5-pipes", q: "Liste alle Login-Shells aus <code>/etc/passwd</code> auf – jede nur einmal.", a: "cut -d: -f7 /etc/passwd | sort -u", check: { cmd: /cut.*-f\s*7.*\|\s*sort\s+(-u|.*\|\s*uniq)/ } },
{ id: "d-errnull", mode: "browser", lvl: 2, after: "b5-pipes", q: "Suche mit <code>find /</code> nach Dateien namens <code>passwd</code> – Fehlermeldungen sollen nicht erscheinen.", a: "find / -name passwd 2>/dev/null", check: { cmd: /^find\s+\/\s.*-name\s+passwd.*2>\s*\/dev\/null/ } },
{ id: "d-octal", mode: "browser", lvl: 2, after: "b6-perms", setup: "echo geheim > geheim.txt", q: "<code>geheim.txt</code> soll nur noch vom Besitzer gelesen und geschrieben werden dürfen – sonst von niemandem. Setze es in Oktal-Schreibweise.", a: "chmod 600 geheim.txt", check: { cmd: /^chmod\s+0?600\s+geheim\.txt/ } },
{ id: "d-rwxr", mode: "browser", lvl: 2, after: "b6-perms", q: "Welche Oktalzahl entspricht <code>rwxr-xr--</code>? Gib sie mit <code>echo</code> aus.", a: "echo 754", check: { cmd: /^echo\s+0?754$/ } },
{ id: "d-killname", mode: "browser", lvl: 2, after: "b7-proc", setup: "sleep 900 & true", q: "Im Hintergrund läuft ein <code>sleep</code>-Prozess. Beende ihn – ohne die PID abzutippen.", a: "killall sleep  (oder pkill sleep)", check: { cmd: /^(killall|pkill)\s+sleep/ } },
{ id: "d-tarlist", mode: "browser", lvl: 2, after: "b10-sys", setup: "mkdir -p /tmp/arch/x && touch /tmp/arch/x/eins /tmp/arch/x/zwei && cd /tmp && tar -cf - arch | gzip > /tmp/paket.tar.gz && rm -r /tmp/arch && cd ~", q: "Was steckt im Archiv <code>/tmp/paket.tar.gz</code>? Zeige den Inhalt, <b>ohne</b> es zu entpacken.", a: "zcat /tmp/paket.tar.gz | tar -tf -", check: { out: /arch\/x\/eins/ } },
{ id: "d-forloop", mode: "browser", lvl: 2, after: "b9-script", q: "Lege mit <b>einer</b> Schleife die Dateien <code>tag1.txt</code> bis <code>tag5.txt</code> an.", a: "for i in 1 2 3 4 5; do touch tag$i.txt; done", check: { cmd: /^for\s.*;\s*do\s.*touch/ } },
{ id: "d-exitcode", mode: "browser", lvl: 2, after: "b9-script", q: "Prüfe, ob der Ordner <code>/opt</code> existiert – lass dir nur den Exit-Code des Tests ausgeben (0 = ja).", a: "test -d /opt; echo $?   (oder: [ -d /opt ]; echo $?)", check: { cmd: /(test\s+-d|\[\s+-d)\s+\/opt.*echo\s+\$\?/ } },

/* ---------- Mini-Linux · Stufe 3 (Suchen & Lösen) ---------- */
{ id: "d-findtext", mode: "browser", lvl: 3, after: "b4-read", setup: "mkdir -p /usr/share/.lab/a/b && echo 'Passwort=Sommer2026' > /usr/share/.lab/a/b/notiz.cfg",
  q: "Irgendwo unter <code>/usr/share</code> hat jemand ein Passwort im Klartext abgelegt (die Zeile beginnt mit <code>Passwort=</code>). Finde die Datei.",
  hint: "grep kann rekursiv suchen – und zeigt dir den Dateinamen.", a: "grep -r Passwort= /usr/share", check: { out: /notiz\.cfg/ } },
{ id: "d-findbig", mode: "browser", lvl: 3, after: "b4-read", setup: "mkdir -p /usr/lib/.x && dd if=/dev/zero of=/usr/lib/.x/blob.bin bs=1024 count=6000",
  q: "Unter <code>/usr</code> liegt eine Datei, die größer als 5 MB ist. Wie heißt sie und wo liegt sie?",
  hint: "find kennt eine Option für die Dateigröße. Das BusyBox-find hier versteht kein <code>M</code> – rechne in Kilobyte (<code>k</code>).", a: "find /usr -size +5000k", check: { out: /blob\.bin/ } },
{ id: "d-newest", mode: "browser", lvl: 3, after: "b4-read", setup: "touch /etc/.zuletzt-geaendert",
  q: "Welche Datei in <code>/etc</code> wurde als letztes geändert? Lass dir die Dateien nach Änderungszeit sortiert anzeigen.",
  hint: "ls kann nach Zeit sortieren (und versteckte Dateien zeigen).", a: "ls -lat /etc | head", check: { cmd: /^ls\s+-\w*t/, out: /zuletzt-geaendert/ } },
{ id: "d-portname", mode: "browser", lvl: 3, after: "b5-pipes",
  q: "Welcher Dienst ist in <code>/etc/services</code> für Port <b>3306</b> eingetragen?",
  hint: "Such nach der Portnummer – aber Achtung, sie könnte auch in anderen Zahlen vorkommen.", a: "grep -w 3306 /etc/services", check: { out: /mysql/i } },
{ id: "d-whichbin", mode: "browser", lvl: 3, after: "b2-nav",
  q: "Wo genau liegt das Programm, das ausgeführt wird, wenn du <code>vi</code> tippst?",
  hint: "Es gibt einen Befehl, der im PATH nach Programmen sucht.", a: "which vi", check: { out: /\/bin\/vi/ } },
{ id: "d-uid0", mode: "browser", lvl: 3, after: "b6-perms", setup: "grep -q '^wartung:' /etc/passwd || echo 'wartung:x:0:0:Wartung:/root:/bin/sh' >> /etc/passwd",
  q: "Sicherheits-Audit: Außer <code>root</code> hat noch ein weiteres Konto die UID 0 (= volle Root-Rechte). Welches?",
  hint: "Die UID ist das 3. Feld in /etc/passwd (Trenner :). awk oder grep helfen.", a: "awk -F: '$3==0' /etc/passwd   (oder grep ':x:0:' /etc/passwd)", check: { out: /wartung/ } },

/* ---------- Echte VM · Stufe 1 ---------- */
{ id: "v-aptupd", mode: "ssh", lvl: 1, after: "v1-apt", q: "Aktualisiere die Paketlisten.", a: "sudo apt update", check: { cmd: /apt(-get)?\s+update/ } },
{ id: "v-aptinst", mode: "ssh", lvl: 1, after: "v1-apt", q: "Installiere das Paket <code>ncdu</code> (Festplatten-Analyse) ohne Rückfrage.", a: "sudo apt install -y ncdu", check: { cmd: /apt(-get)?\s+install\s.*ncdu/ } },
{ id: "v-svcstatus", mode: "ssh", lvl: 1, after: "v3-systemd", q: "Wie ist der Zustand des Dienstes <code>cron</code>?", a: "systemctl status cron", check: { cmd: /systemctl\s+(status|is-active)\s+cron/ } },
{ id: "v-journal", mode: "ssh", lvl: 1, after: "v3-systemd", q: "Zeige die letzten 15 Log-Zeilen des SSH-Dienstes.", a: "journalctl -u ssh -n 15", check: { cmd: /journalctl\s.*-u\s*ssh/ } },
{ id: "v-ipaddr", mode: "ssh", lvl: 1, after: "v4-net", q: "Welche IP-Adressen hat die Maschine?", a: "ip a   (oder ip -br a)", check: { cmd: /^ip\s+(-\w+\s+)*(a|addr|address)\b|^hostname\s+-I/ } },
{ id: "v-gw", mode: "ssh", lvl: 1, after: "v4-net", q: "Was ist das Standard-Gateway?", a: "ip r", check: { cmd: /^ip\s+(r|route)/, out: /default/ } },
{ id: "v-ports", mode: "ssh", lvl: 1, after: "v4-net", q: "Welche Ports sind offen und welche Prozesse lauschen dort?", a: "sudo ss -tulpn", check: { cmd: /ss\s+-\w*l\w*/ } },
{ id: "v-ufwstat", mode: "ssh", lvl: 1, after: "v6-ufw", q: "Zeige die Firewall-Regeln mit Nummern.", a: "sudo ufw status numbered", check: { cmd: /ufw\s+status\s+numbered/ } },
{ id: "v-dockerps", mode: "ssh", lvl: 1, after: "v14-docker", q: "Zeige <b>alle</b> Container – auch die gestoppten.", a: "docker ps -a", check: { cmd: /docker\s+(ps\s+-a|container\s+ls\s+-a)/ } },

/* ---------- Echte VM · Stufe 2 ---------- */
{ id: "v-usermod", mode: "ssh", lvl: 2, after: "v2-users", q: "Füge den Benutzer <code>ubuntu</code> zusätzlich der Gruppe <code>adm</code> hinzu (darf Logs lesen) – ohne ihn aus anderen Gruppen zu werfen.", a: "sudo usermod -aG adm ubuntu", check: { cmd: /usermod\s+-aG\s+adm\s+ubuntu|gpasswd\s+-a\s+ubuntu\s+adm/ } },
{ id: "v-enable", mode: "ssh", lvl: 2, after: "v3-systemd", q: "Sorge in <b>einem</b> Befehl dafür, dass <code>cron</code> sofort läuft und beim Booten startet.", a: "sudo systemctl enable --now cron", check: { cmd: /systemctl\s+enable\s+--now\s+cron/ } },
{ id: "v-errlog", mode: "ssh", lvl: 2, after: "v3-systemd", q: "Zeige alle Fehlermeldungen (Priorität err) seit dem letzten Boot – ohne Pager.", a: "journalctl -p err -b --no-pager", check: { err: true, cmd: /journalctl\s.*-p\s*err.*-b|journalctl\s.*-b.*-p\s*err/ } },
{ id: "v-dnsdig", mode: "ssh", lvl: 2, after: "v4-net", q: "Frag direkt beim DNS-Server <code>1.1.1.1</code> nach der IP von <code>debian.org</code> – nur die Adresse soll erscheinen.", a: "dig @1.1.1.1 debian.org +short", check: { cmd: /dig\s.*@1\.1\.1\.1.*\+short|dig\s.*\+short.*@1\.1\.1\.1/ } },
{ id: "v-ufwsubnet", mode: "ssh", lvl: 2, after: "v6-ufw", q: "Erlaube SSH (Port 22/tcp) nur aus dem Netz <code>10.0.0.0/8</code>.", a: "sudo ufw allow from 10.0.0.0/8 to any port 22 proto tcp", check: { cmd: /ufw\s+allow\s+from\s+10\.0\.0\.0\/8.*port\s+22/ } },
{ id: "v-cronexpr", mode: "ssh", lvl: 2, after: "v13-cron", q: "Wie lautet der Cron-Zeitausdruck für „jeden Montag bis Freitag um 6:15 Uhr“? Gib ihn mit <code>echo</code> aus (in Anführungszeichen).", a: 'echo "15 6 * * 1-5"', check: { cmd: /^echo\s+["']15\s+6\s+\*\s+\*\s+(1-5|mon-fri)["']$/i } },
{ id: "v-nginxt", mode: "ssh", lvl: 2, after: "v7-web", q: "Prüfe die nginx-Konfiguration auf Syntaxfehler, bevor du neu lädst.", a: "sudo nginx -t", check: { cmd: /nginx\s+-t/ } },
{ id: "v-dockerlogs", mode: "ssh", lvl: 2, after: "v14-docker", q: "Verfolge die Logs eines Containers namens <code>web</code> live (wenn es keinen gibt, ist die Fehlermeldung auch ok).", a: "docker logs -f web", check: { err: true, cmd: /docker\s+(container\s+)?logs\s+(-f|--follow)\s+web/ } },

/* ---------- Echte VM · Stufe 3 ---------- */
{ id: "v-port22who", mode: "ssh", lvl: 3, after: "v4-net", q: "Welches <b>Programm</b> lauscht auf Port 22? Finde es heraus.", hint: "ss kann dir auch die Prozesse zeigen – dafür braucht es sudo.", a: "sudo ss -tlnp | grep :22", check: { out: /sshd/ } },
{ id: "v-biggestpkg", mode: "ssh", lvl: 3, after: "v1-apt", q: "Welches installierte Paket braucht den meisten Platz?", hint: "dpkg-query kann die Größe ausgeben: <code>-W -f='${Installed-Size} ${Package}\\n'</code> – dann sortieren.", a: "dpkg-query -W -f='${Installed-Size} ${Package}\\n' | sort -n | tail -1", check: { cmd: /dpkg-query.*Installed-Size.*sort/ } },
{ id: "v-lastboot", mode: "ssh", lvl: 3, after: "v15-trouble", q: "Seit wann läuft die Maschine (Datum und Uhrzeit des Starts)?", hint: "uptime hat eine Option dafür.", a: "uptime -s", check: { cmd: /^(uptime\s+-s|who\s+-b|last\s+reboot)/ } },
{ id: "v-failedlogin", mode: "ssh", lvl: 3, after: "v15-trouble", q: "Gab es fehlgeschlagene sudo- oder SSH-Anmeldeversuche? Durchsuche das Auth-Log.", hint: "Das Log liegt in /var/log und heißt nach dem, was es protokolliert.", a: "sudo grep -i fail /var/log/auth.log", check: { cmd: /auth\.log/ } },
{ id: "v-whichpkg", mode: "ssh", lvl: 3, after: "v1-apt", q: "Zu welchem Paket gehört die Datei <code>/usr/bin/curl</code>?", hint: "dpkg kann rückwärts suchen (search).", a: "dpkg -S /usr/bin/curl", check: { out: /^curl:/m } },
{ id: "v-mem-top", mode: "ssh", lvl: 3, after: "v15-trouble", q: "Welcher Prozess braucht gerade am meisten Arbeitsspeicher? Ohne interaktives Programm.", hint: "ps kann sortieren: <code>--sort</code>", a: "ps aux --sort=-%mem | head -3", check: { cmd: /^ps\s.*--sort=-?%?mem|^ps\s.*--sort=-rss/ } },
];
