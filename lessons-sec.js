/* IT-Security Teil 5 – Blue Team: Angriffe erkennen und abwehren (mode "ssh", group "sec").
 * Alles läuft auf DEINER eigenen Übungs-VM. Du spielst den Verteidiger (Admin):
 * Angriffsfläche prüfen, härten, Spuren in Logs lesen, patchen. Keine Angriffe auf fremde Systeme.
 */
window.LESSONS.push(
{
  id: "sec1-recht", mode: "ssh", group: "sec", title: "Spielregeln & Angriffsfläche",
  intro: `Willkommen im Security-Teil. Hier lernst du die <b>Verteidiger-Seite</b> (Blue Team): Du prüfst, härtest und überwachst Systeme. Gearbeitet wird <b>ausschließlich auf deiner eigenen Übungs-VM</b>.`,
  steps: [
    { title: "Die wichtigste Regel zuerst", text: `Die Werkzeuge hier (Portscanner, Log-Analyse) darfst du <b>nur auf eigenen Systemen oder mit ausdrücklicher schriftlicher Erlaubnis</b> einsetzen. Ein Portscan gegen fremde Rechner ist in Deutschland strafbar (u. a. §§ 202a–c, 303b StGB). In echten Pentests gibt es immer einen schriftlichen Auftrag mit klarem „Scope".<br><br>Bestätige, dass du das gelesen hast:`,
      cmd: `echo "Ich arbeite nur auf eigenen Systemen."`, check: { cmd: /^echo\s/, out: /eigenen Systemen/ } },
    { title: "Wer lauscht? Offene Ports von innen", text: `Jeder offene Port ist eine mögliche Tür. <code>ss</code> zeigt alle lauschenden Dienste – mit <code>sudo</code> auch, welches Programm dahinter steckt.`,
      cmd: "sudo ss -tulpn", check: { cmd: /ss\s+-\w*tulpn|ss\s+-\w*t\w*u\w*l/, out: /LISTEN/ },
      explain: `<code>-t</code> TCP, <code>-u</code> UDP, <code>-l</code> nur lauschende, <code>-p</code> Programm, <code>-n</code> Zahlen statt Namen. Faustregel: Was du nicht brauchst, schaltest du ab – das verkleinert die Angriffsfläche.` },
    { title: "Scanner installieren", text: `<code>nmap</code> ist das Standardwerkzeug, um zu sehen, wie ein System <b>von außen</b> aussieht.`,
      cmd: "sudo apt-get install -y -qq nmap", check: { cmd: /apt(-get)?\s+install.*nmap/ } },
    { title: "Die eigene VM scannen", text: `So sieht ein Angreifer deinen Rechner. Du scannst hier <code>localhost</code>, also dich selbst.`,
      cmd: "nmap localhost", check: { cmd: /^nmap\s+(localhost|127\.0\.0\.1)/, out: /open|STATE/ },
      explain: `Jeder <code>open</code>-Port gehört hinterfragt: Brauche ich den Dienst? Muss er wirklich aus dem Netz erreichbar sein? Oft reicht es, ihn nur auf <code>127.0.0.1</code> lauschen zu lassen.` },
    { title: "Dienste und Versionen erkennen", text: `<code>-sV</code> fragt die Dienste nach Name und <b>Version</b> – wichtig, denn veraltete Versionen haben bekannte Lücken (CVEs).`,
      cmd: "nmap -sV localhost", check: { cmd: /nmap\s+-sV/, out: /open|VERSION/ },
      explain: `In der Praxis gleichst du die gefundenen Versionen mit CVE-Datenbanken ab. Darum geht es in der Lektion „Updates & Schwachstellen".` },
  ],
},
{
  id: "sec2-ssh", mode: "ssh", group: "sec", title: "SSH härten",
  intro: `SSH ist auf fast jedem Server offen und damit das häufigste Angriffsziel. Ein paar Einstellungen machen es deutlich sicherer. Änderungen kommen in eine eigene Datei unter <code>/etc/ssh/sshd_config.d/</code> – so bleibt die Originaldatei unberührt.`,
  steps: [
    { title: "Aktuelle Einstellungen ansehen", text: `<code>sshd -T</code> zeigt die <b>tatsächlich wirksame</b> Konfiguration (inklusive Standardwerte).`,
      cmd: "sudo sshd -T | grep -Ei 'permitrootlogin|passwordauthentication|maxauthtries'", check: { cmd: /sshd\s+-T/, out: /permitrootlogin/ } },
    { title: "Härtung schreiben", text: `Root darf sich nicht direkt anmelden, und nach 3 Fehlversuchen ist Schluss. Anmeldung per SSH-Schlüssel ist sicherer als per Passwort.`,
      cmd: `sudo tee /etc/ssh/sshd_config.d/90-haertung.conf << 'EOF'
PermitRootLogin no
MaxAuthTries 3
LoginGraceTime 20
EOF`, check: { cmd: /90-haertung\.conf/ },
      explain: `Warum kein Root per SSH? Weil „root" überall existiert – Angreifer müssen dann nur das Passwort raten. Besser: als normaler Benutzer anmelden und <code>sudo</code> nutzen.` },
    { title: "Konfiguration testen – vor dem Neustart!", text: `<code>sshd -t</code> prüft auf Tippfehler. <b>Immer</b> vor dem Neustart machen – sonst sperrst du dich womöglich aus.`,
      cmd: "sudo sshd -t && echo 'Konfig ok'", check: { cmd: /sshd\s+-t/, out: /Konfig ok/ } },
    { title: "Übernehmen und prüfen", cmd: ["sudo systemctl reload ssh", "sudo sshd -T | grep -i permitrootlogin"],
      check: { cmd: /sshd\s+-T/, out: /permitrootlogin no/ },
      explain: `Weitere übliche Härtung: Anmeldung nur per Schlüssel (<code>PasswordAuthentication no</code>), ein anderer Port (hält automatisierte Scanner fern) und erlaubte Benutzer per <code>AllowUsers</code>.` },
  ],
},
{
  id: "sec3-firewall", mode: "ssh", group: "sec", title: "Firewall & Einbruchschutz",
  intro: `Zwei Bausteine, die auf fast jeden Server gehören: eine <b>Firewall</b>, die nur erlaubt, was gebraucht wird, und <b>fail2ban</b>, das Angreifer nach zu vielen Fehlversuchen automatisch aussperrt.`,
  steps: [
    { title: "SSH zuerst erlauben!", text: `Ganz wichtig: Bevor du die Firewall einschaltest, erlaubst du SSH – sonst kappst du deine eigene Verbindung.`,
      cmd: "sudo ufw allow OpenSSH", check: { cmd: /ufw\s+allow\s+OpenSSH/ } },
    { title: "Standardregeln setzen", text: `Alles Eingehende blockieren, alles Ausgehende erlauben – das ist der sichere Normalfall.`,
      cmd: ["sudo ufw default deny incoming", "sudo ufw default allow outgoing"], check: { cmd: /ufw\s+default\s+deny\s+incoming/ } },
    { title: "Firewall einschalten", cmd: ["sudo ufw --force enable", "sudo ufw status verbose"], check: { cmd: /ufw\s+status/, out: /Status:\s*active/ },
      explain: `<code>ufw</code> („uncomplicated firewall") ist die einfache Oberfläche für die Linux-Firewall <code>iptables</code>/<code>nftables</code>. Einen Port öffnest du mit <code>sudo ufw allow 443/tcp</code>, schließen mit <code>sudo ufw delete allow 443/tcp</code>.` },
    { title: "fail2ban installieren", cmd: "sudo apt-get install -y -qq fail2ban", check: { cmd: /apt(-get)?\s+install.*fail2ban/ } },
    { title: "SSH-Schutz einrichten", text: `Nach 3 Fehlversuchen wird die IP für 10 Minuten gesperrt:`,
      cmd: `sudo tee /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
maxretry = 3
bantime = 10m
findtime = 10m
EOF
sudo systemctl restart fail2ban`, check: { cmd: /jail\.local/ } },
    { title: "Schutz kontrollieren", cmd: "sudo fail2ban-client status sshd", check: { cmd: /fail2ban-client\s+status/, out: /Filter|Actions|Banned/i },
      explain: `<code>fail2ban</code> liest ständig die Logs. Taucht eine IP zu oft mit Fehlanmeldungen auf, trägt es automatisch eine Firewall-Sperre ein. Gesperrte Adressen siehst du unter „Banned IP list". Loopback (127.0.0.1) wird nie gesperrt.` },
  ],
},
{
  id: "sec4-logs", mode: "ssh", group: "sec", title: "Spuren in Logs lesen",
  intro: `Wenn etwas passiert ist, steht es im Log. Ein Admin muss Anmeldungen, Fehlversuche und verdächtige Muster schnell finden. Unter Ubuntu sammelt <code>journald</code> alles; <code>journalctl</code> durchsucht es.`,
  steps: [
    { title: "Wer hat sich angemeldet?", cmd: "last -n 10", check: { cmd: /^last/, out: /\w/ },
      explain: `<code>last</code> zeigt erfolgreiche Anmeldungen, <code>lastb</code> (mit <code>sudo</code>) die <b>fehlgeschlagenen</b> – ein Blick auf Brute-Force-Versuche.` },
    { title: "SSH-Protokoll durchsuchen", text: `Alle Meldungen des SSH-Dienstes:`,
      cmd: "sudo journalctl -u ssh --no-pager | tail -20", check: { cmd: /journalctl\s+-u\s+ssh/ },
      explain: `<code>-u ssh</code> filtert auf den Dienst, <code>--no-pager</code> gibt alles direkt aus. Mit <code>-S today</code> (seit heute) oder <code>-f</code> (live mitlesen) schränkst du weiter ein.` },
    { title: "Fehlanmeldungen zählen", text: `So erkennst du einen Brute-Force-Angriff: viele Fehlversuche in kurzer Zeit.`,
      cmd: "sudo journalctl -u ssh --no-pager | grep -Ei 'failed|invalid' | wc -l", check: { cmd: /journalctl.*(failed|invalid)|grep.*(failed|invalid)/i, out: /^\d+/m } },
    { title: "Angreifer-IPs gruppieren", text: `Welche Adressen fallen am häufigsten auf?`,
      cmd: `sudo journalctl -u ssh --no-pager | grep -oE 'from ([0-9]{1,3}\\.){3}[0-9]{1,3}' | sort | uniq -c | sort -rn | head`,
      check: { cmd: /uniq\s+-c/, out: /\d|^\s*$/ },
      explain: `Dasselbe Muster wie bei der Log-Auswertung im Skript-Kurs: suchen, sortieren, zählen. Genau so füttert man auch ein SIEM (zentrales Sicherheits-Monitoring).` },
    { title: "Verdächtige Prozesse", text: `Läuft etwas, das nicht laufen sollte? Ungewöhnliche Netzwerkverbindungen fallen hier auf:`,
      cmd: "sudo ss -tunp | grep -v '127.0.0.1\\|::1' | head", check: { cmd: /ss\s+-\w*tunp|ss\s+-\w/, out: /\w|^\s*$/ },
      explain: `Ein Prozess, der nach außen „telefoniert" oder einen unbekannten Port öffnet, ist ein Warnzeichen. Im nächsten Teil (Missionen) spürst du so einen Eindringling selbst auf.` },
  ],
},
{
  id: "sec5-patch", mode: "ssh", group: "sec", title: "Updates & Schwachstellen (CVEs)",
  intro: `Die meisten echten Einbrüche nutzen <b>bekannte</b> Lücken, für die längst ein Update existiert. Patchmanagement ist deshalb die wirksamste einzelne Schutzmaßnahme.`,
  steps: [
    { title: "Paketlisten aktualisieren", cmd: "sudo apt-get update", check: { cmd: /apt(-get)?\s+update/ } },
    { title: "Was ist veraltet?", cmd: "apt list --upgradable 2>/dev/null", check: { cmd: /apt\s+list\s+--upgradable/ },
      explain: `Jedes dieser Pakete könnte eine geschlossene Lücke enthalten. Auf Servern gilt: sicherheitsrelevante Updates zeitnah einspielen, am besten automatisiert.` },
    { title: "Automatische Sicherheitsupdates", text: `<code>unattended-upgrades</code> spielt Sicherheitsupdates selbstständig ein – Standard auf gut gepflegten Servern.`,
      cmd: "sudo apt-get install -y -qq unattended-upgrades", check: { cmd: /unattended-upgrades/ } },
    { title: "Kontrollieren, dass es aktiv ist", cmd: "systemctl is-enabled unattended-upgrades", check: { cmd: /is-enabled/, out: /enabled/ },
      explain: `CVE = „Common Vulnerabilities and Exposures", die weltweite Nummer für eine Schwachstelle (z. B. CVE-2024-3094). Der <b>CVSS</b>-Wert (0–10) gibt die Schwere an. Auf Ubuntu zeigt <code>pro security-status</code>, welche Pakete Sicherheitsupdates haben.` },
    { title: "Wie geht's weiter?", text: `<ul><li>Im Tab <b>🎯 Missionen</b> warten jetzt 🛡️ <b>Security-Missionen</b>: Die App spielt eine Einbruchsspur auf deiner VM ein (ein eingeschleuster Benutzer, ein versteckter Dienst, ein manipulierter Cronjob). Du spürst sie auf und beseitigst sie – geprüft wird automatisch.</li><li>Tipp: Vor einer Mission in der VM-Zentrale einen Snapshot anlegen, dann kannst du jederzeit zurück.</li><li>Merke die Kette: <b>erkennen → eindämmen → beseitigen → härten → dokumentieren</b>.</li></ul>` },
  ],
},
{
  id: "sec6-backup", mode: "ssh", group: "sec", title: "Backup & Wiederherstellung",
  intro: `Gegen Ransomware, Hardwaredefekte und Bedienfehler hilft am Ende nur eines: ein <b>funktionierendes Backup</b>. Und „funktionierend" heißt: Du hast die Wiederherstellung schon einmal ausprobiert.`,
  steps: [
    { title: "Etwas Wichtiges anlegen", cmd: "sudo mkdir -p /srv/firma && echo 'Kundenliste 2026' | sudo tee /srv/firma/kunden.txt", check: { cmd: /\/srv\/firma/, out: /Kundenliste/ } },
    { title: "Backup mit Datum im Namen", cmd: `sudo mkdir -p /var/backups/firma && sudo tar czf /var/backups/firma/firma-$(date +%F).tar.gz -C /srv firma && ls -lh /var/backups/firma`,
      check: { cmd: /tar\s+c\w*f/, out: /firma-\d{4}-\d{2}-\d{2}\.tar\.gz/ },
      explain: `<code>-C /srv firma</code> speichert relative Pfade (<code>firma/…</code> statt <code>/srv/firma/…</code>). So kannst du das Backup später auch an einem anderen Ort auspacken.` },
    { title: "Hineinschauen, ohne auszupacken", cmd: "tar tzf /var/backups/firma/firma-*.tar.gz", check: { cmd: /tar\s+t\w*f/, out: /kunden\.txt/ } },
    { title: "Der Ernstfall: Datei zerstört", cmd: ["echo 'VERSCHLUESSELT' | sudo tee /srv/firma/kunden.txt", "cat /srv/firma/kunden.txt"], check: { cmd: /cat\s+\/srv\/firma/, out: /VERSCHLUESSELT/ } },
    { title: "Eine einzelne Datei zurückholen", cmd: "sudo tar xzf /var/backups/firma/firma-*.tar.gz -C /srv firma/kunden.txt && cat /srv/firma/kunden.txt", check: { cmd: /tar\s+x\w*f/, out: /Kundenliste 2026/ },
      explain: `Die <b>3-2-1-Regel</b>: <b>3</b> Kopien der Daten, auf <b>2</b> verschiedenen Medien, <b>1</b> davon außer Haus (oder offline). Ein Backup auf derselben Platte schützt nicht vor Ransomware, denn die verschlüsselt alles, was sie erreicht.` },
    { title: "Prüfsumme: Ist das Backup unversehrt?", cmd: ["cd /var/backups/firma && sha256sum firma-*.tar.gz | sudo tee SHA256SUMS", "sha256sum -c SHA256SUMS"], check: { cmd: /sha256sum\s+-c/, out: /OK/ },
      explain: `Backup-Arten für die Prüfung: <b>Voll</b> (alles), <b>inkrementell</b> (nur Änderungen seit dem <i>letzten</i> Backup – schnell, aber zum Wiederherstellen brauchst du die ganze Kette), <b>differenziell</b> (Änderungen seit dem letzten <i>Vollbackup</i>).` },
  ],
},
{
  id: "sec7-vorfall", mode: "ssh", group: "sec", title: "Sicherheitsvorfall: Runbook & Auswertung",
  intro: `Wenn es brennt, ist keine Zeit zum Nachdenken. Profis haben ein <b>Runbook</b>: eine Checkliste, was in welcher Reihenfolge zu tun ist. Und sie werten Logs so aus, dass Muster sofort auffallen – im Kleinen genau das, was ein <b>SIEM</b> macht.`,
  steps: [
    { title: "Ein Runbook schreiben", text: `Markdown ist das übliche Format – lesbar als Text und hübsch in jedem Wiki.`,
      cmd: `mkdir -p ~/runbooks && cat > ~/runbooks/vorfall.md << 'EOF'
# Runbook: Verdacht auf Einbruch

1. Ruhe bewahren, Uhrzeit notieren, Vorgesetzte/ISB informieren
2. Beweise sichern: \`last\`, \`ss -tunp\`, \`ps auxf\`, Logs kopieren
3. Eindämmen: Netzwerk trennen oder Firewall dicht – NICHT ausschalten (RAM-Spuren)
4. Ursache finden: neue Benutzer, Dienste, Cronjobs, geänderte Dateien
5. Beseitigen und härten, Passwörter/Schlüssel tauschen
6. Aus sauberem Backup wiederherstellen, wenn unklar ist, was verändert wurde
7. Dokumentieren, Meldepflichten prüfen (DSGVO: 72 Stunden)
EOF
cat ~/runbooks/vorfall.md`, check: { cmd: /runbooks/, out: /Runbook/ },
      explain: `Die Reihenfolge folgt dem üblichen Vorfall-Zyklus: <b>Vorbereiten → Erkennen → Eindämmen → Beseitigen → Wiederherstellen → Lehren ziehen</b>. Bei Personendaten muss der Datenschutzvorfall innerhalb von <b>72 Stunden</b> an die Aufsichtsbehörde gemeldet werden (Art. 33 DSGVO).` },
    { title: "Beweise mit Zeitstempel sichern", cmd: `D=~/beweise/$(date +%F_%H%M) && mkdir -p $D && last > $D/last.txt && sudo ss -tunp > $D/verbindungen.txt && ps auxf > $D/prozesse.txt && ls -l $D`,
      check: { cmd: /beweise/, out: /prozesse\.txt/ } },
    { title: "Mini-SIEM: Anmeldungen pro Stunde", text: `Zählt die SSH-Meldungen je Stunde. Ein plötzlicher Ausschlag ist ein typisches Zeichen für einen Brute-Force-Angriff.`,
      cmd: `sudo journalctl -u ssh --no-pager -o short-iso | awk '{print substr($1,1,13)}' | sort | uniq -c | tail`,
      check: { cmd: /journalctl.*\|\s*awk.*uniq\s+-c/, out: /\d/ },
      explain: `<code>-o short-iso</code> liefert Zeitstempel wie <code>2026-11-08T14:03:11</code>; die ersten 13 Zeichen sind Datum + Stunde. Ein echtes SIEM (z. B. Wazuh, Graylog, Splunk) macht das für hunderte Server gleichzeitig und schlägt bei Schwellwerten Alarm.` },
    { title: "Was hat sich verändert?", text: `Welche Dateien unter <code>/etc</code> wurden in den letzten 24 Stunden geändert? Nach einem Einbruch ist das eine der ersten Fragen.`,
      cmd: "sudo find /etc -type f -mtime -1 2>/dev/null | head -20", check: { cmd: /find\s+\/etc.*-mtime/ },
      explain: `Für die Zukunft: Mit <code>aide</code> oder <code>tripwire</code> legst du eine Prüfsummen-Datenbank an und erkennst jede Änderung an Systemdateien. Das nennt man <b>File Integrity Monitoring</b>.` },
  ],
  outro: `Neu in den Missionen: 🛡️ <b>Ransomware-Alarm</b> (aus dem Backup wiederherstellen) und 🛡️ <b>Brute-Force im Log</b> (Angreifer-IP finden und sperren).`,
},
);

window.DRILLS.push(
/* ---------- Security Stufe 1 ---------- */
{ id: "sx-ports", mode: "ssh", lvl: 1, after: "sec1-recht", q: "Zeige alle <b>lauschenden</b> TCP- und UDP-Ports samt Programm.", a: "sudo ss -tulpn", check: { cmd: /ss\s+-\w*tulpn|ss\s+-\w*t\w*u\w*l\w*p\w*n/, out: /LISTEN/ } },
{ id: "sx-scan", mode: "ssh", lvl: 1, after: "sec1-recht", q: "Scanne die eigene Maschine (<code>localhost</code>) nach offenen Ports.", a: "nmap localhost", check: { cmd: /nmap\s+(localhost|127\.0\.0\.1)/, out: /open|STATE|host/ } },
{ id: "sx-fail", mode: "ssh", lvl: 1, after: "sec4-logs", q: "Zeige die letzten <b>fehlgeschlagenen</b> Anmeldeversuche.", hint: "Ein eigener Befehl – wie <code>last</code>, nur für Fehlversuche.", a: "sudo lastb -n 10", check: { cmd: /lastb/ } },
/* ---------- Security Stufe 2 ---------- */
{ id: "sx-ufw", mode: "ssh", lvl: 2, after: "sec3-firewall", q: "Ist die Firewall aktiv? Zeige den Status.", a: "sudo ufw status verbose", check: { cmd: /ufw\s+status/, out: /Status:/ } },
{ id: "sx-root", mode: "ssh", lvl: 2, after: "sec2-ssh", q: "Prüfe die <b>wirksame</b> SSH-Einstellung für <code>PermitRootLogin</code>.", hint: "<code>sshd -T</code> zeigt die effektive Konfiguration.", a: "sudo sshd -T | grep -i permitrootlogin", check: { cmd: /sshd\s+-T/, out: /permitrootlogin/ } },
{ id: "sx-f2b", mode: "ssh", lvl: 2, after: "sec3-firewall", q: "Zeige den fail2ban-Status der SSH-Überwachung.", a: "sudo fail2ban-client status sshd", check: { cmd: /fail2ban-client\s+status\s+sshd/ } },
/* ---------- Security Stufe 3 ---------- */
{ id: "sx-ssh-ips", mode: "ssh", lvl: 3, after: "sec4-logs", q: "Welche IP-Adressen tauchen im SSH-Log am häufigsten auf? Zeige die Top 5.", hint: "<code>journalctl -u ssh</code>, dann die IPs mit <code>grep -oE</code> herausziehen, <code>sort | uniq -c | sort -rn</code>.", a: "sudo journalctl -u ssh --no-pager | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' | sort | uniq -c | sort -rn | head -5", check: { cmd: /journalctl.*ssh/, out: /\d|^\s*$/ } },
{ id: "sx-listen-ext", mode: "ssh", lvl: 3, after: "sec4-logs", q: "Zeige alle lauschenden Ports, die <b>nicht</b> nur auf localhost gebunden sind (also von außen erreichbar).", hint: "<code>sudo ss -tulpn</code> und mit <code>grep -v</code> die 127.0.0.1- und ::1-Zeilen ausblenden.", a: "sudo ss -tulpn | grep LISTEN | grep -v '127.0.0.1\\|::1'", check: { cmd: /ss\s+-\w.*grep|grep.*LISTEN/, out: /\w|^\s*$/ } },
{ id: "sx-backup", mode: "ssh", lvl: 2, after: "sec6-backup", q: "Sichere <code>/etc/hostname</code> und <code>/etc/hosts</code> in das Archiv <code>/tmp/netz.tar.gz</code>.", a: "sudo tar czf /tmp/netz.tar.gz /etc/hostname /etc/hosts", check: { cmd: /tar\s+c\w*z\w*f\s+\/tmp\/netz\.tar\.gz/ } },
{ id: "sx-tlist", mode: "ssh", lvl: 1, after: "sec6-backup", q: "Zeige den Inhalt eines <code>.tar.gz</code>-Archivs in <code>/var/backups/firma/</code>, ohne es auszupacken.", a: "tar tzf /var/backups/firma/firma-*.tar.gz", check: { cmd: /tar\s+t\w*f/ } },
{ id: "sx-mtime", mode: "ssh", lvl: 3, after: "sec7-vorfall", q: "Finde alle Dateien unter <code>/etc</code>, die in den letzten <b>2 Tagen</b> geändert wurden.", hint: "<code>find</code> mit <code>-mtime</code> – ein Minus heißt „weniger als“.", a: "sudo find /etc -type f -mtime -2", check: { cmd: /find\s+\/etc.*-mtime\s+-2/ } },
{ id: "sx-upgr", mode: "ssh", lvl: 3, after: "sec5-patch", q: "Wie viele Pakete lassen sich aktualisieren? Gib nur die Zahl aus.", hint: "<code>apt list --upgradable</code>, die Kopfzeile abziehen und zählen.", a: "apt list --upgradable 2>/dev/null | grep -c upgradable", check: { cmd: /apt\s+list\s+--upgradable/, out: /^\d+/m } },
);
