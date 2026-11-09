/* Troubleshooting-Missionen für die echte VM.
 * setup/verify laufen als root in der VM (über Multipass, unsichtbar für dich).
 * verify: Exit-Code 0 = geschafft; die Ausgabe wird dir als Rückmeldung angezeigt.
 * Diese Datei wird vom Server (node) und von der App (Browser) geladen.
 */
(function (root) {
const NEED_NGINX = `
export DEBIAN_FRONTEND=noninteractive
systemctl disable --now apache2 >/dev/null 2>&1 || true
command -v nginx >/dev/null || { echo "Installiere nginx …"; apt-get update -qq && apt-get install -y -qq nginx >/dev/null; }
`;
/* MariaDB installieren (falls nötig) und eine kleine Shop-Datenbank anlegen – für die Datenbank-Störfälle */
const NEED_MARIADB = `
export DEBIAN_FRONTEND=noninteractive
command -v mariadb >/dev/null || { echo "Installiere MariaDB …"; apt-get update -qq && apt-get install -y -qq mariadb-server >/dev/null; }
systemctl enable --now mariadb >/dev/null 2>&1
`;
const SHOP_DB = `
mariadb <<'SQL'
DROP DATABASE IF EXISTS shop;
CREATE DATABASE shop;
USE shop;
CREATE TABLE kunden (id INT PRIMARY KEY, name VARCHAR(60), ort VARCHAR(40));
INSERT INTO kunden VALUES (1,'Bäckerei Sonnenschein','Calw'), (2,'Autohaus Wagner','Nagold'), (3,'Praxis Dr. Yılmaz','Pforzheim'),
  (4,'Café Kranz','Calw'), (5,'Schreinerei Holzwurm','Bad Liebenzell'), (6,'Blumen Maier','Hirsau');
CREATE TABLE bestellungen (id INT AUTO_INCREMENT PRIMARY KEY, kunde_id INT, datum DATE, betrag DECIMAL(8,2));
INSERT INTO bestellungen (kunde_id, datum, betrag) VALUES (1,'2026-11-02',120.50), (2,'2026-11-03',980.00), (3,'2026-11-05',45.90),
  (1,'2026-11-06',77.10), (4,'2026-11-07',230.00), (6,'2026-11-08',19.99);
SQL
`;
const MISSIONS = [
{
  id: "m-disk", topic: "linux", level: 1, title: "Die Platte läuft voll",
  story: `Montagmorgen, das Monitoring schlägt Alarm: <i>„Speicherplatz auf fis-lab knapp!“</i> Irgendein Prozess hat über das Wochenende eine riesige Datei abgelegt.`,
  goal: `Finde die große Datei (über 1 GB), die nicht dahin gehört, und lösche sie.`,
  hints: [`Mit <code>df -h</code> siehst du, wie voll die Platte ist.`,
          `<code>sudo du -xh / --max-depth=1 2&gt;/dev/null | sort -h</code> zeigt die größten Ordner. Arbeite dich Ebene für Ebene runter.`,
          `Oder direkt: <code>sudo find / -xdev -size +1G 2&gt;/dev/null</code>`],
  solution: `<code>sudo find / -xdev -size +1G</code> findet <code>/var/lib/.sysdata/core.dump.0</code> → <code>sudo rm /var/lib/.sysdata/core.dump.0</code>`,
  test: `rm /var/lib/.sysdata/core.dump.0`,
  setup: `mkdir -p /var/lib/.sysdata && fallocate -l 1500M /var/lib/.sysdata/core.dump.0 && echo ok`,
  verify: `if [ -e /var/lib/.sysdata/core.dump.0 ]; then echo "❌ Die große Datei ist noch da. ($(df -h / | awk 'NR==2{print $5}') belegt)"; exit 1; fi; echo "✅ Platz geschaffen – $(df -h / | awk 'NR==2{print $5}') belegt."`,
},
{
  id: "m-cpu", topic: "linux", level: 1, title: "Wer frisst die CPU?",
  story: `Kollegen beschweren sich, dass der Server „total langsam“ ist. Ein unbekannter Prozess zieht dauerhaft CPU – und taucht nach einem Neustart wieder auf.`,
  goal: `Finde den Prozess, stoppe ihn <b>und</b> sorge dafür, dass er nach einem Neustart nicht wiederkommt.`,
  hints: [`<code>top</code> oder <code>htop</code> – sortiert nach CPU. Merk dir die PID.`,
          `Zu welchem Dienst gehört die PID? <code>systemctl status PID</code> verrät es.`,
          `Ein Dienst wird mit <code>systemctl stop</code> beendet und mit <code>systemctl disable</code> aus dem Autostart genommen (oder beides: <code>disable --now</code>).`],
  solution: `<code>systemctl status &lt;PID&gt;</code> → <code>netsync.service</code> → <code>sudo systemctl disable --now netsync</code>`,
  test: `systemctl disable --now netsync`,
  setup: `cat > /etc/systemd/system/netsync.service <<'EOF'
[Unit]
Description=Network Sync Helper
[Service]
ExecStart=/bin/sh -c 'while :; do :; done'
CPUQuota=40%
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now netsync >/dev/null 2>&1 && echo ok`,
  verify: `a=$(systemctl is-active netsync 2>/dev/null); e=$(systemctl is-enabled netsync 2>/dev/null)
[ "$a" = active ] && { echo "❌ Der Prozess läuft noch."; exit 1; }
[ "$e" = enabled ] && { echo "⚠️ Gestoppt – aber nach einem Neustart wäre er wieder da (noch im Autostart)."; exit 1; }
echo "✅ Gestoppt und aus dem Autostart entfernt."`,
},
{
  id: "m-hosts", topic: "linux", level: 1, title: "Falsche Adresse",
  story: `Das neue Wiki soll intern unter <code>wiki.lab</code> erreichbar sein und läuft auf diesem Server selbst. Aber <code>ping wiki.lab</code> geht ins Leere …`,
  goal: `Sorge dafür, dass <code>wiki.lab</code> auf diesem Server zu <code>127.0.0.1</code> aufgelöst wird.`,
  hints: [`<code>getent hosts wiki.lab</code> zeigt, wohin der Name gerade aufgelöst wird.`,
          `Lokale Namenseinträge stehen in <code>/etc/hosts</code> – schau mal rein.`,
          `Datei bearbeiten mit <code>sudo nano /etc/hosts</code>. Den falschen Eintrag korrigieren oder löschen.`],
  solution: `In <code>/etc/hosts</code> steht <code>10.255.255.1 wiki.lab</code> → ändern auf <code>127.0.0.1 wiki.lab</code>.`,
  test: `sed -i '/wiki\\.lab/d' /etc/hosts; echo "127.0.0.1 wiki.lab" >> /etc/hosts; sleep 3`,
  setup: `sed -i '/wiki\\.lab/d' /etc/hosts; echo "10.255.255.1   wiki.lab   # alter Server" >> /etc/hosts; echo ok`,
  verify: `r=$(getent hosts wiki.lab | awk '{print $1}' | head -1); [ "$r" = "127.0.0.1" ] && { echo "✅ wiki.lab → 127.0.0.1"; exit 0; }; echo "❌ wiki.lab wird zu '\${r:-nichts}' aufgelöst."; exit 1`,
},
{
  id: "m-user", topic: "linux", level: 2, title: "Neue Kollegin im Vertrieb",
  story: `Ticket von der Personalabteilung: <i>„Lisa Berger fängt morgen im Vertrieb an. Bitte Zugang einrichten. Sie soll auch Admin-Rechte bekommen, und der Vertrieb braucht einen gemeinsamen Ordner.“</i>`,
  goal: `<ul><li>Benutzer <code>lisa</code> mit Home-Verzeichnis und Bash als Shell</li><li>Gruppe <code>vertrieb</code>, lisa ist Mitglied</li><li>lisa darf <code>sudo</code></li><li>Ordner <code>/srv/vertrieb</code>: gehört <code>root:vertrieb</code>, Rechte <code>2770</code></li></ul>`,
  hints: [`<code>sudo adduser lisa</code> legt Benutzer samt Home an.`,
          `<code>groupadd</code>, dann <code>usermod -aG gruppe benutzer</code> – an <b>beide</b> Gruppen denken.`,
          `Ordner: <code>mkdir</code>, <code>chown root:vertrieb</code>, <code>chmod 2770</code>. Prüfen mit <code>ls -ld</code>.`],
  solution: `<code>sudo adduser lisa; sudo groupadd vertrieb; sudo usermod -aG vertrieb,sudo lisa; sudo mkdir -p /srv/vertrieb; sudo chown root:vertrieb /srv/vertrieb; sudo chmod 2770 /srv/vertrieb</code>`,
  setup: `echo ok`,
  verify: `f=0
id lisa >/dev/null 2>&1 || { echo "❌ Benutzer lisa fehlt."; exit 1; }
[ -d /home/lisa ] || { echo "❌ lisa hat kein Home-Verzeichnis."; f=1; }
[ "$(getent passwd lisa | cut -d: -f7)" = /bin/bash ] || { echo "❌ lisa hat nicht /bin/bash als Shell."; f=1; }
id -nG lisa | grep -qw vertrieb || { echo "❌ lisa ist nicht in der Gruppe vertrieb."; f=1; }
id -nG lisa | grep -qw sudo || { echo "❌ lisa darf noch kein sudo."; f=1; }
[ "$(stat -c '%U:%G %a' /srv/vertrieb 2>/dev/null)" = "root:vertrieb 2770" ] || { echo "❌ /srv/vertrieb: $(stat -c '%U:%G %a' /srv/vertrieb 2>/dev/null || echo fehlt) (soll: root:vertrieb 2770)"; f=1; }
[ $f = 0 ] && echo "✅ Alles eingerichtet – Lisa kann morgen loslegen."; exit $f`,
},
{
  id: "m-nginx", topic: "linux", level: 2, title: "Die Webseite ist down",
  story: `Nach einer „kleinen Änderung“ eines Kollegen an der Webserver-Konfiguration ist die Firmenseite nicht mehr erreichbar. Er ist jetzt im Urlaub.`,
  goal: `Bring nginx wieder zum Laufen, sodass <code>curl http://localhost</code> eine Seite liefert.`,
  hints: [`<code>systemctl status nginx</code> und <code>journalctl -u nginx -n 30</code> – was steht da?`,
          `<code>sudo nginx -t</code> prüft die Konfiguration und nennt Datei + Zeile des Fehlers.`,
          `Nach dem Reparieren: <code>sudo systemctl start nginx</code> (oder restart).`],
  solution: `<code>sudo nginx -t</code> → In <code>/etc/nginx/sites-enabled/default</code> fehlt ein <code>;</code> hinter <code>listen 80 default_server</code>. Korrigieren, dann <code>sudo systemctl restart nginx</code>.`,
  test: `sed -i '0,/listen 80 default_server$/s//listen 80 default_server;/' /etc/nginx/sites-available/default && nginx -t && systemctl restart nginx`,
  setup: NEED_NGINX + `
f=/etc/nginx/sites-available/default
[ -f $f.lab-orig ] || cp $f $f.lab-orig
cp $f.lab-orig $f
ln -sf $f /etc/nginx/sites-enabled/default
sed -i '0,/listen 80 default_server;/s//listen 80 default_server/' $f
systemctl stop nginx; echo ok`,
  verify: `nginx -t >/dev/null 2>&1 || { echo "❌ Die Konfiguration hat noch einen Fehler:"; nginx -t 2>&1 | tail -2; exit 1; }
systemctl is-active --quiet nginx || { echo "❌ Konfiguration ok, aber nginx läuft nicht."; exit 1; }
curl -fs -o /dev/null http://localhost || { echo "❌ nginx läuft, aber http://localhost antwortet nicht richtig."; exit 1; }
echo "✅ Die Seite ist wieder online."`,
},
{
  id: "m-ufw", topic: "sec", level: 2, title: "Von außen nicht erreichbar",
  story: `Auf dem Server selbst funktioniert die Webseite (<code>curl localhost</code> klappt) – aber von deinem Windows-PC aus lädt <code>http://{{IP}}</code> ewig.`,
  goal: `Mach die Webseite von außen erreichbar, <b>ohne</b> die Firewall abzuschalten – SSH muss natürlich auch weiter gehen.`,
  hints: [`Läuft der Webserver? <code>sudo ss -tlnp | grep :80</code>`,
          `Was sagt die Firewall? <code>sudo ufw status numbered</code>`,
          `Eine DENY-Regel muss weg (<code>sudo ufw delete NUMMER</code>) und eine ALLOW-Regel her (<code>sudo ufw allow 80/tcp</code>).`],
  solution: `<code>sudo ufw status numbered</code> → DENY-Regel für 80 löschen, dann <code>sudo ufw allow 80/tcp</code>.`,
  test: `ufw delete deny 80/tcp && ufw allow 80/tcp`,
  setup: NEED_NGINX + `
systemctl enable --now nginx >/dev/null 2>&1
ufw allow OpenSSH >/dev/null; ufw delete allow 80/tcp >/dev/null 2>&1; ufw delete allow http >/dev/null 2>&1
ufw deny 80/tcp >/dev/null; ufw --force enable >/dev/null; echo ok`,
  verify: `ufw status | grep -q "Status: active" || { echo "❌ Die Firewall ist aus – das ist keine Lösung. Wieder einschalten: sudo ufw enable"; exit 1; }
ufw status | grep -qE "^(22|OpenSSH)\\b.*ALLOW" || { echo "❌ SSH ist nicht mehr erlaubt!"; exit 1; }
ufw status | grep -E "^80(/tcp)?\\b" | grep -q DENY && { echo "❌ Port 80 wird noch blockiert (DENY)."; exit 1; }
ufw status | grep -qE "^(80(/tcp)?|Nginx (HTTP|Full)|WWW|http)\\b.*ALLOW" || { echo "❌ Port 80 ist nicht freigegeben."; exit 1; }
echo "✅ Erreichbar – teste im Windows-Browser: http://$(hostname -I | awk '{print $1}')"`,
},
{
  id: "m-cron", topic: "linux", level: 2, title: "Der Cronjob tut nichts",
  story: `Jede Minute soll ein Aufräum-Skript laufen und in <code>/var/log/aufraeumen.log</code> protokollieren. Die Logdatei bleibt aber leer. Laut Kollegen „ist alles korrekt eingetragen“.`,
  goal: `Finde heraus, warum der Job nicht läuft, und repariere es, sodass Einträge im Log erscheinen.`,
  hints: [`Wo stehen System-Cronjobs? Schau in <code>/etc/cron.d/</code>.`,
          `Führ das Skript mal selbst so aus, wie cron es aufruft. Was passiert? <code>ls -l</code> auf das Skript …`,
          `Cron-Fehler im Log: <code>journalctl -u cron -n 20</code>. Fehlendes Ausführungsrecht → <code>chmod +x</code>.`],
  solution: `<code>/usr/local/bin/aufraeumen.sh</code> ist nicht ausführbar → <code>sudo chmod +x /usr/local/bin/aufraeumen.sh</code>, dann eine Minute warten.`,
  test: `chmod +x /usr/local/bin/aufraeumen.sh; sleep 70`,
  setup: `cat > /usr/local/bin/aufraeumen.sh <<'EOF'
#!/bin/bash
find /tmp -name "*.tmp" -mmin +60 -delete
echo "$(date '+%F %T') OK - aufgeraeumt" >> /var/log/aufraeumen.log
EOF
chmod 644 /usr/local/bin/aufraeumen.sh
rm -f /var/log/aufraeumen.log
echo "* * * * * root /usr/local/bin/aufraeumen.sh" > /etc/cron.d/aufraeumen
echo ok`,
  verify: `[ -x /usr/local/bin/aufraeumen.sh ] || { echo "❌ Das Skript kann so nicht ausgeführt werden."; exit 1; }
grep -q OK /var/log/aufraeumen.log 2>/dev/null || { echo "⏳ Skript sieht gut aus – warte bis zur nächsten vollen Minute und prüf nochmal."; exit 1; }
echo "✅ Der Job läuft:"; tail -2 /var/log/aufraeumen.log`,
},
{
  id: "m-ssh", topic: "linux", level: 3, title: "SSH-Schlüssel wird abgelehnt",
  story: `Der Backup-Server meldet sich per SSH-Schlüssel als Benutzer <code>sicherung</code> an. Seit gestern fragt SSH plötzlich nach einem Passwort – der Schlüssel wird ignoriert. Der Schlüssel selbst ist richtig hinterlegt.`,
  goal: `Repariere es so, dass der Schlüssel-Login wieder funktioniert. Test: <code>sudo ssh -i /root/backup_key -o BatchMode=yes sicherung@localhost whoami</code>`,
  hints: [`Was sagt der SSH-Server? <code>sudo journalctl -u ssh -n 20</code> – achte auf „bad ownership or modes“.`,
          `SSH ist pingelig mit Rechten: Home und <code>~/.ssh</code> dürfen nicht für andere beschreibbar sein.`,
          `Richtig ist: <code>~</code> max. 755, <code>~/.ssh</code> 700, <code>authorized_keys</code> 600 – alles im Besitz von sicherung.`],
  solution: `<code>sudo chmod 755 /home/sicherung; sudo chmod 700 /home/sicherung/.ssh; sudo chmod 600 /home/sicherung/.ssh/authorized_keys; sudo chown -R sicherung:sicherung /home/sicherung/.ssh</code>`,
  setup: `id sicherung >/dev/null 2>&1 || useradd -m -s /bin/bash sicherung
mkdir -p /home/sicherung/.ssh
rm -f /root/backup_key /root/backup_key.pub; ssh-keygen -q -t ed25519 -N '' -f /root/backup_key
cp /root/backup_key.pub /home/sicherung/.ssh/authorized_keys
chown -R sicherung:sicherung /home/sicherung
chmod 777 /home/sicherung/.ssh; chmod 666 /home/sicherung/.ssh/authorized_keys; chmod 777 /home/sicherung
echo ok`,
  verify: `out=$(ssh -n -i /root/backup_key -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR sicherung@localhost whoami 2>&1)
[ "$out" = sicherung ] && { echo "✅ Schlüssel-Login klappt wieder."; exit 0; }
echo "❌ Login per Schlüssel geht noch nicht: $out"; echo "Rechte: $(stat -c '%n %a %U' /home/sicherung /home/sicherung/.ssh /home/sicherung/.ssh/authorized_keys | tr '\\n' ' ')"; exit 1`,
},
{
  id: "m-502", topic: "linux", level: 3, title: "502 Bad Gateway",
  story: `Die PHP-Anwendung (LEMP-Stack) zeigt nur noch <b>502 Bad Gateway</b>. nginx läuft, PHP ist installiert. Nach dem letzten PHP-Update ging nichts mehr.`,
  goal: `Bring die Seite <code>http://localhost/status.php</code> wieder zum Laufen – sie soll „PHP läuft“ ausgeben.`,
  hints: [`502 heißt: nginx erreicht das Backend (PHP-FPM) nicht. Was steht in <code>/var/log/nginx/error.log</code>?`,
          `Läuft PHP-FPM? Welchen Socket stellt es bereit? <code>ls /run/php/</code>`,
          `Vergleiche den Socket mit <code>fastcgi_pass</code> in <code>/etc/nginx/sites-available/status</code>. Danach <code>nginx -t</code> und reload.`],
  solution: `In der Site-Konfiguration steht <code>php7.4-fpm.sock</code> – installiert ist eine neuere Version. <code>fastcgi_pass unix:/run/php/php-fpm.sock;</code> eintragen, <code>sudo nginx -t &amp;&amp; sudo systemctl reload nginx</code>.`,
  test: `sed -i 's#php7.4-fpm.sock#php-fpm.sock#' /etc/nginx/sites-available/status && nginx -t && systemctl reload nginx && sleep 1`,
  setup: NEED_NGINX + `
command -v php-fpm8.3 >/dev/null || ls /run/php/*.sock >/dev/null 2>&1 || { echo "Installiere PHP-FPM …"; apt-get install -y -qq php-fpm >/dev/null; }
mkdir -p /var/www/status && echo '<?php echo "PHP läuft – Version " . PHP_VERSION;' > /var/www/status/status.php
cat > /etc/nginx/sites-available/status <<'EOF'
server {
    listen 80 default_server;
    root /var/www/status;
    index index.html status.php;
    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php7.4-fpm.sock;
    }
}
EOF
rm -f /etc/nginx/sites-enabled/*; ln -sf /etc/nginx/sites-available/status /etc/nginx/sites-enabled/status
systemctl enable --now nginx >/dev/null 2>&1; systemctl reload nginx; echo ok`,
  verify: `r=$(curl -s http://localhost/status.php)
echo "$r" | grep -q "PHP läuft" && { echo "✅ $r"; exit 0; }
echo "❌ Antwort: $(echo "$r" | grep -o '<title>[^<]*' | sed 's/<title>//' | head -1)"; exit 1`,
},
{
  id: "m-docker", topic: "devops", level: 3, title: "Nach dem Neustart ist der Dienst weg",
  story: `Der Status-Monitor läuft als Docker-Container <code>status</code>. Nach jedem Neustart des Servers ist er weg und muss von Hand gestartet werden.`,
  goal: `Sorge dafür, dass der Container <code>status</code> automatisch wieder startet (auch nach einem Server-Neustart) – ohne ihn neu zu erstellen.`,
  hints: [`<code>docker ps -a</code> – läuft er gerade?`,
          `Welche Neustart-Richtlinie hat er? <code>docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' status</code>`,
          `Ändern ohne Neuerstellen: <code>docker update --restart …</code>`],
  solution: `<code>sudo docker update --restart unless-stopped status &amp;&amp; sudo docker start status</code>`,
  setup: `export DEBIAN_FRONTEND=noninteractive
command -v docker >/dev/null || { echo "Installiere Docker (dauert etwas) …"; apt-get update -qq && apt-get install -y -qq docker.io >/dev/null; }
docker rm -f status >/dev/null 2>&1; docker run -d --name status -p 8090:80 nginx:alpine >/dev/null && docker stop status >/dev/null && echo ok`,
  verify: `p=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' status 2>/dev/null) || { echo "❌ Container status gibt es nicht mehr – bitte nicht löschen. Mission neu starten."; exit 1; }
case "$p" in always|unless-stopped) ;; *) echo "❌ Neustart-Richtlinie ist '\${p:-no}'."; exit 1;; esac
[ "$(docker inspect -f '{{.State.Running}}' status)" = true ] || { echo "⚠️ Richtlinie passt ($p) – aber der Container läuft gerade nicht."; exit 1; }
echo "✅ Richtlinie '$p' gesetzt und Container läuft."`,
},
/* ---------- Security-Missionen (track: linux) – Blue Team: Einbruchsspuren finden und beseitigen.
 * Das Setup spielt als root eine HARMLOSE Simulation ein (Benutzer, Dienst, Cronjob) – kein echter Schadcode.
 * Du reagierst als Verteidiger in deiner eigenen VM. ---------- */
{
  id: "msec-user", topic: "sec", level: 2, title: "🛡️ Das fremde Konto",
  story: `Bei einem Sicherheits-Audit fällt auf der VM ein Benutzerkonto auf, das niemand aus dem Team angelegt hat – und es hat sogar <b>sudo</b>-Rechte. So etwas legen Angreifer gern als Hintertür an.`,
  goal: `Finde das verdächtige Konto und entferne es <b>vollständig</b> (mitsamt Home-Verzeichnis und sudo-Rechten). Das reguläre Konto <code>ubuntu</code> bleibt natürlich bestehen.`,
  hints: [`Normale Benutzer haben eine UID ab 1000: <code>getent passwd | awk -F: '$3>=1000 {print $1, $3}'</code>`,
          `Wer darf sudo? <code>getent group sudo</code> – ein Name, der da nicht hingehört, ist dein Kandidat.`,
          `Konto samt Home entfernen: <code>sudo deluser --remove-home NAME</code> (nimmt es auch aus allen Gruppen).`],
  solution: `<code>sudo deluser --remove-home svc-update</code>`,
  setup: `id svc-update >/dev/null 2>&1 || useradd -m -s /bin/bash -c "System Update Service" svc-update
usermod -aG sudo svc-update
echo ok`,
  verify: `if id svc-update >/dev/null 2>&1; then echo "❌ Das Konto 'svc-update' existiert noch. Entferne es vollständig."; exit 1; fi
if ! id ubuntu >/dev/null 2>&1; then echo "❌ Das reguläre Konto 'ubuntu' fehlt – du hast das falsche gelöscht! Mission neu starten."; exit 1; fi
if getent group sudo | grep -qw svc-update; then echo "❌ 'svc-update' steht noch in der sudo-Gruppe."; exit 1; fi
if [ -d /home/svc-update ]; then echo "❌ Das Home-Verzeichnis /home/svc-update ist noch da."; exit 1; fi
echo "✅ Das eingeschleuste Konto ist vollständig entfernt, 'ubuntu' ist unversehrt."`,
},
{
  id: "msec-port", topic: "sec", level: 2, title: "🛡️ Der heimliche Dienst",
  story: `Dein Portscan aus Teil 5 zeigt einen offenen Port <b>4444</b>, den hier niemand kennt. Etwas lauscht da und würde auch nach einem Neustart wiederkommen.`,
  goal: `Finde heraus, welcher Dienst auf dem unerwarteten Port lauscht, stoppe ihn und sorge dafür, dass er beim nächsten Start <b>nicht</b> wiederkommt.`,
  hints: [`Was lauscht auf 4444? <code>sudo ss -tulpn | grep 4444</code> – notiere die PID.`,
          `Welcher Dienst steckt dahinter? <code>sudo systemctl status &lt;PID&gt;</code> nennt die Unit.`,
          `Stoppen und dauerhaft abschalten in einem: <code>sudo systemctl disable --now &lt;dienst&gt;</code>.`],
  solution: `<code>sudo systemctl disable --now sys-helper</code>`,
  setup: `cat > /etc/systemd/system/sys-helper.service << 'EOF'
[Unit]
Description=System Helper
[Service]
ExecStart=/usr/bin/python3 -m http.server 4444 --bind 0.0.0.0
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now sys-helper
sleep 1
echo ok`,
  verify: `if ss -tulpn 2>/dev/null | grep -q ':4444'; then echo "❌ Auf Port 4444 lauscht noch etwas. Stoppe den Dienst."; exit 1; fi
if systemctl is-enabled sys-helper >/dev/null 2>&1; then echo "❌ Der Dienst 'sys-helper' ist noch aktiviert und käme beim Neustart wieder. Nutze disable."; exit 1; fi
echo "✅ Port 4444 ist zu und der heimliche Dienst startet nicht mehr."`,
},
{
  id: "msec-cron", topic: "sec", level: 3, title: "🛡️ Der manipulierte Cronjob",
  story: `In den geplanten Aufgaben steckt ein Eintrag, der jede Minute im Hintergrund etwas ausführt und eine versteckte Datei füttert – ein typischer Weg, wie sich Angreifer dauerhaft einnisten.`,
  goal: `Finde den verdächtigen Cronjob, entferne ihn, und beseitige auch die versteckte Datei, die er angelegt hat.`,
  hints: [`System-Cronjobs liegen nicht nur in <code>crontab -l</code>, sondern auch in <code>/etc/cron.d/</code> und <code>/etc/crontab</code>: <code>ls -la /etc/cron.d</code>`,
          `Sieh dir die verdächtige Datei an (<code>cat</code>): Welchen Pfad schreibt der Job? Versteckte Dateien beginnen mit einem Punkt.`,
          `Beides löschen: <code>sudo rm /etc/cron.d/NAME</code> und die angelegte Datei.`],
  solution: `<code>sudo rm /etc/cron.d/apache-maintenance /tmp/.sys-cache</code>`,
  setup: `cat > /etc/cron.d/apache-maintenance << 'EOF'
* * * * * root echo "$(date) ping" >> /tmp/.sys-cache 2>/dev/null
EOF
echo "vorhanden" > /tmp/.sys-cache
echo ok`,
  verify: `if [ -f /etc/cron.d/apache-maintenance ]; then echo "❌ /etc/cron.d/apache-maintenance existiert noch."; exit 1; fi
if grep -rqs 'sys-cache' /etc/cron.d /etc/crontab /var/spool/cron 2>/dev/null; then echo "❌ Es gibt noch einen Cron-Eintrag, der auf die Datei verweist."; exit 1; fi
if [ -f /tmp/.sys-cache ]; then echo "❌ Die versteckte Datei /tmp/.sys-cache ist noch da."; exit 1; fi
echo "✅ Cronjob und seine versteckte Datei sind entfernt."`,
},
{
  id: "msec-harden", topic: "sec", level: 3, title: "🛡️ Server abriegeln",
  story: `Nach dem Vorfall soll die VM so dicht sein, dass nur noch das Nötigste erreichbar ist. Aktuell steht ein Port offen, der nicht gebraucht wird, und die Root-Anmeldung per SSH ist erlaubt.`,
  goal: `Sorge dafür, dass die Firewall aktiv ist und <b>nur SSH (Port 22)</b> von außen erreichbar bleibt, der unnötige Port <b>8080</b> geschlossen ist und die <b>Root-Anmeldung per SSH verboten</b> ist (<code>PermitRootLogin no</code>). SSH muss erreichbar bleiben.`,
  hints: [`Was ist offen? <code>sudo ufw status</code>. Eine Regel löschst du mit <code>sudo ufw delete allow 8080/tcp</code>.`,
          `Die Root-Erlaubnis steht in einer Datei unter <code>/etc/ssh/sshd_config.d/</code>. Setze dort <code>PermitRootLogin no</code> und lade SSH neu: <code>sudo systemctl reload ssh</code>.`,
          `Prüfen kannst du mit <code>sudo ufw status</code> und <code>sudo sshd -T | grep -i permitrootlogin</code>.`],
  solution: `<code>sudo ufw delete allow 8080/tcp; echo 'PermitRootLogin no' | sudo tee /etc/ssh/sshd_config.d/99-decoy.conf; sudo systemctl reload ssh</code>`,
  setup: `export DEBIAN_FRONTEND=noninteractive
command -v ufw >/dev/null || apt-get install -y -qq ufw >/dev/null 2>&1
ufw allow OpenSSH >/dev/null 2>&1
ufw allow 8080/tcp >/dev/null 2>&1
ufw --force enable >/dev/null 2>&1
printf 'PermitRootLogin yes\\n' > /etc/ssh/sshd_config.d/99-decoy.conf
systemctl reload ssh
echo ok`,
  verify: `ufw status | grep -qi "Status: active" || { echo "❌ Die Firewall ist nicht aktiv (sudo ufw enable)."; exit 1; }
ufw status | grep -Eqw '22|OpenSSH' || { echo "❌ SSH (22) ist nicht erlaubt – darüber verbindet sich rootshell. Erst SSH erlauben!"; exit 1; }
if ufw status | grep -qw 8080; then echo "❌ Port 8080 ist noch offen. Lösche die Regel."; exit 1; fi
rl=$(sshd -T 2>/dev/null | awk '/^permitrootlogin/{print $2}')
[ "$rl" = no ] || { echo "❌ Root-Anmeldung per SSH ist noch erlaubt (permitrootlogin \${rl:-unbekannt}). Setze PermitRootLogin no."; exit 1; }
echo "✅ Abgeriegelt: Firewall aktiv, nur SSH offen, Root-Login verboten."`,
},
{
  id: "msec-restore", topic: "sec", level: 2, title: "🛡️ Ransomware-Alarm",
  story: `Montagmorgen: Die Firmen-Webseite unter <code>/srv/webseite</code> ist unbrauchbar. Alle Seiten tragen plötzlich die Endung <code>.locked</code>, daneben liegt eine Erpresser-Notiz. (Keine Sorge: Das ist eine harmlose Übung, nichts wurde wirklich verschlüsselt.) Zum Glück gibt es ein nächtliches Backup.`,
  goal: `Stelle die Webseite aus dem Backup unter <code>/var/backups/webseite/</code> wieder her: Die Originaldateien müssen unverändert zurück sein, die <code>.locked</code>-Dateien und die Notiz verschwinden.`,
  hints: [`Was liegt im Backup? <code>tar tzf /var/backups/webseite/*.tar.gz</code>`,
          `Das Archiv enthält den Ordner <code>webseite/</code>. Auspacken mit <code>-C /srv</code> legt ihn wieder unter <code>/srv/</code> ab.`,
          `Aufräumen: <code>sudo rm /srv/webseite/*.locked /srv/webseite/LIES-MICH.txt</code>`],
  solution: `<code>sudo rm -f /srv/webseite/*.locked /srv/webseite/LIES-MICH.txt &amp;&amp; sudo tar xzf /var/backups/webseite/webseite-2026-11-01.tar.gz -C /srv</code>`,
  setup: `mkdir -p /srv/webseite /var/backups/webseite /var/lib/rootshell
rm -f /srv/webseite/*
cat > /srv/webseite/index.html << 'EOF'
<!doctype html><title>Muster GmbH</title><h1>Willkommen bei der Muster GmbH</h1><p>Ihr IT-Partner in der Region.</p>
EOF
echo '<h1>Impressum</h1><p>Muster GmbH, Musterstraße 1</p>' > /srv/webseite/impressum.html
tar czf /var/backups/webseite/webseite-2026-11-01.tar.gz -C /srv webseite
(cd /srv/webseite && sha256sum index.html impressum.html) > /var/lib/rootshell/webseite.sha256
for f in /srv/webseite/*.html; do echo "Datei gesperrt (rootshell-Uebung)" > "$f.locked"; rm -f "$f"; done
echo "Alle Ihre Dateien wurden gesperrt. (Dies ist eine harmlose Uebung von rootshell.)" > /srv/webseite/LIES-MICH.txt
echo ok`,
  verify: `cd /srv/webseite 2>/dev/null || { echo "❌ /srv/webseite fehlt ganz."; exit 1; }
if ls /srv/webseite/*.locked >/dev/null 2>&1; then echo "❌ Es liegen noch .locked-Dateien herum."; exit 1; fi
if [ -e /srv/webseite/LIES-MICH.txt ]; then echo "❌ Die Erpresser-Notiz LIES-MICH.txt ist noch da."; exit 1; fi
sha256sum -c --quiet /var/lib/rootshell/webseite.sha256 >/dev/null 2>&1 || { echo "❌ index.html oder impressum.html fehlen oder sind nicht im Originalzustand."; exit 1; }
echo "✅ Webseite aus dem Backup wiederhergestellt – Prüfsummen stimmen."`,
},
{
  id: "msec-log", topic: "sec", level: 3, title: "🛡️ Brute-Force im Log",
  story: `Das Monitoring meldet eine Flut fehlgeschlagener SSH-Anmeldungen. Irgendwer probiert seit einer Weile Passwörter durch. Die Spuren stehen im Auth-Log.`,
  goal: `Finde die IP-Adresse mit den <b>meisten</b> Fehlversuchen und sperre sie mit <code>ufw</code> für <b>alle</b> Ports. Achtung: Die Sperre muss <b>vor</b> der bestehenden SSH-Freigabe greifen. Legitime Anmeldungen dürfen nicht gesperrt werden.`,
  hints: [`Die Meldungen stehen in <code>/var/log/auth.log</code> (oder <code>sudo journalctl -t sshd</code>). Suche nach <code>Failed password</code>.`,
          `Zählen wie im Mini-SIEM: <code>sudo grep 'Failed password' /var/log/auth.log | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -rn</code>`,
          `ufw nimmt die <b>erste</b> passende Regel. <code>sudo ufw status numbered</code> zeigt die Reihenfolge, <code>sudo ufw insert 1 deny from IP</code> setzt die Sperre ganz nach oben.`],
  solution: `<code>sudo ufw insert 1 deny from 203.0.113.55</code>`,
  setup: `export DEBIAN_FRONTEND=noninteractive
command -v ufw >/dev/null || apt-get install -y -qq ufw >/dev/null
ufw delete deny from 203.0.113.55 >/dev/null 2>&1 || true
ufw allow OpenSSH >/dev/null
for i in $(seq 1 40); do logger -p auth.info -t sshd "Failed password for invalid user admin from 203.0.113.55 port $((40000+i)) ssh2"; done
for i in 1 2 3; do logger -p auth.info -t sshd "Failed password for ubuntu from 198.51.100.23 port 5$((i))222 ssh2"; done
logger -p auth.info -t sshd "Accepted publickey for ubuntu from 192.0.2.10 port 50122 ssh2"
sleep 1
echo ok`,
  verify: `RULES=$(ufw show added 2>/dev/null)
echo "$RULES" | grep -Eq 'deny( in)? from 192\\.0\\.2\\.10' && { echo "❌ 192.0.2.10 hat sich erfolgreich angemeldet (Accepted) – das ist ein Kollege, nicht der Angreifer."; exit 1; }
L=$(echo "$RULES" | grep -nE 'deny( in)? from 203\\.0\\.113\\.55( |$)' | head -1 | cut -d: -f1)
[ -n "$L" ] || { echo "❌ Die IP mit den meisten Fehlversuchen ist noch nicht gesperrt."; exit 1; }
echo "$RULES" | grep -E 'deny( in)? from 203\\.0\\.113\\.55' | grep -Eq ' port | to ' && { echo "❌ Die Sperre gilt nur für einen Port. Sperre die Adresse komplett."; exit 1; }
A=$(echo "$RULES" | grep -nE 'allow .*(OpenSSH|22)' | head -1 | cut -d: -f1)
if [ -n "$A" ] && [ "$A" -lt "$L" ]; then echo "❌ Die Sperre steht HINTER 'allow OpenSSH' – ufw nimmt die erste passende Regel, der Angreifer käme also weiter an SSH. Nutze ufw insert 1 …"; exit 1; fi
echo "✅ Angreifer 203.0.113.55 gesperrt – und zwar vor der SSH-Freigabe."`,
},
/* ---------- Netzwerk-Missionen (Teil 6) ---------- */
{
  id: "mnet-dns", topic: "net", level: 1, title: "🌐 Falsche Adresse",
  story: `Ein Kollege beschwert sich: Auf dem Server liefert <code>curl http://example.com</code> nur einen Timeout. Auf seinem Laptop geht die Seite. <code>dig example.com</code> auf dem Server zeigt aber die richtige Adresse … seltsam.`,
  goal: `Finde heraus, warum der Server <code>example.com</code> falsch auflöst, und behebe es, ohne die übrigen Einträge zu beschädigen.`,
  hints: [`Vergleiche: <code>dig +short example.com</code> fragt nur DNS, <code>getent hosts example.com</code> löst auf wie jedes Programm.`,
          `Bevor DNS gefragt wird, schaut Linux in eine lokale Datei.`,
          `In <code>/etc/hosts</code> steht ein falscher Eintrag. Löschen z. B. mit <code>sudo nano /etc/hosts</code>.`],
  solution: `<code>sudo sed -i '/203.0.113.80/d' /etc/hosts</code>`,
  setup: `grep -q '203.0.113.80' /etc/hosts || echo "203.0.113.80 example.com www.example.com   # lokaler Cache" >> /etc/hosts
echo ok`,
  verify: `grep -qE '^127\\.0\\.0\\.1\\s+localhost' /etc/hosts || { echo "❌ Die Zeile '127.0.0.1 localhost' fehlt in /etc/hosts – da wurde zu viel gelöscht."; exit 1; }
grep -q '203\\.0\\.113\\.80' /etc/hosts && { echo "❌ In /etc/hosts steht noch ein Eintrag mit 203.0.113.80."; exit 1; }
resolvectl flush-caches 2>/dev/null; sleep 2
if getent hosts example.com | grep -q '203.0.113.80'; then echo "❌ example.com wird immer noch zu 203.0.113.80 aufgelöst."; exit 1; fi
echo "✅ example.com wird wieder richtig aufgelöst ($(getent hosts example.com | awk '{print $1; exit}'))."`,
},
{
  id: "mnet-bind", topic: "net", level: 2, title: "🌐 Intranet nur für sich selbst",
  story: `Das neue Intranet läuft auf dem Server als Dienst <code>intranet</code>. Auf dem Server selbst klappt <code>curl localhost:8088</code> – aber kein Kollege erreicht <code>http://{{IP}}:8088</code>.`,
  goal: `Sorge dafür, dass das Intranet über die Netzwerkadresse des Servers erreichbar ist – dauerhaft, also auch nach einem Neustart des Dienstes.`,
  hints: [`Auf welcher Adresse lauscht der Dienst? <code>sudo ss -tlnp | grep 8088</code>`,
          `<code>127.0.0.1</code> ist nur von innen erreichbar. Wie der Dienst gestartet wird, steht in seiner Unit: <code>systemctl cat intranet</code>`,
          `Unit bearbeiten mit <code>sudo systemctl edit --full intranet</code> (oder die Datei unter <code>/etc/systemd/system/</code>), danach <code>sudo systemctl daemon-reload</code> und <code>sudo systemctl restart intranet</code>.`],
  solution: `<code>sudo sed -i 's/--bind 127.0.0.1/--bind 0.0.0.0/' /etc/systemd/system/intranet.service &amp;&amp; sudo systemctl daemon-reload &amp;&amp; sudo systemctl restart intranet</code>`,
  setup: `mkdir -p /srv/intranet && echo '<h1>Intranet der Muster GmbH</h1>' > /srv/intranet/index.html
cat > /etc/systemd/system/intranet.service << 'EOF'
[Unit]
Description=Firmen-Intranet
After=network.target
[Service]
ExecStart=/usr/bin/python3 -m http.server 8088 --bind 127.0.0.1 --directory /srv/intranet
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable intranet >/dev/null 2>&1
systemctl restart intranet
sleep 1
echo ok`,
  verify: `systemctl is-active --quiet intranet || { echo "❌ Der Dienst 'intranet' läuft nicht."; exit 1; }
systemctl is-enabled --quiet intranet || { echo "❌ Der Dienst 'intranet' startet nicht automatisch (enable)."; exit 1; }
IP=$(hostname -I | awk '{print $1}')
curl -s --max-time 3 "http://$IP:8088/" | grep -q Intranet || { echo "❌ Unter http://$IP:8088 antwortet das Intranet noch nicht."; exit 1; }
grep -q -- '--bind 127.0.0.1' /etc/systemd/system/intranet.service && { echo "❌ Läuft gerade, aber die Unit-Datei bindet noch an 127.0.0.1 – beim nächsten Start wäre es wieder kaputt."; exit 1; }
echo "✅ Das Intranet ist unter http://$IP:8088 für alle erreichbar."`,
},
{
  id: "mnet-gw", topic: "net", level: 2, title: "🌐 Kein Weg nach draußen",
  story: `Seit einer Wartung schlagen auf dem Server alle Updates fehl: <code>ping 1.1.1.1</code> bekommt keine Antwort. Das lokale Netz funktioniert, du bist ja per SSH verbunden. Der Netzplan liegt unter <code>/etc/netzplan.txt</code>.`,
  goal: `Finde den Fehler in der Netzwerkkonfiguration und stelle den Weg ins Internet wieder her.`,
  hints: [`Arbeite die Schichten ab: Schnittstelle, Adresse, <b>Gateway</b>, Internet. <code>ip route</code> zeigt, wohin Pakete nach draußen gehen.`,
          `Vergleiche das Gateway in <code>ip route</code> mit dem im Netzplan. Antwortet es überhaupt? <code>ping -c 2 ADRESSE</code>`,
          `Falsche Standardroute ersetzen: <code>sudo ip route replace default via RICHTIGE-ADRESSE</code>`],
  solution: `<code>sudo ip route replace default via $(awk '/Gateway/ {print $2}' /etc/netzplan.txt)</code><br><small>Die Route im laufenden System ist nicht dauerhaft: Nach einem Neustart kommt das richtige Gateway wieder per DHCP. Bei fester IP stünde es in <code>/etc/netplan/</code>.</small>`,
  test: `ip route replace default via $(awk '/Gateway/ {print $2}' /etc/netzplan.txt)`,
  setup: `mkdir -p /var/lib/rootshell
DEV=$(ip route show default | awk '{print $5; exit}')
GW=$(grep -h '^ROUTER=' /run/systemd/netif/leases/* 2>/dev/null | head -1 | cut -d= -f2 | cut -d' ' -f1)
[ -n "$GW" ] || GW=$(ip route show default | awk '{print $3; exit}')
[ -n "$DEV" ] || DEV=eth0
echo "$GW $DEV" > /var/lib/rootshell/gw
WRONG="\${GW%.*}.254"; [ "$WRONG" = "$GW" ] && WRONG="\${GW%.*}.253"
cat > /etc/netzplan.txt << EOF
Netzplan Labor-Netz
------------------
Router/Gateway: $GW
Server fis-lab: per DHCP
EOF
while ip route del default 2>/dev/null; do :; done
ip route add default via "$WRONG" dev "$DEV" onlink metric 100
echo ok`,
  verify: `read GW DEV < /var/lib/rootshell/gw
ip route get 1.1.1.1 | grep -q "via $GW " || { echo "❌ Pakete ins Internet gehen nicht über den Router aus dem Netzplan. Aktuell: $(ip route get 1.1.1.1 2>&1 | head -1)"; exit 1; }
echo "✅ Der Weg ins Internet führt wieder über das richtige Gateway ($GW)."`,
},
/* ---------- Git & Docker (Teil 7) ---------- */
{
  id: "mdev-git", topic: "devops", level: 2, title: "🌿 Wer hat den Port kaputt gemacht?",
  story: `Die Webapp in <code>~/webapp</code> startet nicht mehr: Der Port in <code>app.conf</code> ist plötzlich ungültig. Im Team arbeiten mehrere Leute mit Git. Irgendein Commit der letzten Tage war schuld.`,
  goal: `Finde den schuldigen Commit und nimm <b>nur diese</b> Änderung zurück – ohne die Geschichte umzuschreiben (kein <code>reset</code>) und ohne die späteren Änderungen der Kollegen zu verlieren.`,
  hints: [`<code>cd ~/webapp && git log --oneline</code>, dann je Commit <code>git show ID</code> – oder gezielt: <code>git log -p app.conf</code>`,
          `Ein schon geteilter Commit wird nicht gelöscht, sondern mit einem Gegen-Commit zurückgenommen.`,
          `<code>git revert ID</code> legt diesen Gegen-Commit an (mit <code>--no-edit</code> ohne Editor).`],
  solution: `<code>cd ~/webapp &amp;&amp; git revert --no-edit HEAD~1</code>`,
  test: `sudo -u ubuntu git -C /home/ubuntu/webapp revert --no-edit HEAD~1`,
  setup: `export DEBIAN_FRONTEND=noninteractive
command -v git >/dev/null || apt-get install -y -qq git >/dev/null
mkdir -p /var/lib/rootshell
rm -rf /home/ubuntu/webapp
sudo -u ubuntu bash << 'EOF'
set -e
mkdir -p /home/ubuntu/webapp && cd /home/ubuntu/webapp
git init -q -b main
git config user.name "Kollege Kai"; git config user.email kai@example.com
printf 'port=8080\\nloglevel=info\\nmax_clients=100\\n' > app.conf
echo "# Webapp" > README.md
git add . && git commit -qm "Grundkonfiguration"
echo "Start: ./start.sh" >> README.md && git commit -qam "Doku ergänzt"
git config user.name "Kollegin Lea"; git config user.email lea@example.com
sed -i 's/port=8080/port=80800/; s/max_clients=100/max_clients=150/' app.conf && git commit -qam "Kleine Optimierungen"
git config user.name "Kollege Kai"; git config user.email kai@example.com
echo "Kontakt: it@example.com" >> README.md && git commit -qam "Kontakt ergänzt"
git config user.name "Azubi"; git config user.email azubi@example.com
EOF
sudo -u ubuntu git -C /home/ubuntu/webapp rev-parse HEAD~1 > /var/lib/rootshell/badcommit
echo ok`,
  verify: `R=/home/ubuntu/webapp
G() { sudo -u ubuntu git -C "$R" "$@"; }
[ -d "$R/.git" ] || { echo "❌ ~/webapp ist kein Git-Repository mehr. Mission neu vorbereiten."; exit 1; }
BAD=$(cat /var/lib/rootshell/badcommit)
grep -qx 'port=8080' "$R/app.conf" || { echo "❌ In app.conf steht noch nicht wieder port=8080."; exit 1; }
grep -q 'Kontakt' "$R/README.md" || { echo "❌ Die spätere Änderung (Kontakt in README.md) ist verloren gegangen."; exit 1; }
G merge-base --is-ancestor "$BAD" HEAD || { echo "❌ Der fehlerhafte Commit fehlt in der Geschichte – sie wurde umgeschrieben. Nimm ihn mit revert zurück."; exit 1; }
[ -z "$(G status --porcelain)" ] || { echo "❌ Es gibt noch nicht committete Änderungen. Die Korrektur gehört in einen Commit."; exit 1; }
echo "✅ Fehler per revert zurückgenommen – Geschichte und spätere Änderungen sind erhalten."`,
},
{
  id: "mdev-docker", topic: "devops", level: 2, title: "🐳 Der Shop antwortet nicht",
  story: `Der Online-Shop läuft als Container <code>shop</code>. <code>docker ps</code> zeigt ihn als „Up“, aber <code>curl localhost:8095</code> liefert nur einen Fehler. (Das Vorbereiten installiert ggf. Docker und lädt ein Image – das kann 1–2 Minuten dauern.)`,
  goal: `Sorge dafür, dass unter <code>http://localhost:8095</code> die Webseite aus dem Container kommt. Der Container soll weiterhin <code>shop</code> heißen und nach einem Neustart des Servers automatisch wieder laufen.`,
  hints: [`<code>sudo docker ps</code> zeigt die Port-Zuordnung als <code>HOST:CONTAINER</code>.`,
          `Auf welchem Port lauscht nginx <b>im</b> Container? Standard ist 80. Die Zuordnung zeigt auf 8080.`,
          `Eine Port-Zuordnung lässt sich nicht nachträglich ändern: Container löschen (<code>docker rm -f shop</code>) und richtig neu starten – mit <code>--restart unless-stopped</code>.`],
  solution: `<code>sudo docker rm -f shop &amp;&amp; sudo docker run -d --name shop --restart unless-stopped -p 8095:80 nginx:alpine</code>`,
  setup: `export DEBIAN_FRONTEND=noninteractive
command -v docker >/dev/null || { echo "Installiere Docker …"; apt-get update -qq && apt-get install -y -qq docker.io >/dev/null; }
systemctl enable --now docker >/dev/null 2>&1
docker rm -f shop >/dev/null 2>&1 || true
docker run -d --name shop --restart unless-stopped -p 8095:8080 nginx:alpine >/dev/null
echo ok`,
  verify: `command -v docker >/dev/null || { echo "❌ Docker ist nicht installiert."; exit 1; }
[ "$(docker inspect -f '{{.State.Running}}' shop 2>/dev/null)" = true ] || { echo "❌ Es läuft kein Container namens 'shop'."; exit 1; }
curl -s --max-time 3 localhost:8095 | grep -qi nginx || { echo "❌ Unter localhost:8095 kommt noch keine Webseite."; exit 1; }
RP=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' shop)
[ "$RP" = always ] || [ "$RP" = unless-stopped ] || { echo "❌ Der Container startet nach einem Neustart nicht automatisch (Restart-Policy: $RP)."; exit 1; }
echo "✅ Der Shop ist erreichbar und überlebt auch einen Neustart."`,
},
/* ---------- Teil 8 · Datenbanken (topic "db" → Station ④ Störfall im Lernpfad) ---------- */
{
  id: "mdb-access", topic: "db", level: 1, title: "🗄️ Access denied",
  story: `Die Shop-Anwendung auf diesem Server zeigt nur noch eine Fehlerseite. Im Log steht: <i>„Access denied for user 'shop'@'localhost' to database 'shop'“</i>.
    Der Kollege, der den Datenbank-Benutzer gestern angelegt hat, ist im Urlaub. Mit <code>shop-check</code> kannst du selbst testen, was die Anwendung macht.
    (Das Vorbereiten installiert MariaDB – etwa eine Minute.)`,
  goal: `<code>shop-check</code> läuft ohne Fehler. Der Datenbank-Benutzer <code>shop</code> bekommt dabei <b>nur</b> Rechte auf die Datenbank <code>shop</code> – keine Rechte auf alle Datenbanken (<code>*.*</code>).`,
  hints: [`Führe <code>shop-check</code> aus und lies die Fehlermeldung genau.`,
          `Welche Rechte hat der Benutzer? <code>sudo mariadb -e "SHOW GRANTS FOR 'shop'@'localhost';"</code> – schau dir den Datenbanknamen genau an.`,
          `Rechte vergibst du mit <code>GRANT SELECT, INSERT, UPDATE, DELETE ON shop.* TO 'shop'@'localhost';</code>. Das falsche Recht kannst du mit <code>REVOKE … ON shopp.* FROM …</code> wieder entfernen.`],
  solution: `<code>SHOW GRANTS</code> zeigt Rechte auf <code>shopp.*</code> (Tippfehler). → <code>sudo mariadb -e "GRANT SELECT, INSERT, UPDATE, DELETE ON shop.* TO 'shop'@'localhost';"</code> (sauber: zusätzlich <code>REVOKE ALL PRIVILEGES ON shopp.* FROM 'shop'@'localhost';</code>)`,
  test: `mariadb -e "GRANT SELECT, INSERT, UPDATE, DELETE ON shop.* TO 'shop'@'localhost';"`,
  setup: NEED_MARIADB + SHOP_DB + `
mariadb -e "DROP USER IF EXISTS 'shop'@'localhost'; CREATE USER 'shop'@'localhost' IDENTIFIED BY 'Shop_2026'; GRANT SELECT, INSERT, UPDATE, DELETE ON shopp.* TO 'shop'@'localhost';"
cat > /usr/local/bin/shop-check <<'EOF'
#!/bin/bash
# So greift die Shop-Anwendung auf ihre Datenbank zu
mariadb -u shop -pShop_2026 shop -e "SELECT COUNT(*) AS bestellungen FROM bestellungen;"
EOF
chmod 755 /usr/local/bin/shop-check
echo ok`,
  verify: `command -v mariadb >/dev/null || { echo "❌ MariaDB ist nicht installiert."; exit 1; }
out=$(sudo -u ubuntu /usr/local/bin/shop-check 2>&1) || { echo "❌ shop-check scheitert noch: $(echo "$out" | tail -1)"; exit 1; }
if mariadb -N -e "SHOW GRANTS FOR 'shop'@'localhost'" | grep 'ON \\*\\.\\*' | grep -vq '^GRANT USAGE'; then
  echo "⚠️ shop-check läuft – aber der Benutzer shop hat jetzt Rechte auf ALLE Datenbanken (*.*). Gib ihm nur Rechte auf shop.*"; exit 1
fi
echo "✅ Die Anwendung kommt wieder an ihre Datenbank – mit genau den nötigen Rechten."`,
},
{
  id: "mdb-start", topic: "db", level: 2, title: "🗄️ MariaDB startet nicht mehr",
  story: `Ein Kollege hat am Wochenende einen Blogartikel über Datenbank-Tuning gelesen und „nur ein paar Einstellungen verbessert“. Seit dem Neustart ist der Datenbankdienst weg – und mit ihm der Shop.`,
  goal: `MariaDB läuft wieder und die Datenbank <code>shop</code> ist erreichbar. Die <b>gewollten</b> Tuning-Einstellungen des Kollegen sollen erhalten bleiben – korrigiere nur, was kaputt ist.`,
  hints: [`<code>systemctl status mariadb</code> zeigt, dass der Dienst nicht läuft. Warum, steht im Journal: <code>sudo journalctl -u mariadb -n 30</code>`,
          `Die Fehlermeldung nennt eine unbekannte Einstellung. Wo steht sie? <code>sudo grep -rn sizee /etc/mysql/</code>`,
          `Datei mit <code>sudo nano</code> korrigieren (Tippfehler im Namen), dann <code>sudo systemctl restart mariadb</code>.`],
  solution: `Im Journal: <i>unknown variable 'query_cache_sizee=16M'</i>. In <code>/etc/mysql/mariadb.conf.d/60-tuning.cnf</code> den Tippfehler zu <code>query_cache_size</code> korrigieren → <code>sudo systemctl restart mariadb</code>. Die Datei nicht einfach löschen, sonst ist <code>max_connections = 200</code> weg.`,
  test: `sed -i 's/query_cache_sizee/query_cache_size/' /etc/mysql/mariadb.conf.d/60-tuning.cnf; systemctl restart mariadb`,
  setup: NEED_MARIADB + SHOP_DB + `
cat > /etc/mysql/mariadb.conf.d/60-tuning.cnf <<'EOF'
# Tuning nach Blogartikel – Kollege M., 08.11.
[mysqld]
max_connections         = 200
innodb_buffer_pool_size = 256M
query_cache_sizee       = 16M
EOF
systemctl restart mariadb >/dev/null 2>&1 || true
echo ok`,
  verify: `systemctl is-active --quiet mariadb || { echo "❌ MariaDB läuft nicht (systemctl is-active mariadb)."; exit 1; }
mariadb -N -e "SELECT COUNT(*) FROM shop.bestellungen" >/dev/null 2>&1 || { echo "❌ MariaDB läuft, aber die Datenbank shop ist nicht erreichbar."; exit 1; }
v=$(mariadb -N -e "SELECT @@max_connections")
[ "$v" = 200 ] || { echo "⚠️ MariaDB läuft – aber max_connections ist $v statt 200. Die Tuning-Datei wurde gelöscht oder entschärft: korrigiere nur den Fehler."; exit 1; }
echo "✅ MariaDB läuft wieder, und die gewollten Einstellungen sind erhalten."`,
},
{
  id: "mdb-index", topic: "db", level: 2, title: "🗄️ Die Auswertung dauert ewig",
  story: `Der Vertrieb beschwert sich: Die Auswertung „Was hat Kunde 4711 gemacht?“ braucht Sekunden, und bei mehreren Nutzern gleichzeitig hängt der ganze Shop. Die Abfrage dahinter:
    <code>SELECT COUNT(*) FROM shop.logbuch WHERE kunde_id = 4711;</code> – die Tabelle hat 200.000 Zeilen.`,
  goal: `Sorge dafür, dass MariaDB diese Abfrage über einen <b>Index</b> beantwortet statt jede Zeile zu lesen. Die Daten im Logbuch müssen vollständig bleiben.`,
  hints: [`<code>EXPLAIN</code> vor einer Abfrage zeigt, wie MariaDB sie ausführt: <code>sudo mariadb shop -e "EXPLAIN SELECT COUNT(*) FROM logbuch WHERE kunde_id = 4711;"</code>`,
          `<code>type: ALL</code> heißt: komplette Tabelle durchsuchen (Full Table Scan). In der Spalte <code>key</code> steht <code>NULL</code> – es gibt keinen passenden Index.`,
          `<code>CREATE INDEX idx_kunde ON logbuch (kunde_id);</code> – danach noch einmal <code>EXPLAIN</code>.`],
  solution: `<code>sudo mariadb shop -e "CREATE INDEX idx_kunde ON logbuch (kunde_id);"</code> – danach zeigt <code>EXPLAIN</code> den Index in der Spalte <code>key</code> und nur noch wenige Zeilen.`,
  test: `mariadb shop -e "CREATE INDEX idx_kunde ON logbuch (kunde_id);"`,
  setup: NEED_MARIADB + SHOP_DB + `
mariadb shop <<'SQL'
CREATE TABLE logbuch (id INT AUTO_INCREMENT PRIMARY KEY, kunde_id INT, zeit DATETIME, aktion VARCHAR(20));
INSERT INTO logbuch (kunde_id, zeit, aktion)
  SELECT seq % 5000, TIMESTAMP('2026-11-08 23:59:00') - INTERVAL seq MINUTE, ELT(1 + seq % 3, 'login', 'suche', 'kauf')
  FROM seq_1_to_200000;
SQL
echo ok`,
  verify: `n=$(mariadb -N -e "SELECT COUNT(*) FROM shop.logbuch" 2>/dev/null) || { echo "❌ Die Tabelle shop.logbuch fehlt."; exit 1; }
[ "$n" = 200000 ] || { echo "❌ Im Logbuch stehen $n statt 200000 Zeilen – Daten löschen ist keine Lösung."; exit 1; }
k=$(mariadb -N shop -e "EXPLAIN SELECT COUNT(*) FROM logbuch WHERE kunde_id = 4711" | awk -F'\\t' '{print $6}')
[ -n "$k" ] && [ "$k" != NULL ] || { echo "❌ EXPLAIN zeigt noch keinen Index (key = NULL) – MariaDB liest die ganze Tabelle."; exit 1; }
echo "✅ Die Abfrage nutzt jetzt den Index $k."`,
},
{
  id: "mdb-restore", topic: "db", level: 3, title: "🗄️ Tabelle weg – aber nur die!",
  story: `Montag, 9:12 Uhr. Ein Werkstudent wollte „nur kurz aufräumen“ und hat in der Datenbank <code>shop</code> die Tabelle <code>kunden</code> gelöscht. Zum Glück gibt es die nächtliche Sicherung unter <code>/var/backups/db/</code>.
    Aber Vorsicht: Seit der Sicherung um 2 Uhr sind schon neue Bestellungen eingegangen.`,
  goal: `Die Tabelle <code>kunden</code> ist wieder vollständig da (6 Kunden). Die Tabelle <code>bestellungen</code> behält <b>alle</b> Bestellungen – auch die von heute.`,
  hints: [`<code>ls -l /var/backups/db/</code> und <code>head -40</code> auf die Sicherung: Was steht da drin?`,
          `Die Sicherung enthält für jede Tabelle <code>DROP TABLE</code> und <code>CREATE TABLE</code>. Spielst du sie komplett ein, wird auch <code>bestellungen</code> auf den Stand von 2 Uhr zurückgesetzt.`,
          `Sicherer Weg: In eine leere Hilfsdatenbank einspielen (<code>CREATE DATABASE wiederherstellung;</code> + <code>mariadb wiederherstellung &lt; datei.sql</code>) und von dort nur <code>kunden</code> zurückkopieren: <code>CREATE TABLE shop.kunden LIKE …; INSERT INTO shop.kunden SELECT * FROM …;</code>`],
  solution: `<code>sudo mariadb -e "CREATE DATABASE wiederherstellung;"</code> → <code>sudo mariadb wiederherstellung &lt; /var/backups/db/shop-2026-11-09.sql</code> → <code>sudo mariadb -e "CREATE TABLE shop.kunden LIKE wiederherstellung.kunden; INSERT INTO shop.kunden SELECT * FROM wiederherstellung.kunden; DROP DATABASE wiederherstellung;"</code>`,
  test: `mariadb -e "CREATE DATABASE wiederherstellung;"; mariadb wiederherstellung < /var/backups/db/shop-2026-11-09.sql; mariadb -e "CREATE TABLE shop.kunden LIKE wiederherstellung.kunden; INSERT INTO shop.kunden SELECT * FROM wiederherstellung.kunden; DROP DATABASE wiederherstellung;"`,
  setup: NEED_MARIADB + SHOP_DB + `
mkdir -p /var/backups/db
mariadb-dump shop > /var/backups/db/shop-2026-11-09.sql
touch -d '2026-11-09 02:00' /var/backups/db/shop-2026-11-09.sql
mariadb shop -e "INSERT INTO bestellungen (kunde_id, datum, betrag) VALUES (5,'2026-11-09',310.00), (2,'2026-11-09',64.80), (4,'2026-11-09',12.50); DROP TABLE kunden;"
echo ok`,
  verify: `k=$(mariadb -N -e "SELECT COUNT(*) FROM shop.kunden" 2>/dev/null) || { echo "❌ Die Tabelle shop.kunden fehlt noch."; exit 1; }
[ "$k" = 6 ] || { echo "❌ In kunden stehen $k statt 6 Zeilen."; exit 1; }
b=$(mariadb -N -e "SELECT COUNT(*) FROM shop.bestellungen" 2>/dev/null)
[ "$b" = 9 ] || { echo "❌ kunden ist zurück – aber in bestellungen stehen nur noch \${b:-0} statt 9 Zeilen. Die Bestellungen von heute sind weg: Wer die ganze Sicherung einspielt, überschreibt neuere Daten."; exit 1; }
echo "✅ kunden ist wiederhergestellt, und keine Bestellung von heute ging verloren."`,
},
/* ---------- PowerShell-Kurs (track: windows) – du arbeitest als ubuntu in PowerShell, geprüft wird von außen ---------- */
{
  id: "mps-report", track: "windows", level: 1, title: "Bericht für die Chefin",
  story: `Die IT-Leiterin will wissen, welche Programme auf dem Server am meisten Arbeitsspeicher brauchen – als Datei, die sie in Excel öffnen kann.`,
  goal: `Lege die Datei <code>~/berichte/top5.csv</code> an: die <b>5 Prozesse mit dem meisten Arbeitsspeicher</b>, Spalten <code>Name</code>, <code>Id</code> und <code>WorkingSet</code>.`,
  hints: [`Sortieren: <code>Get-Process | Sort-Object WorkingSet -Descending</code>`,
          `Spalten und Anzahl wählst du mit <code>Select-Object -First 5 Name, Id, WorkingSet</code>.`,
          `<code>Export-Csv</code> legt keine Ordner an – den Ordner <code>~/berichte</code> musst du vorher mit <code>New-Item -ItemType Directory</code> erstellen.`],
  solution: `<code>New-Item -ItemType Directory ~/berichte -Force; Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 5 Name, Id, WorkingSet | Export-Csv ~/berichte/top5.csv</code>`,
  setup: `rm -rf /home/ubuntu/berichte && echo ok`,
  verify: `f=/home/ubuntu/berichte/top5.csv
[ -f "$f" ] || { echo "❌ Die Datei ~/berichte/top5.csv gibt es noch nicht."; exit 1; }
head=$(grep -v '^#' "$f" | head -1)
for c in Name Id WorkingSet; do echo "$head" | grep -q "\\"$c\\"" || { echo "❌ Spalte '$c' fehlt. Kopfzeile: $head"; exit 1; }; done
n=$(grep -v '^#' "$f" | tail -n +2 | grep -c .)
[ "$n" -eq 5 ] || { echo "❌ Es sollen genau 5 Prozesse drinstehen, gefunden: $n."; exit 1; }
col=$(echo "$head" | tr ',' '\\n' | grep -n '"WorkingSet"' | cut -d: -f1)
vals=$(grep -v '^#' "$f" | tail -n +2 | cut -d, -f$col | tr -d '"')
[ "$vals" = "$(echo "$vals" | sort -rn)" ] || { echo "❌ Die Liste ist nicht absteigend nach WorkingSet sortiert."; exit 1; }
echo "✅ Bericht passt – 5 Prozesse, richtig sortiert. Die Chefin ist zufrieden."`,
},
{
  id: "mps-log", track: "windows", level: 2, title: "Wie viele Fehler hatte die App?",
  story: `Die Entwickler fragen, wie oft die Anwendung diese Woche einen Fehler geloggt hat. Die Logs liegen in <code>~/logs</code> – verteilt auf mehrere Dateien.`,
  goal: `Zähle alle Zeilen mit dem Log-Level <code>ERROR</code> in <b>allen</b> <code>.log</code>-Dateien und schreibe <b>nur die Zahl</b> in <code>~/logs/fehler.txt</code>.`,
  hints: [`Schau dir erst an, wie eine Zeile aufgebaut ist: <code>Get-Content ~/logs/app-1.log -Head 5</code>`,
          `<code>Select-String -Path ~/logs/*.log -Pattern …</code> durchsucht alle Dateien. Mit <code>.Count</code> bekommst du die Anzahl.`,
          `Vorsicht: Nicht jede Zeile, in der „ERROR“ vorkommt, ist ein Fehler – das Log-Level steht zwischen Leerzeichen (<code>' ERROR '</code>).`],
  solution: `<code>(Select-String -Path ~/logs/*.log -Pattern ' ERROR ' -CaseSensitive).Count | Set-Content ~/logs/fehler.txt</code>`,
  setup: `rm -rf /home/ubuntu/logs && mkdir -p /home/ubuntu/logs && cd /home/ubuntu/logs
for i in 1 2 3; do
  for n in $(seq 1 $((RANDOM % 40 + 40))); do
    r=$((RANDOM % 10)); lvl=INFO; [ $r -eq 0 ] && lvl=ERROR; [ $r -eq 1 ] && lvl=WARN
    echo "2026-11-0$i $((RANDOM % 14 + 8)):$((RANDOM % 50 + 10)) $lvl Vorgang $n"
  done > app-$i.log
done
echo "2026-11-02 09:15 INFO Benutzer öffnete den ERROR-Report" >> app-2.log
echo "2026-11-03 11:42 INFO Seite /help/errors aufgerufen (ERRORS_FAQ)" >> app-3.log
chown -R ubuntu:ubuntu /home/ubuntu/logs && echo ok`,
  verify: `f=/home/ubuntu/logs/fehler.txt
[ -f "$f" ] || { echo "❌ ~/logs/fehler.txt gibt es noch nicht."; exit 1; }
soll=$(cat /home/ubuntu/logs/*.log | grep -c ' ERROR ')
ist=$(tr -d ' \\r\\n\\357\\273\\277' < "$f")
[ "$ist" = "$soll" ] && { echo "✅ Richtig: $soll Fehler."; exit 0; }
alle=$(cat /home/ubuntu/logs/*.log | grep -c 'ERROR')
[ "$ist" = "$alle" ] && { echo "❌ Fast! $ist Zeilen enthalten das Wort – aber nicht alle davon sind Fehler. Schau dir die Treffer genau an."; exit 1; }
echo "❌ In der Datei steht '$ist' – das stimmt nicht."; exit 1`,
},
{
  id: "mps-cleanup", track: "windows", level: 2, title: "Aufräumen im Download-Ordner",
  story: `Der Download-Ordner eines Servers läuft voll. Die Regel im Team: Alles, was älter als 30 Tage ist, darf weg – neuere Dateien müssen bleiben.`,
  goal: `Lösche in <code>~/downloads</code> alle Dateien, die <b>älter als 30 Tage</b> sind (letzte Änderung). Neuere Dateien bleiben liegen.`,
  hints: [`<code>Get-ChildItem ~/downloads | Select-Object Name, LastWriteTime</code> zeigt das Alter.`,
          `Das Stichtagsdatum: <code>(Get-Date).AddDays(-30)</code>. Filtern mit <code>Where-Object LastWriteTime -lt …</code>`,
          `Erst mit <code>Remove-Item -WhatIf</code> testen, dann ohne.`],
  solution: `<code>Get-ChildItem ~/downloads -File | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item</code>`,
  setup: `rm -rf /home/ubuntu/downloads && mkdir -p /home/ubuntu/downloads && cd /home/ubuntu/downloads
for f in setup-alt.exe treiber_2024.zip rechnung-0815.pdf bild001.jpg backup-juni.tar log-export.csv vorlage-alt.docx; do
  head -c $((RANDOM * 10)) /dev/urandom > "$f"; touch -d "-$((RANDOM % 200 + 35)) days" "$f"; done
for f in angebot-aktuell.pdf firmware-neu.bin notizen.txt foto-team.jpg update-paket.zip; do
  head -c $((RANDOM * 10)) /dev/urandom > "$f"; touch -d "-$((RANDOM % 20)) days" "$f"; done
chown -R ubuntu:ubuntu /home/ubuntu/downloads && echo ok`,
  verify: `d=/home/ubuntu/downloads
alt=$(find $d -type f -mtime +30 | wc -l)
neu=0; for f in angebot-aktuell.pdf firmware-neu.bin notizen.txt foto-team.jpg update-paket.zip; do [ -f "$d/$f" ] && neu=$((neu+1)); done
[ "$neu" -eq 5 ] || { echo "❌ Hoppla – $((5-neu)) neue Datei(en) wurden mitgelöscht. Mission neu starten und genauer filtern."; exit 1; }
[ "$alt" -eq 0 ] || { echo "❌ Es liegen noch $alt alte Dateien im Ordner."; exit 1; }
echo "✅ Aufgeräumt: alte Dateien weg, die 5 neuen sind noch da."`,
},
{
  id: "mps-onboard", track: "windows", level: 3, title: "Neue Mitarbeiter einrichten",
  story: `Die Personalabteilung schickt eine Liste mit neuen Kolleginnen und Kollegen (<code>~/import/neue.csv</code>, frisch aus Excel). Für jede Person braucht es einen persönlichen Ordner.`,
  goal: `Lege für jede Person den Ordner <code>~/homes/&lt;Abteilung&gt;/&lt;vorname.nachname&gt;</code> an (alles <b>kleingeschrieben</b>) und darin die Datei <code>willkommen.txt</code> mit dem Text <code>Hallo &lt;Vorname&gt;</code>.`,
  hints: [`Schau dir die Datei an: <code>Get-Content ~/import/neue.csv</code> – welches Trennzeichen nutzt sie?`,
          `<code>Import-Csv ~/import/neue.csv -Delimiter ';'</code> liefert ein Objekt pro Person. Dann mit <code>foreach</code> durchgehen.`,
          `Kleinschreibung: <code>.ToLower()</code>. Ordner samt Unterordnern: <code>New-Item -ItemType Directory -Force</code>, Datei: <code>Set-Content</code>.`],
  solution: `<code>foreach ($p in Import-Csv ~/import/neue.csv -Delimiter ';') { $d = "$HOME/homes/$($p.Abteilung.ToLower())/$($p.Vorname.ToLower()).$($p.Nachname.ToLower())"; New-Item -ItemType Directory $d -Force | Out-Null; Set-Content "$d/willkommen.txt" "Hallo $($p.Vorname)" }</code>`,
  setup: `rm -rf /home/ubuntu/homes /home/ubuntu/import && mkdir -p /home/ubuntu/import
cat > /home/ubuntu/import/neue.csv <<'EOF'
Vorname;Nachname;Abteilung;Eintritt
Lena;Hoffmann;Vertrieb;01.12.2026
Max;Becker;IT;01.12.2026
Sara;Yilmaz;Buchhaltung;15.12.2026
Tom;Schulz;IT;02.01.2027
Mia;Wagner;Vertrieb;02.01.2027
EOF
chown -R ubuntu:ubuntu /home/ubuntu/import && echo ok`,
  verify: `h=/home/ubuntu/homes; fehlt=""
while IFS=';' read -r v n a e; do
  [ "$v" = Vorname ] && continue
  d="$h/$(echo "$a" | tr A-Z a-z)/$(echo "$v.$n" | tr A-Z a-z)"
  [ -f "$d/willkommen.txt" ] || { fehlt="$fehlt $v"; continue; }
  grep -q "Hallo $v" "$d/willkommen.txt" || fehlt="$fehlt $v(Text)"
done < /home/ubuntu/import/neue.csv
[ -z "$fehlt" ] || { echo "❌ Noch nicht fertig für:$fehlt"; ls -R $h 2>/dev/null | head -20; exit 1; }
echo "✅ Alle 5 Ordner mit Willkommensdatei angelegt – das Onboarding kann kommen."`,
},
/* ---------- Skript-Missionen Linux (Bash) – geprüft mit eigenen Testdaten ---------- */
{
  id: "msc-backup", topic: "script", level: 2, title: "Skript: Backup mit Rotation",
  story: `Ein Kunde sichert seinen Projektordner bisher von Hand – wenn er daran denkt. Letzte Woche war die Platte voll, weil sich hunderte alte Sicherungen angesammelt hatten.`,
  goal: `Schreibe <code>~/bin/backup.sh</code>: Es packt <code>~/projekt</code> als <code>~/backups/projekt-JJJJ-MM-TT_HHMMSS.tar.gz</code> und behält danach nur die <b>5 neuesten</b> Archive. Bei Erfolg Exit-Code 0. Das Skript muss auch funktionieren, wenn es aus einem anderen Ordner gestartet wird (z. B. von cron).`,
  hints: [`Datum im Dateinamen: <code>$(date +%F_%H%M%S)</code>. Packen mit <code>tar -czf ZIEL -C "$HOME" projekt</code> – <code>-C</code> wechselt vorher in den Ordner.`,
          `Die neuesten zuerst: <code>ls -1t ~/backups/projekt-*.tar.gz</code>. Alles ab Zeile 6: <code>tail -n +6</code>.`,
          `Löschen, was übrig bleibt: <code>… | xargs -r rm --</code>. Und nicht vergessen: <code>chmod +x</code>, <code>mkdir -p</code> für den Zielordner und volle Pfade (<code>$HOME</code> statt relativer Pfade).`],
  solution: `<pre>#!/bin/bash
set -euo pipefail
ZIEL="$HOME/backups"
mkdir -p "$ZIEL"
tar -czf "$ZIEL/projekt-$(date +%F_%H%M%S).tar.gz" -C "$HOME" projekt
ls -1t "$ZIEL"/projekt-*.tar.gz | tail -n +6 | xargs -r rm --</pre>`,
  testFile: "/home/ubuntu/bin/backup.sh",
  setup: `rm -rf /home/ubuntu/projekt /home/ubuntu/backups /home/ubuntu/bin/backup.sh
mkdir -p /home/ubuntu/projekt/docs /home/ubuntu/bin
echo "Wichtige Notizen" > /home/ubuntu/projekt/notizen.txt
echo "Angebot Müller GmbH" > /home/ubuntu/projekt/docs/angebot.txt
seq 1 500 > /home/ubuntu/projekt/daten.csv
chown -R ubuntu:ubuntu /home/ubuntu/projekt /home/ubuntu/bin
echo ok`,
  verify: `S=/home/ubuntu/bin/backup.sh; B=/home/ubuntu/backups
[ -f "$S" ] || { echo "❌ ~/bin/backup.sh gibt es noch nicht."; exit 1; }
[ -x "$S" ] || { echo "❌ ~/bin/backup.sh ist nicht ausführbar (chmod +x)."; exit 1; }
rm -rf "$B"; mkdir -p "$B"
for d in 01 02 03 04 05 06 07; do
  f="$B/projekt-2026-10-$d"_020000.tar.gz
  tar -czf "$f" -C /home/ubuntu projekt/notizen.txt
  touch -d "2026-10-$d 02:00" "$f"
done
chown -R ubuntu:ubuntu "$B"
echo "▶ Test: 7 alte Archive liegen in ~/backups, dein Skript wird aus /tmp gestartet …"
out=$(cd /tmp && sudo -u ubuntu -H "$S" 2>&1); rc=$?
[ -n "$out" ] && echo "$out" | tail -4 | sed 's/^/   /'
[ $rc -eq 0 ] || { echo "❌ Exit-Code $rc – bei Erfolg muss das Skript 0 liefern."; exit 1; }
neu=$(ls "$B" | grep -v '^projekt-2026-10-')
n=$(echo "$neu" | grep -c .)
[ "$n" -eq 1 ] || { echo "❌ Erwartet: genau 1 neues Archiv in ~/backups, gefunden: $n $neu"; exit 1; }
echo "$neu" | grep -Eq '^projekt-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{4}([0-9]{2})?\\.tar\\.gz$' || { echo "❌ Der Name passt nicht zum Muster projekt-JJJJ-MM-TT_HHMMSS.tar.gz: $neu"; exit 1; }
tar -tzf "$B/$neu" 2>/dev/null | grep -q 'docs/angebot.txt' || { echo "❌ Im Archiv fehlt der Inhalt von ~/projekt (z. B. docs/angebot.txt)."; exit 1; }
anz=$(ls "$B"/projekt-*.tar.gz | wc -l)
[ "$anz" -eq 5 ] || { echo "❌ Es liegen $anz Archive in ~/backups – es sollen nur die 5 neuesten bleiben."; exit 1; }
for d in 01 02 03; do [ -e "$B/projekt-2026-10-$d"_020000.tar.gz ] && { echo "❌ Das Archiv vom 2026-10-$d ist noch da, dafür fehlt ein neueres – gelöscht werden müssen die ältesten."; exit 1; }; done
echo "✅ Backup läuft: neues Archiv $neu, Inhalt stimmt, nur die 5 neuesten bleiben."`,
},
{
  id: "msc-platz", topic: "script", level: 2, title: "Skript: Warnung bei voller Platte",
  story: `Das Monitoring soll Alarm schlagen, bevor eine Platte vollläuft. Es kann eigene Prüfskripte starten und wertet deren <b>Exit-Code</b> aus.`,
  goal: `Schreibe <code>~/bin/platzcheck.sh SCHWELLE</code>. Für jedes echte Dateisystem (ohne <code>tmpfs</code>, <code>squashfs</code>, <code>devtmpfs</code>, <code>efivarfs</code>, <code>overlay</code>), das <b>über</b> der Schwelle in Prozent belegt ist, gibt es die Zeile <code>WARNUNG &lt;Einhängepunkt&gt; &lt;Belegung&gt;%</code> (z. B. <code>WARNUNG / 87%</code>) und am Ende Exit-Code 1. Ist alles gut: <code>OK</code> und Exit-Code 0. Fehlt die Schwelle oder ist sie keine Zahl: Hilfe auf stderr und Exit-Code 2.`,
  hints: [`<code>df --output=target,pcent -x tmpfs -x squashfs -x devtmpfs -x efivarfs -x overlay | tail -n +2</code> liefert Einhängepunkt und Belegung.`,
          `Zeile für Zeile: <code>while read -r ziel proz; do … done &lt; &lt;(df …)</code>. Aus <code>87%</code> wird mit <code>\${proz%\\%}</code> die Zahl 87.`,
          `Ist es eine Zahl? <code>[[ $1 =~ ^[0-9]+$ ]]</code>. Merke dir in einer Variable, ob es eine Warnung gab, und entscheide am Ende über den Exit-Code.`],
  solution: `<pre>#!/bin/bash
if [[ $# -ne 1 || ! $1 =~ ^[0-9]+$ ]]; then
  echo "Aufruf: $0 SCHWELLE (Prozent)" &gt;&amp;2
  exit 2
fi
warn=0
while read -r ziel proz; do
  proz=\${proz%\\%}
  if (( proz &gt; $1 )); then
    echo "WARNUNG $ziel $proz%"
    warn=1
  fi
done &lt; &lt;(df --output=target,pcent -x tmpfs -x squashfs -x devtmpfs -x efivarfs -x overlay | tail -n +2)
(( warn )) &amp;&amp; exit 1
echo "OK"</pre>`,
  testFile: "/home/ubuntu/bin/platzcheck.sh",
  setup: `rm -f /home/ubuntu/bin/platzcheck.sh; mkdir -p /home/ubuntu/bin; chown ubuntu:ubuntu /home/ubuntu/bin; echo ok`,
  verify: `S=/home/ubuntu/bin/platzcheck.sh
[ -x "$S" ] || { echo "❌ ~/bin/platzcheck.sh fehlt oder ist nicht ausführbar."; exit 1; }
run() { out=$(cd /tmp && sudo -u ubuntu -H "$S" "$@" 2>&1); rc=$?; }
p=$(df --output=pcent / | tail -1 | tr -dc 0-9)
run 1
[ $rc -eq 1 ] || { echo "❌ Schwelle 1 %: erwartet Exit-Code 1, bekommen $rc."; exit 1; }
echo "$out" | grep -Eq "^WARNUNG / $p%\\s*$" || { echo "❌ Schwelle 1 %: Es fehlt die Zeile 'WARNUNG / $p%'. Ausgabe:"; echo "$out" | head -5; exit 1; }
run 100
[ $rc -eq 0 ] || { echo "❌ Schwelle 100 %: erwartet Exit-Code 0, bekommen $rc. Ausgabe:"; echo "$out" | head -5; exit 1; }
echo "$out" | grep -q WARNUNG && { echo "❌ Schwelle 100 %: Es darf keine Warnung kommen."; exit 1; }
echo "$out" | grep -q OK || { echo "❌ Schwelle 100 %: Es soll 'OK' ausgegeben werden."; exit 1; }
run "$p"
echo "$out" | grep -Eq "^WARNUNG / " && { echo "❌ Schwelle $p % bei genau $p % Belegung: Das ist nicht ÜBER der Schwelle – für / darf keine Warnung kommen."; exit 1; }
run
[ $rc -eq 2 ] || { echo "❌ Ohne Parameter: erwartet Exit-Code 2, bekommen $rc."; exit 1; }
run abc
[ $rc -eq 2 ] || { echo "❌ Mit 'abc' als Schwelle: erwartet Exit-Code 2, bekommen $rc."; exit 1; }
echo "✅ platzcheck.sh arbeitet korrekt: Warnungen, OK und alle Exit-Codes stimmen."`,
},
{
  id: "msc-toplog", topic: "script", level: 3, title: "Skript: Wer ruft am häufigsten an?",
  story: `Der Webserver ist seit heute Morgen langsam. Verdacht: Einzelne Adressen fragen ihn mit sehr vielen Anfragen ab. Du brauchst ein Werkzeug, das du auf jedes Access-Log loslassen kannst.`,
  goal: `Schreibe <code>~/bin/toplog.sh LOGDATEI [ANZAHL]</code>. Es zeigt die ANZAHL (Standard: 3) häufigsten Client-Adressen – das ist das <b>erste Feld</b> jeder Zeile – im Format <code>&lt;Anzahl&gt; &lt;IP&gt;</code>, die häufigste zuerst. Gibt es die Datei nicht: Meldung auf stderr und Exit-Code 1. Zum Ausprobieren liegt <code>~/logs/access.log</code> bereit.`,
  hints: [`Das erste Feld: <code>awk '{print $1}'</code> oder <code>cut -d' ' -f1</code>.`,
          `Der Klassiker zum Zählen: <code>sort | uniq -c | sort -rn | head -n …</code>`,
          `<code>uniq -c</code> rückt die Zahl mit Leerzeichen ein – das ist in Ordnung. Standardwert: <code>ANZAHL="\${2:-3}"</code>. Prüfen, ob die Datei lesbar ist: <code>[[ -r $1 ]]</code>.`],
  solution: `<pre>#!/bin/bash
set -euo pipefail
LOG="\${1:-}"
ANZAHL="\${2:-3}"
if [[ ! -r $LOG ]]; then
  echo "Fehler: Datei '$LOG' nicht lesbar. Aufruf: $0 LOGDATEI [ANZAHL]" &gt;&amp;2
  exit 1
fi
awk '{print $1}' "$LOG" | sort | uniq -c | sort -rn | head -n "$ANZAHL"</pre>`,
  testFile: "/home/ubuntu/bin/toplog.sh",
  setup: `mkdir -p /home/ubuntu/logs /home/ubuntu/bin; rm -f /home/ubuntu/bin/toplog.sh
for ip in 192.168.1.10 192.168.1.10 192.168.1.10 10.0.0.7 10.0.0.7 172.16.0.3 192.168.1.10 10.0.0.7 192.168.1.44; do
  for i in $(seq 1 $((RANDOM % 20 + 5))); do printf '%s - - [07/Nov/2026:09:%02d:11 +0100] "GET /seite%s HTTP/1.1" 200 1024 "-" "Mozilla/5.0"\\n' "$ip" $((RANDOM % 60)) "$i"; done
done | shuf > /home/ubuntu/logs/access.log
chown -R ubuntu:ubuntu /home/ubuntu/logs /home/ubuntu/bin; echo ok`,
  verify: `S=/home/ubuntu/bin/toplog.sh
[ -x "$S" ] || { echo "❌ ~/bin/toplog.sh fehlt oder ist nicht ausführbar."; exit 1; }
T=$(mktemp /tmp/toplog-test-XXXX.log); chmod 644 "$T"
gen() { for i in $(seq 1 "$2"); do printf '%s - - [07/Nov/2026:10:00:00 +0100] "GET /x%s HTTP/1.1" 200 512 "-" "curl"\\n' "$1" "$i"; done; }
{ gen 203.0.113.9 41; gen 198.51.100.23 17; gen 10.20.30.40 29; gen 192.0.2.77 5; gen 172.16.5.1 11; } | shuf > "$T"
norm() { awk 'NF {print $1, $2}'; }
echo "▶ Test mit einem eigenen Log (andere Adressen als in deinem) …"
out=$(cd /tmp && sudo -u ubuntu -H "$S" "$T" 2 2>&1); rc=$?
soll=$(printf '%s\\n' "41 203.0.113.9" "29 10.20.30.40")
[ $rc -eq 0 ] || { echo "❌ Aufruf mit Testlog und ANZAHL 2: Exit-Code $rc."; echo "$out" | head -3; rm -f "$T"; exit 1; }
[ "$(echo "$out" | norm)" = "$soll" ] || { echo "❌ Die Top 2 stimmen nicht. Erwartet:"; echo "$soll"; echo "Bekommen:"; echo "$out" | head -5; rm -f "$T"; exit 1; }
out=$(cd /tmp && sudo -u ubuntu -H "$S" "$T" 2>&1)
[ "$(echo "$out" | norm | wc -l)" -eq 3 ] || { echo "❌ Ohne ANZAHL sollen es 3 Zeilen sein. Bekommen:"; echo "$out" | head -5; rm -f "$T"; exit 1; }
echo "$out" | norm | sed -n 3p | grep -q '^17 198.51.100.23$' || { echo "❌ Platz 3 stimmt nicht (erwartet: 17 198.51.100.23)."; rm -f "$T"; exit 1; }
rm -f "$T"
cd /tmp && sudo -u ubuntu -H "$S" /gibt/es/nicht.log >/dev/null 2>&1; rc=$?
[ $rc -eq 1 ] || { echo "❌ Bei fehlender Datei: erwartet Exit-Code 1, bekommen $rc."; exit 1; }
err=$(cd /tmp && sudo -u ubuntu -H "$S" /gibt/es/nicht.log 2>&1 >/dev/null)
[ -n "$err" ] || { echo "❌ Bei fehlender Datei soll eine Meldung auf stderr erscheinen (echo … >&2)."; exit 1; }
echo "✅ toplog.sh funktioniert – mit fremden Logs, Standardwert und im Fehlerfall."`,
},
/* ---------- Skript-Missionen PowerShell (track: windows, PowerShell 7 in der VM) ---------- */
{
  id: "mps-konvert", track: "windows", level: 2, title: "Skript: Benutzerliste umwandeln",
  story: `Die Personalabteilung liefert neue Mitarbeiter als CSV aus Excel. Das Anlage-Werkzeug der IT braucht aber JSON – mit fertigen Benutzernamen ohne Umlaute. Das soll ab jetzt jeden Monat ein Skript erledigen.`,
  goal: `Schreibe <code>~/skripte/Convert-Benutzer.ps1</code> mit den Pflichtparametern <code>-CsvPfad</code> und <code>-ZielPfad</code>. Es liest die CSV (Trennzeichen <code>;</code>, Spalten Vorname, Nachname, Abteilung) und schreibt eine JSON-Liste mit den Eigenschaften <code>Benutzername</code> (<code>vorname.nachname</code>, klein, ä→ae, ö→oe, ü→ue, ß→ss), <code>Name</code> („Vorname Nachname“) und <code>Abteilung</code>. Zeilen ohne Abteilung werden mit <code>Write-Warning</code> übersprungen; dann ist der Exit-Code 1, sonst 0. Zum Ausprobieren: <code>~/hr/neue.csv</code>.`,
  hints: [`<code>param([Parameter(Mandatory)][string]$CsvPfad, …)</code> und <code>Import-Csv $CsvPfad -Delimiter ';'</code>`,
          `Benutzername: <code>"$($p.Vorname).$($p.Nachname)".ToLower() -replace 'ä','ae' -replace …</code>. Objekte mit <code>[PSCustomObject]@{ … }</code> bauen, in einer <code>foreach</code>-Schleife sammeln.`,
          `Als JSON-<b>Liste</b> speichern, auch bei nur einem Eintrag: <code>ConvertTo-Json -InputObject @($liste) | Set-Content $ZielPfad</code>. Exit-Code mit <code>exit 1</code>.`],
  solution: `<pre>param([Parameter(Mandatory)][string]$CsvPfad, [Parameter(Mandatory)][string]$ZielPfad)
$fehlt = 0
$liste = foreach ($p in Import-Csv $CsvPfad -Delimiter ';') {
    if (-not $p.Abteilung) { Write-Warning "Übersprungen: $($p.Vorname) $($p.Nachname) – keine Abteilung"; $fehlt++; continue }
    $name = "$($p.Vorname).$($p.Nachname)".ToLower() -replace 'ä','ae' -replace 'ö','oe' -replace 'ü','ue' -replace 'ß','ss'
    [PSCustomObject]@{ Benutzername = $name; Name = "$($p.Vorname) $($p.Nachname)"; Abteilung = $p.Abteilung }
}
ConvertTo-Json -InputObject @($liste) | Set-Content $ZielPfad
if ($fehlt) { exit 1 }</pre>`,
  setup: `rm -rf /home/ubuntu/skripte/Convert-Benutzer.ps1 /home/ubuntu/hr
mkdir -p /home/ubuntu/skripte /home/ubuntu/hr
cat > /home/ubuntu/hr/neue.csv <<'EOF'
Vorname;Nachname;Abteilung
Lena;Hoffmann;Vertrieb
Björn;Groß;IT
Ayşe;Demir;
Max;Becker;Buchhaltung
EOF
chown -R ubuntu:ubuntu /home/ubuntu/skripte /home/ubuntu/hr
echo ok`,
  verify: `S=/home/ubuntu/skripte/Convert-Benutzer.ps1
[ -f "$S" ] || { echo "❌ ~/skripte/Convert-Benutzer.ps1 gibt es noch nicht."; exit 1; }
D=$(mktemp -d /tmp/konv-XXXX); chmod 755 "$D"
cat > "$D/test.csv" <<'EOF'
Vorname;Nachname;Abteilung
Jürgen;Weiß;IT
Özlem;Kaya;Vertrieb
Tom;Müller;
Anna;Schäfer;Buchhaltung
EOF
cat > "$D/check.ps1" <<'EOF'
param($Json)
$u = @(Get-Content $Json -Raw | ConvertFrom-Json)
$soll = @(
  @{ B = 'juergen.weiss'; N = 'Jürgen Weiß'; A = 'IT' },
  @{ B = 'oezlem.kaya'; N = 'Özlem Kaya'; A = 'Vertrieb' },
  @{ B = 'anna.schaefer'; N = 'Anna Schäfer'; A = 'Buchhaltung' })
if ($u.Count -ne 3) { "❌ Erwartet 3 Benutzer (Tom hat keine Abteilung), gefunden: $($u.Count)"; exit 1 }
foreach ($s in $soll) {
  $x = $u | Where-Object Benutzername -ceq $s.B
  if (-not $x) { "❌ Benutzername '$($s.B)' fehlt. Vorhanden: $(@($u.Benutzername) -join ', ')"; exit 1 }
  if ($x.Name -ne $s.N) { "❌ Bei $($s.B) steht als Name '$($x.Name)', erwartet: '$($s.N)'"; exit 1 }
  if ($x.Abteilung -ne $s.A) { "❌ Bei $($s.B) steht als Abteilung '$($x.Abteilung)', erwartet: '$($s.A)'"; exit 1 }
}
"ok"
EOF
chown -R ubuntu:ubuntu "$D"
echo "▶ Test mit einer anderen CSV-Datei als deiner …"
out=$(cd /tmp && sudo -u ubuntu -H pwsh -NoProfile -NonInteractive -File "$S" -CsvPfad "$D/test.csv" -ZielPfad "$D/out.json" 2>&1); rc=$?
out=$(echo "$out" | sed 's/\\x1b\\[[0-9;]*m//g')
[ -n "$out" ] && echo "$out" | tail -3 | sed 's/^/   /'
[ -f "$D/out.json" ] || { echo "❌ Die Zieldatei wurde nicht angelegt."; rm -rf "$D"; exit 1; }
res=$(sudo -u ubuntu -H pwsh -NoProfile -NonInteractive -File "$D/check.ps1" -Json "$D/out.json" 2>&1)
[ "$res" = ok ] || { echo "$res" | tail -3; rm -rf "$D"; exit 1; }
[ $rc -eq 1 ] || { echo "❌ Der Inhalt stimmt! Weil aber eine Zeile übersprungen wurde, soll der Exit-Code 1 sein (bekommen: $rc)."; rm -rf "$D"; exit 1; }
echo "$out" | grep -qi 'warn' || { echo "❌ Der Inhalt stimmt! Für die übersprungene Zeile fehlt aber eine Warnung (Write-Warning)."; rm -rf "$D"; exit 1; }
rm -rf "$D"
echo "✅ Klappt auch mit fremden Daten: Umlaute, fehlende Abteilung und Exit-Code stimmen."`,
},
{
  id: "mps-rotate", track: "windows", level: 3, title: "Skript: Log-Rotation",
  story: `Eine Anwendung schreibt ihre Logs seit Jahren in dieselben Dateien – inzwischen mehrere Gigabyte. Gewünscht ist eine Rotation, wie Linux sie mit logrotate macht: Das aktuelle Log wird zu <code>.1</code>, das alte <code>.1</code> zu <code>.2</code> usw., die ältesten fliegen raus.`,
  goal: `Schreibe <code>~/skripte/Invoke-LogRotation.ps1 -Pfad ORDNER [-Behalten 3]</code>. Für <b>jede</b> <code>.log</code>-Datei im Ordner: Dateien ab <code>name.log.&lt;Behalten&gt;</code> löschen, <code>name.log.N</code> zu <code>name.log.N+1</code> umbenennen, <code>name.log</code> zu <code>name.log.1</code> und danach eine neue, leere <code>name.log</code> anlegen. Andere Dateien bleiben unberührt. Zum Ausprobieren: <code>~/applogs</code>.`,
  hints: [`Alle Logs: <code>Get-ChildItem $Pfad -Filter *.log -File</code>. Für jedes Log arbeitest du mit dem vollen Pfad <code>$log.FullName</code>.`,
          `Rückwärts verschieben, sonst überschreibst du Dateien: <code>for ($i = $Behalten - 1; $i -ge 1; $i--) { … Move-Item "$basis.$i" "$basis.$($i + 1)" -Force }</code>`,
          `Vorher alles mit Nummer ≥ Behalten löschen (sonst bleiben bei kleinerem <code>-Behalten</code> alte Dateien liegen). Zum Schluss <code>Move-Item $basis "$basis.1"</code> und <code>New-Item $basis -ItemType File</code>.`],
  solution: `<pre>param([Parameter(Mandatory)][string]$Pfad, [ValidateRange(1, 99)][int]$Behalten = 3)
foreach ($log in Get-ChildItem $Pfad -Filter *.log -File) {
    $basis = $log.FullName
    Get-ChildItem "$basis.*" | Where-Object { $_.Extension -match '^\\.\\d+$' -and [int]$_.Extension.Substring(1) -ge $Behalten } | Remove-Item
    for ($i = $Behalten - 1; $i -ge 1; $i--) {
        if (Test-Path "$basis.$i") { Move-Item "$basis.$i" "$basis.$($i + 1)" -Force }
    }
    Move-Item $basis "$basis.1" -Force
    New-Item $basis -ItemType File | Out-Null
}</pre>`,
  setup: `rm -rf /home/ubuntu/applogs /home/ubuntu/skripte/Invoke-LogRotation.ps1
mkdir -p /home/ubuntu/applogs /home/ubuntu/skripte
for i in 1 2 3 4 5; do echo "Eintrag $i" >> /home/ubuntu/applogs/shop.log; done
echo "von gestern" > /home/ubuntu/applogs/shop.log.1
echo "von vorgestern" > /home/ubuntu/applogs/shop.log.2
echo "Start ok" > /home/ubuntu/applogs/api.log
echo "Bitte nicht löschen" > /home/ubuntu/applogs/README.txt
chown -R ubuntu:ubuntu /home/ubuntu/applogs /home/ubuntu/skripte; echo ok`,
  verify: `S=/home/ubuntu/skripte/Invoke-LogRotation.ps1
[ -f "$S" ] || { echo "❌ ~/skripte/Invoke-LogRotation.ps1 gibt es noch nicht."; exit 1; }
D=$(mktemp -d /tmp/rot-XXXX)
echo neu > "$D/app.log"; echo eins > "$D/app.log.1"; echo zwei > "$D/app.log.2"; echo drei > "$D/app.log.3"
echo web > "$D/web.log"; echo notiz > "$D/liesmich.txt"
chown -R ubuntu:ubuntu "$D"
inh() { if [ -f "$D/$1" ]; then tr -d '\\r\\n' < "$D/$1"; else echo "(fehlt)"; fi; }
fail() { echo "❌ $1"; echo "   Ordner danach:"; for f in $(ls "$D"); do echo "   $f: $(inh "$f")"; done; rm -rf "$D"; exit 1; }
echo "▶ Test in einem eigenen Ordner: app.log mit .1 bis .3, web.log, liesmich.txt – Aufruf mit -Behalten 3 …"
out=$(cd /tmp && sudo -u ubuntu -H pwsh -NoProfile -NonInteractive -File "$S" -Pfad "$D" -Behalten 3 2>&1); rc=$?
[ $rc -eq 0 ] || fail "Exit-Code $rc. Ausgabe: $(echo "$out" | tail -2)"
[ "$(inh app.log.1)" = neu ] || fail "app.log.1 soll den bisherigen Inhalt von app.log haben (neu)."
[ "$(inh app.log.2)" = eins ] || fail "app.log.2 soll den bisherigen Inhalt von app.log.1 haben (eins)."
[ "$(inh app.log.3)" = zwei ] || fail "app.log.3 soll den bisherigen Inhalt von app.log.2 haben (zwei)."
[ -e "$D/app.log.4" ] && fail "app.log.4 darf es nicht geben – mit -Behalten 3 fliegt die älteste Datei raus."
[ -f "$D/app.log" ] || fail "Nach dem Rotieren muss es wieder eine leere app.log geben."
[ -z "$(inh app.log)" ] || fail "Die neue app.log soll leer sein."
[ "$(inh web.log.1)" = web ] || fail "web.log wurde nicht rotiert – ALLE .log-Dateien im Ordner sollen rotiert werden."
{ [ "$(inh liesmich.txt)" = notiz ] && [ ! -e "$D/liesmich.txt.1" ]; } || fail "liesmich.txt ist keine .log-Datei und darf nicht angefasst werden."
echo "▶ Zweiter Lauf mit -Behalten 1 …"
sudo -u ubuntu -H pwsh -NoProfile -NonInteractive -File "$S" -Pfad "$D" -Behalten 1 >/dev/null 2>&1
n=$(ls "$D" | grep -c '^app\\.log\\.')
[ "$n" -eq 1 ] || fail "Mit -Behalten 1 soll nur app.log.1 übrig bleiben – gefunden: $n nummerierte app.log-Dateien."
rm -rf "$D"
echo "✅ Log-Rotation funktioniert – mit mehreren Logs und unterschiedlicher Anzahl."`,
},
/* ---------- Windows-Sandbox (track: windows, target: sandbox) – Setup & Prüfung laufen als PowerShell-Skript in der Sandbox ---------- */
{
  id: "mws-spooler", track: "windows", target: "sandbox", level: 1, title: "Niemand kann drucken",
  story: `Montagmorgen, das Telefon klingelt: „Der Drucker geht nicht! Bei allen!“ Am Drucker selbst ist alles in Ordnung – das Problem liegt auf dem Druckserver.`,
  goal: `Bring den Druckdienst wieder zum Laufen – und sorg dafür, dass er auch nach dem nächsten Neustart <b>automatisch</b> startet.`,
  hints: [`Welcher Dienst ist für Druckaufträge zuständig? <code>Get-Service *spool*</code>`,
          `Lässt er sich mit <code>Start-Service</code> starten? Wenn nicht: Schau dir den <code>StartType</code> an.`,
          `<code>Set-Service Spooler -StartupType Automatic</code>, dann <code>Start-Service Spooler</code>.`],
  solution: `<code>Set-Service Spooler -StartupType Automatic; Start-Service Spooler</code>`,
  setup: `Stop-Service Spooler -Force
Set-Service Spooler -StartupType Disabled
"ok"`,
  verify: `$s = Get-Service Spooler
if ($s.StartType -ne 'Automatic') { "❌ Starttyp ist '$($s.StartType)' – nach dem nächsten Neustart wäre das Problem wieder da."; exit 1 }
if ($s.Status -ne 'Running') { "❌ Starttyp passt, aber der Dienst läuft noch nicht (Status: $($s.Status))."; exit 1 }
"✅ Druckwarteschlange läuft und startet automatisch. Die Kollegen drucken wieder."`,
},
{
  id: "mws-user", track: "windows", target: "sandbox", level: 2, title: "Neue Kollegin im Vertrieb",
  story: `Lisa Müller fängt heute im Vertrieb an. Sie braucht ein Konto auf dem Dateiserver und muss im Abteilungsordner <code>C:\\Daten\\Vertrieb</code> arbeiten können. Die Gruppe <code>Vertrieb</code> gibt es schon.`,
  goal: `Lege das lokale Konto <code>lisa.mueller</code> (aktiv, mit Passwort) an, nimm es in die Gruppe <code>Vertrieb</code> auf und gib der <b>Gruppe</b> im Ordner <code>C:\\Daten\\Vertrieb</code> das Recht <b>Ändern</b> – auch für Unterordner und Dateien.`,
  hints: [`Passwort als SecureString: <code>$pw = Read-Host -AsSecureString</code>, dann <code>New-LocalUser lisa.mueller -Password $pw</code>`,
          `Mitglied hinzufügen: <code>Add-LocalGroupMember</code>. Kontrolle: <code>Get-LocalGroupMember Vertrieb</code>`,
          `Rechte für die Gruppe, nicht für Lisa selbst: <code>icacls C:\\Daten\\Vertrieb /grant "Vertrieb:(OI)(CI)M"</code> – so bekommen später auch neue Kollegen automatisch Zugriff.`],
  solution: `<code>$pw = Read-Host -AsSecureString; New-LocalUser lisa.mueller -Password $pw -FullName "Lisa Müller"; Add-LocalGroupMember Vertrieb -Member lisa.mueller; icacls C:\\Daten\\Vertrieb /grant "Vertrieb:(OI)(CI)M"</code>`,
  setup: `Remove-LocalUser lisa.mueller -ErrorAction SilentlyContinue
if (-not (Get-LocalGroup Vertrieb -ErrorAction SilentlyContinue)) { New-LocalGroup Vertrieb -Description "Abteilung Vertrieb" | Out-Null }
Remove-Item C:\\Daten\\Vertrieb -Recurse -Force -ErrorAction SilentlyContinue
New-Item C:\\Daten\\Vertrieb\\Angebote -ItemType Directory -Force | Out-Null
Set-Content C:\\Daten\\Vertrieb\\Angebote\\Preisliste-2026.txt "Preisliste – vertraulich"
"ok"`,
  verify: `$u = Get-LocalUser lisa.mueller -ErrorAction SilentlyContinue
if (-not $u) { "❌ Das Konto 'lisa.mueller' gibt es noch nicht."; exit 1 }
if (-not $u.Enabled) { "❌ Das Konto ist deaktiviert."; exit 1 }
if (-not $u.PasswordLastSet) { "❌ Das Konto hat kein Passwort."; exit 1 }
$m = Get-LocalGroupMember Vertrieb | Where-Object Name -like "*\\lisa.mueller"
if (-not $m) { "❌ lisa.mueller ist noch nicht in der Gruppe Vertrieb."; exit 1 }
$acl = (Get-Acl C:\\Daten\\Vertrieb).Access | Where-Object { $_.IdentityReference -like "*\\Vertrieb" -and $_.AccessControlType -eq 'Allow' }
$direkt = (Get-Acl C:\\Daten\\Vertrieb).Access | Where-Object { $_.IdentityReference -like "*\\lisa.mueller" }
if (-not $acl) { if ($direkt) { "❌ Du hast Lisa direkt berechtigt – vergib das Recht an die Gruppe Vertrieb (Best Practice: Rechte immer über Gruppen)."; exit 1 }; "❌ Die Gruppe Vertrieb hat noch keine Rechte auf C:\\Daten\\Vertrieb."; exit 1 }
$mod = [System.Security.AccessControl.FileSystemRights]::Modify
if (-not ($acl | Where-Object { ($_.FileSystemRights -band $mod) -eq $mod })) { "❌ Die Gruppe hat Rechte, aber nicht 'Ändern': $(($acl.FileSystemRights) -join ', ')"; exit 1 }
$inh = $acl | Where-Object { $_.InheritanceFlags -match 'ContainerInherit' -and $_.InheritanceFlags -match 'ObjectInherit' }
if (-not $inh) { "❌ Das Recht gilt nur für den Ordner selbst – Unterordner und Dateien (z. B. Angebote) erben es nicht. Tipp: (OI)(CI)"; exit 1 }
"✅ Lisa ist startklar: Konto aktiv, in der Gruppe Vertrieb, und die Gruppe darf im Ordner ändern."`,
},
{
  id: "mws-firewall", track: "windows", target: "sandbox", level: 2, title: "Die Web-App ist nicht erreichbar",
  story: `Auf dem Server läuft eine interne Web-Anwendung auf Port <b>8080</b>. Seit gestern kommt aus dem Netz niemand mehr dran. Der Kollege schwört: „Ich hab die Firewall-Regel doch angelegt!“`,
  goal: `Sorge dafür, dass Port <b>8080/TCP eingehend</b> durch die Windows-Firewall erlaubt ist. Die Firewall selbst bleibt <b>eingeschaltet</b> – und lösche keine fremden Regeln, die du nicht verstehst, ohne hinzusehen.`,
  hints: [`Gibt es die Regel des Kollegen? <code>Get-NetFirewallRule -DisplayName "*8080*" | Select-Object DisplayName, Enabled, Action</code>`,
          `Welche Regeln betreffen Port 8080 überhaupt? Die Ports stehen im Port-Filter – auch Bereiche wie <code>8000-8100</code>: <code>Get-NetFirewallPortFilter | Where-Object LocalPort -like "80*" | Get-NetFirewallRule</code>`,
          `Merke: <b>Block schlägt Allow.</b> Eine Sperrregel musst du deaktivieren (<code>Disable-NetFirewallRule</code>) oder so ändern, dass sie 8080 nicht mehr trifft.`],
  solution: `<code>Enable-NetFirewallRule -DisplayName "Webapp 8080"; Disable-NetFirewallRule -DisplayName "Legacy-Schutz Entwicklungsports"</code>`,
  setup: `Get-NetFirewallRule -DisplayName "Webapp 8080","Legacy-Schutz Entwicklungsports" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Set-NetFirewallProfile -All -Enabled True
New-NetFirewallRule -DisplayName "Webapp 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Enabled False | Out-Null
New-NetFirewallRule -DisplayName "Legacy-Schutz Entwicklungsports" -Description "Alte Regel von 2019 - Entwicklungsports sperren" -Direction Inbound -Protocol TCP -LocalPort 8000-8100 -Action Block | Out-Null
"ok"`,
  verify: `function Trifft($ports, $any) { foreach ($p in @($ports)) { if (($any -and $p -eq 'Any') -or $p -eq '8080') { return $true }; if ($p -match '^(\\d+)-(\\d+)$' -and 8080 -ge [int]$matches[1] -and 8080 -le [int]$matches[2]) { return $true } }; return $false }
if (Get-NetFirewallProfile | Where-Object { -not $_.Enabled }) { "❌ Ein Firewall-Profil ist ausgeschaltet – das ist keine Lösung, schalte es wieder ein."; exit 1 }
$aktiv = Get-NetFirewallRule -Direction Inbound -Enabled True | ForEach-Object { [pscustomobject]@{ Regel = $_; Filter = ($_ | Get-NetFirewallPortFilter) } }
$block = $aktiv | Where-Object { $_.Regel.Action -eq 'Block' -and $_.Filter.Protocol -in 'TCP','Any' -and (Trifft $_.Filter.LocalPort $true) } | ForEach-Object Regel
$allow = $aktiv | Where-Object { $_.Regel.Action -eq 'Allow' -and $_.Filter.Protocol -eq 'TCP' -and (Trifft $_.Filter.LocalPort $false) } | ForEach-Object Regel
if (-not $allow) { "❌ Es gibt keine aktive Allow-Regel für eingehend 8080/TCP."; exit 1 }
if ($block) { "❌ Die Allow-Regel ist aktiv – aber diese Regel sperrt 8080 weiterhin: $(($block.DisplayName) -join ', '). Block schlägt Allow!"; exit 1 }
"✅ Port 8080 ist offen, die Firewall bleibt an. Die alte Sperrregel war der Übeltäter."`,
},
{
  id: "mws-task", track: "windows", target: "sandbox", level: 3, title: "Die Nachtsicherung läuft nicht",
  story: `Jede Nacht soll die geplante Aufgabe <b>Nachtsicherung</b> das Skript <code>C:\\Skripte\\sicherung.ps1</code> starten. Laut Monitoring ist seit Wochen keine Sicherung mehr entstanden – die Aufgabe meldet einen Fehler.`,
  goal: `Finde heraus, warum die Aufgabe scheitert, und repariere sie. Starte sie danach einmal von Hand: Sie muss mit <code>LastTaskResult</code> <b>0</b> durchlaufen und <code>C:\\Backup\\ok.txt</code> erzeugen.`,
  hints: [`<code>Get-ScheduledTaskInfo Nachtsicherung</code> – der Fehlercode <code>LastTaskResult</code> ist ein Hinweis.`,
          `Was genau wird gestartet? <code>(Get-ScheduledTask Nachtsicherung).Actions | Format-List Execute, Arguments</code> – vergleich den Pfad mit <code>Get-ChildItem C:\\Skripte</code>.`,
          `Neue Aktion bauen und eintragen: <code>$a = New-ScheduledTaskAction -Execute powershell.exe -Argument '-NoProfile -ExecutionPolicy Bypass -File C:\\Skripte\\sicherung.ps1'</code>, dann <code>Set-ScheduledTask Nachtsicherung -Action $a</code> und <code>Start-ScheduledTask Nachtsicherung</code>.`],
  solution: `<code>$a = New-ScheduledTaskAction -Execute powershell.exe -Argument '-NoProfile -ExecutionPolicy Bypass -File C:\\Skripte\\sicherung.ps1'; Set-ScheduledTask Nachtsicherung -Action $a; Start-ScheduledTask Nachtsicherung</code>`,
  setup: `Unregister-ScheduledTask Nachtsicherung -Confirm:$false -ErrorAction SilentlyContinue
Remove-Item C:\\Backup -Recurse -Force -ErrorAction SilentlyContinue
New-Item C:\\Skripte -ItemType Directory -Force | Out-Null
Set-Content C:\\Skripte\\sicherung.ps1 -Encoding UTF8 -Value @'
New-Item C:\\Backup -ItemType Directory -Force | Out-Null
Get-ChildItem C:\\Daten -Recurse -ErrorAction SilentlyContinue | Measure-Object | Out-Null
"Sicherung erfolgreich: $(Get-Date -Format s)" | Set-Content C:\\Backup\\ok.txt
'@
$a = New-ScheduledTaskAction -Execute powershell.exe -Argument '-NoProfile -ExecutionPolicy Bypass -File C:\\Skripte\\sicherungs.ps1'
$t = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask Nachtsicherung -Action $a -Trigger $t -User SYSTEM -Description "Tägliche Datensicherung" | Out-Null
Start-ScheduledTask Nachtsicherung
Start-Sleep 4
"ok"`,
  verify: `$t = Get-ScheduledTask Nachtsicherung -ErrorAction SilentlyContinue
if (-not $t) { "❌ Die Aufgabe 'Nachtsicherung' gibt es nicht mehr – reparieren, nicht löschen!"; exit 1 }
if (-not $t.Triggers) { "❌ Die Aufgabe hat keinen Zeitplan mehr – sie soll weiterhin jede Nacht laufen."; exit 1 }
$arg = ($t.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join ' '
if ($arg -notmatch 'sicherung\\.ps1' -or $arg -match 'sicherungs\\.ps1') { "❌ Die Aufgabe startet noch: $arg"; exit 1 }
$i = Get-ScheduledTaskInfo Nachtsicherung
if ($i.LastTaskResult -eq 267011) { "❌ Die Aufgabe ist seit der Reparatur noch nicht gelaufen – starte sie mit Start-ScheduledTask."; exit 1 }
if ($i.LastTaskResult -ne 0) { "❌ Letzter Lauf endete mit Fehlercode $($i.LastTaskResult). Hast du sie nach der Reparatur gestartet?"; exit 1 }
if (-not (Test-Path C:\\Backup\\ok.txt)) { "❌ LastTaskResult ist 0, aber C:\\Backup\\ok.txt fehlt."; exit 1 }
"✅ Nachtsicherung repariert: $(Get-Content C:\\Backup\\ok.txt)"`,
},
];
if (typeof module !== "undefined" && module.exports) module.exports = MISSIONS; else root.MISSIONS = MISSIONS;
})(this);
