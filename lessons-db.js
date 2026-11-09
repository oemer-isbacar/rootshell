/* Teil 8 – Datenbanken (group "db", topic "db").
 * Lernpfad: ① SQL im Browser (folgt) → ② Üben in der Übungs-VM → ③ MariaDB auf der Server-VM (v8-db) → ④ Störfälle (folgen).
 * Übungen (vm: "uebung") laufen in der Wegwerf-VM; prep wird nach dem Zurücksetzen auf „basis“ als root ausgeführt.
 */
window.LESSONS.push(
/* ---------- ① Lernen: SQL-Krimi Fall 1 (SQL-Konsole im Browser, Datenbank krimi1 aus sql-cases.js) ---------- */
{
  id: "db1-krimi-a", mode: "sql", db: "krimi1", group: "db", topic: "db", stage: 1, title: "SQL-Krimi · Fall 1: Spurensicherung",
  intro: `Samstag, 7:40 Uhr bei der <b>Nordlicht Logistik GmbH</b>: Aus dem Serverraum ist ein Admin-Laptop verschwunden. Du bist die IT-Forensik. Deine einzige Waffe: <b>SQL</b>.
    Links ist eine echte Datenbank mit Meldungen, Mitarbeitern, Kartenleser-Protokollen, Geräten, Tickets und VPN-Anmeldungen. Tippe Abfragen ins Feld und drücke <kbd>Strg</kbd>+<kbd>Enter</kbd>.
    Jeder Schritt bringt dir einen neuen SQL-Befehl bei – die Lösung steckt hinter „Lösung zeigen“, falls du festhängst.`,
  steps: [
    { title: "Lies die Meldungen",
      text: `<code>SELECT * FROM tabelle;</code> zeigt <b>alle Spalten</b> (<code>*</code>) und alle Zeilen einer Tabelle. Das Semikolon beendet die Abfrage.`,
      task: `Zeig dir alle Meldungen aus der Tabelle <code>meldungen</code> an.`,
      solution: `SELECT * FROM meldungen;`, check: { cmd: /select\s+\*\s+from\s+meldungen/i, out: /LT-0815/ },
      explain: `Zwei Hinweise: Der Laptop heißt <b>LT-0815</b>, und um <b>21:30 Uhr</b> am Freitag (23.10.) war er noch da.` },
    { title: "Welches Gerät genau?",
      text: `Mit <code>WHERE</code> filterst du Zeilen. Text steht in einfachen Anführungszeichen: <code>WHERE spalte = 'Wert'</code>. Statt <code>*</code> kannst du auch einzelne Spalten nennen.`,
      task: `Suche in <code>geraete</code> nur die Zeile mit der Inventarnummer <code>LT-0815</code>.`,
      hint: `<code>SELECT * FROM geraete WHERE inventarnr = '…';</code>`,
      solution: `SELECT * FROM geraete WHERE inventarnr = 'LT-0815';`, check: { cmd: /where/i, out: /nl-lt-0815/, notOut: /LT-0816/ },
      explain: `Merk dir den <b>Hostnamen</b> <code>nl-lt-0815</code> – so meldet sich das Gerät im Netzwerk an. Das wird noch wichtig.` },
    { title: "Wer war nach 21:30 im Serverraum?",
      text: `Mehrere Bedingungen verbindest du mit <code>AND</code>. Zeiten stehen hier als Text <code>'2026-10-23 21:30'</code> – so lassen sie sich mit <code>&gt;=</code> vergleichen.
        <code>ORDER BY spalte</code> sortiert das Ergebnis.`,
      task: `Zeige aus <code>zutritte</code> alle Einträge für den <code>Serverraum</code> ab <code>2026-10-23 21:30</code>, nach Zeit sortiert.`,
      hint: `<code>… WHERE raum = 'Serverraum' AND zeit &gt;= '2026-10-23 21:30' ORDER BY zeit;</code>`,
      solution: `SELECT * FROM zutritte WHERE raum = 'Serverraum' AND zeit >= '2026-10-23 21:30' ORDER BY zeit;`,
      check: { cmd: /order\s+by/i, out: /K-117[\s\S]*K-121/, notOut: /21:25/ },
      explain: `Zwei Karten: <b>K-117</b> um 21:47 und <b>K-121</b> um 22:31. Aber wem gehören die?` },
    { title: "Namen statt Kartennummern: JOIN",
      text: `<code>JOIN</code> verbindet zwei Tabellen über eine gemeinsame Spalte. Kurznamen (<code>z</code>, <code>m</code>) sparen Tipparbeit:
        <code>FROM zutritte z JOIN mitarbeiter m ON m.karte = z.karte</code>.`,
      task: `Gib für dieselben Serverraum-Zutritte ab 21:30 den <b>Namen</b>, die Abteilung und die Zeit aus.`,
      hint: `<code>SELECT m.name, m.abteilung, z.zeit FROM zutritte z JOIN mitarbeiter m ON m.karte = z.karte WHERE …</code>`,
      solution: `SELECT m.name, m.abteilung, z.zeit FROM zutritte z JOIN mitarbeiter m ON m.karte = z.karte WHERE z.raum = 'Serverraum' AND z.zeit >= '2026-10-23 21:30' ORDER BY z.zeit;`,
      check: { cmd: /join/i, out: /Sabine Krüger[\s\S]*Mehmet Arslan/, notOut: /Jonas Weber/ },
      explain: `Mehmet Arslan ist aus der IT – das passt. Aber <b>Sabine Krüger aus der Buchhaltung</b> nachts im Serverraum?` },
    { title: "Wer ist hier sonst unterwegs? GROUP BY",
      text: `<code>GROUP BY</code> fasst gleiche Werte zu einer Zeile zusammen, <code>COUNT(*)</code> zählt die Zeilen jeder Gruppe. Mit <code>AS</code> gibst du einer Spalte einen Namen.`,
      task: `Zähle für <b>alle</b> Serverraum-Zutritte, wie oft jede Person dort war – die häufigsten zuerst.`,
      hint: `<code>SELECT m.name, COUNT(*) AS besuche FROM … WHERE z.raum = 'Serverraum' GROUP BY m.name ORDER BY besuche DESC;</code>`,
      solution: `SELECT m.name, COUNT(*) AS besuche FROM zutritte z JOIN mitarbeiter m ON m.karte = z.karte WHERE z.raum = 'Serverraum' GROUP BY m.name ORDER BY besuche DESC;`,
      check: { cmd: /group\s+by/i, out: /Jonas Weber \| 4/ },
      explain: `Die IT ist regelmäßig dort. Sabine Krüger war <b>genau einmal</b> im Serverraum – in der Tatnacht.` },
    { title: "Was war am Freitag los? LIKE",
      text: `<code>LIKE</code> sucht nach Mustern: <code>%</code> steht für beliebig viele Zeichen. <code>erstellt LIKE '2026-10-23%'</code> findet alles vom 23.10.`,
      task: `Zeige alle Tickets, die am <code>2026-10-23</code> erstellt wurden.`,
      solution: `SELECT * FROM tickets WHERE erstellt LIKE '2026-10-23%';`,
      check: { cmd: /like/i, out: /Klimaanlage/, notOut: /Kantine/ },
      explain: `Jonas Weber hat um 21:31 den Rundgang protokolliert, Mehmet Arslan kam um 22:25 wegen eines <b>Klimaanlagen-Alarms</b> – er hatte also einen Grund. Für Sabine Krüger gibt es kein Ticket.` },
  ],
  outro: `Erster Verdacht: die Karte <b>K-117</b> von Sabine Krüger. Aber war sie es wirklich? Weiter in Teil 2.`,
},
{
  id: "db1-krimi-b", mode: "sql", db: "krimi1", group: "db", topic: "db", stage: 1, title: "SQL-Krimi · Fall 1: Die Spur",
  intro: `Die Karte K-117 von Sabine Krüger war um 21:47 im Serverraum. Bevor du sie beschuldigst: Ein guter Ermittler prüft das <b>Alibi</b>.`,
  steps: [
    { title: "Das Alibi: VPN-Anmeldungen",
      text: `In <code>vpn_logins</code> steht, wer sich wann von wo ins Firmennetz eingewählt hat. Jede Person hat einen Benutzernamen (Spalte <code>benutzer</code> in <code>mitarbeiter</code>) – für Sabine Krüger ist es <code>skrueger</code>.`,
      task: `Zeige alle VPN-Anmeldungen von <code>skrueger</code>, nach Zeit sortiert.`,
      solution: `SELECT * FROM vpn_logins WHERE benutzer = 'skrueger' ORDER BY zeit;`,
      check: { cmd: /vpn_logins/i, out: /84\.152\.10\.23[\s\S]*2026-10-23 21:15/ },
      explain: `Um 21:15 und 22:40 war sie <b>von zu Hause</b> (IP 84.152.10.23) per VPN angemeldet. Um 21:47 im Serverraum? Unwahrscheinlich – jemand hatte ihre Karte.` },
    { title: "Eine Abfrage in der Abfrage",
      text: `Eine <b>Unterabfrage</b> in Klammern liefert einen Wert für die äußere Abfrage:
        <code>WHERE mitarbeiter_id = (SELECT id FROM mitarbeiter WHERE name = '…')</code>. So musst du die ID nicht selbst nachschlagen.`,
      task: `Finde alle Tickets von Sabine Krüger – mit einer Unterabfrage statt ihrer ID.`,
      hint: `<code>SELECT * FROM tickets WHERE mitarbeiter_id = (SELECT id FROM mitarbeiter WHERE name = 'Sabine Krüger');</code>`,
      solution: `SELECT * FROM tickets WHERE mitarbeiter_id = (SELECT id FROM mitarbeiter WHERE name = 'Sabine Krüger');`,
      check: { cmd: /\(\s*select/i, out: /verloren/ },
      explain: `Sie hat ihre Karte am <b>22.10. in der Kantine verloren</b> – und das Ticket steht noch auf <b>offen</b>. Niemand hat die Karte gesperrt. (Das wäre der erste Admin-Fehler in diesem Fall.)` },
    { title: "Wer war mit in der Kantine? BETWEEN",
      text: `<code>BETWEEN a AND b</code> prüft, ob ein Wert in einem Bereich liegt (beide Grenzen eingeschlossen).`,
      task: `Wer war am <code>2026-10-22</code> zwischen <code>12:00</code> und <code>12:30</code> in der <code>Kantine</code>? Gib die Namen aus.`,
      hint: `<code>… WHERE z.raum = 'Kantine' AND z.zeit BETWEEN '2026-10-22 12:00' AND '2026-10-22 12:30'</code>`,
      solution: `SELECT m.name, m.abteilung, z.zeit FROM zutritte z JOIN mitarbeiter m ON m.karte = z.karte WHERE z.raum = 'Kantine' AND z.zeit BETWEEN '2026-10-22 12:00' AND '2026-10-22 12:30' ORDER BY z.zeit;`,
      check: { cmd: /between/i, out: /Tobias Bauer/, notOut: /Jonas Weber/ },
      explain: `Fünf Personen. Eine davon hat die Karte vermutlich aufgehoben. Aber wer?` },
    { title: "Ein Motiv?",
      task: `Suche alle Tickets, in deren Betreff das Wort <code>Laptop</code> vorkommt – egal an welcher Stelle.`,
      hint: `Prozentzeichen auf beiden Seiten: <code>LIKE '%Laptop%'</code>`,
      solution: `SELECT * FROM tickets WHERE betreff LIKE '%Laptop%';`,
      check: { cmd: /like\s+'%laptop%'/i, out: /abgelehnt/ },
      explain: `Jemand wollte vor zwei Tagen einen Laptop ausleihen – <b>abgelehnt</b>. Das Ticket hat die <code>mitarbeiter_id</code> 4.` },
    { title: "Das Gerät meldet sich",
      text: `Gestohlene Firmen-Laptops verbinden sich oft automatisch mit dem VPN, sobald sie Internet haben. Erinnerst du dich an den Hostnamen?`,
      task: `Suche in <code>vpn_logins</code> nach Anmeldungen des Geräts <code>nl-lt-0815</code>.`,
      solution: `SELECT * FROM vpn_logins WHERE geraet = 'nl-lt-0815';`,
      check: { cmd: /nl-lt-0815/i, out: /tbauer/ },
      explain: `Am Sonntagabend hat sich der verschwundene Laptop eingewählt – mit dem Benutzer <b>tbauer</b>.` },
    { title: "Die Auflösung",
      task: `Überführe den Täter mit <b>einer</b> Abfrage: Verbinde <code>vpn_logins</code> und <code>mitarbeiter</code> (per <code>JOIN</code> oder Unterabfrage) und gib Name und Abteilung der Person aus, die sich mit <code>nl-lt-0815</code> angemeldet hat.`,
      hint: `Gemeinsame Spalte ist der Benutzername: <code>JOIN mitarbeiter m ON m.benutzer = v.benutzer</code>. Mit <code>DISTINCT</code> nach <code>SELECT</code> kommt jede Person nur einmal vor.`,
      solution: `SELECT DISTINCT m.name, m.abteilung FROM vpn_logins v JOIN mitarbeiter m ON m.benutzer = v.benutzer WHERE v.geraet = 'nl-lt-0815';`,
      check: { cmd: /join|in\s*\(\s*select|=\s*\(\s*select/i, out: /Tobias Bauer/, notOut: /Krüger/ },
      explain: `<b>Fall gelöst!</b> Tobias Bauer (Vertrieb) hat die verlorene Karte K-117 in der Kantine gefunden, sein Laptop-Antrag war abgelehnt worden – und mit der fremden Karte holte er sich das Gerät aus dem Serverraum.
        <br><b>Was die IT daraus lernt:</b> verlorene Karten sofort sperren, Zutritte zum Serverraum regelmäßig auswerten, Admin-Geräte verschlüsseln.` },
  ],
  outro: `Du kannst jetzt <code>SELECT</code>, <code>WHERE</code>, <code>AND</code>, <code>ORDER BY</code>, <code>JOIN</code>, <code>GROUP BY</code>, <code>LIKE</code>, <code>BETWEEN</code> und Unterabfragen. Als Nächstes übst du das an einem <b>echten MariaDB-Server</b> in der Übungs-VM.`,
},

/* ---------- ② Üben: echtes MariaDB in der Übungs-VM ---------- */
{
  id: "db2-sql-uebung", mode: "ssh", vm: "uebung", group: "db", topic: "db", stage: 2, title: "SQL üben an echtem MariaDB",
  intro: `In deiner <b>🧪 Übungs-VM</b> läuft schon ein MariaDB-Server mit der Datenbank <code>firma</code>. Hier übst du die wichtigsten SQL-Befehle – geht etwas schief, setzt „Übung vorbereiten“ alles wieder zurück.`,
  prep: `export DEBIAN_FRONTEND=noninteractive
echo "MariaDB installieren …"
apt-get update -qq && apt-get install -y -qq mariadb-server >/dev/null
mariadb -e "CREATE DATABASE IF NOT EXISTS firma;
CREATE TABLE IF NOT EXISTS firma.mitarbeiter (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50), abteilung VARCHAR(30), gehalt INT);
INSERT INTO firma.mitarbeiter (name, abteilung, gehalt) VALUES
  ('Ayşe Kaya','IT',3800), ('Jonas Weber','IT',3500), ('Lena Schmidt','Vertrieb',3200),
  ('Murat Demir','Vertrieb',3400), ('Petra Hoffmann','Buchhaltung',3600);"
echo "Datenbank firma ist bereit."`,
  steps: [
    { title: "Welche Datenbanken gibt es?", text: `<code>sudo mariadb</code> meldet dich als DB-root an, <code>-e</code> führt einen einzelnen SQL-Befehl aus.`,
      cmd: `sudo mariadb -e "SHOW DATABASES;"`, check: { cmd: /mariadb|mysql/, out: /firma/ } },
    { title: "Alle Zeilen einer Tabelle", cmd: `sudo mariadb firma -e "SELECT * FROM mitarbeiter;"`, check: { cmd: /SELECT\s+\*/i, out: /Kaya/ },
      explain: `<code>*</code> heißt „alle Spalten“. In echten Anwendungen nennt man die Spalten lieber einzeln – das ist schneller und bricht nicht, wenn jemand eine Spalte hinzufügt.` },
    { title: "Filtern mit WHERE", cmd: `sudo mariadb firma -e "SELECT name, gehalt FROM mitarbeiter WHERE abteilung = 'IT';"`,
      check: { cmd: /WHERE/i, out: /Jonas Weber/, notOut: /Lena Schmidt/ } },
    { title: "Zählen pro Abteilung", cmd: `sudo mariadb firma -e "SELECT abteilung, COUNT(*) AS anzahl FROM mitarbeiter GROUP BY abteilung;"`,
      check: { cmd: /GROUP\s+BY/i, out: /Vertrieb\s*\|?\s*2/ },
      explain: `<code>GROUP BY</code> fasst Zeilen mit gleichem Wert zusammen; <code>COUNT</code>, <code>SUM</code>, <code>AVG</code> rechnen dann pro Gruppe.` },
    { title: "Ändern – immer mit WHERE!", text: `Ein <code>UPDATE</code> ohne <code>WHERE</code> ändert <b>alle</b> Zeilen. In der Übungs-VM ist das egal, auf einem echten Server nicht.`,
      cmd: `sudo mariadb firma -e "UPDATE mitarbeiter SET gehalt = 3300 WHERE name = 'Lena Schmidt'; SELECT name, gehalt FROM mitarbeiter WHERE name = 'Lena Schmidt';"`,
      check: { cmd: /UPDATE/i, out: /3300/ } },
    { title: "Deine Aufgabe: Wer verdient am meisten?", task: `Finde mit <b>einer</b> Abfrage den Namen der Person mit dem höchsten Gehalt.`,
      hint: `Sortieren mit <code>ORDER BY gehalt DESC</code>, nur die erste Zeile mit <code>LIMIT 1</code>.`,
      check: { cmd: /ORDER\s+BY/i, out: /Kaya/, notOut: /Hoffmann/ } },
  ],
  outro: `Als Nächstes richtest du MariaDB auf deiner <b>🖥 Server-VM</b> selbst ein – mit Absichern, eigenem Benutzer und Backup.`,
},

/* ---------- ③ Anwenden: WordPress von Hand auf der Server-VM (Port 8081, neben der LEMP-Notiz-App auf Port 80) ---------- */
{
  id: "db3-wp-install", mode: "ssh", vm: "server", group: "db", topic: "db", stage: 3, title: "WordPress von Hand installieren",
  intro: `<b>WordPress</b> betreibt rund 40 % aller Webseiten – und ist ein typischer Auftrag im Admin-Alltag. Du installierst es auf deiner <b>🖥 Server-VM</b> Schritt für Schritt von Hand:
    nginx als Webserver, PHP-FPM für den Code, MariaDB für die Daten. Danach arbeitest du in der nächsten Lektion mit SQL direkt in der WordPress-Datenbank.`,
  steps: [
    { title: "Pakete installieren",
      text: `WordPress braucht PHP mit ein paar Erweiterungen (Datenbank, XML, Bilder, Zip …). Falls du die LEMP-Lektion schon gemacht hast, sind nginx, MariaDB und PHP-FPM bereits da – apt installiert dann nur die fehlenden Erweiterungen.`,
      cmd: "sudo apt install -y nginx mariadb-server php-fpm php-mysql php-xml php-mbstring php-curl php-gd php-zip php-intl",
      check: { cmd: /apt(-get)?\s+install\s.*php-mysql/ } },
    { title: "Datenbank und eigener Benutzer",
      text: `Jede Anwendung bekommt ihre <b>eigene</b> Datenbank und einen eigenen Benutzer, der nur dort Rechte hat. So kann eine gehackte WordPress-Seite nicht an andere Datenbanken.`,
      cmd: `sudo mariadb -e "CREATE DATABASE IF NOT EXISTS wordpress CHARACTER SET utf8mb4; CREATE USER IF NOT EXISTS 'wp'@'localhost' IDENTIFIED BY 'Wp_Passwort_2026'; GRANT ALL PRIVILEGES ON wordpress.* TO 'wp'@'localhost'; SHOW GRANTS FOR 'wp'@'localhost';"`,
      check: { cmd: /CREATE\s+DATABASE/i, out: /wordpress/ },
      explain: `<code>utf8mb4</code> speichert alle Unicode-Zeichen – auch Umlaute und Emojis. <code>SHOW GRANTS</code> zeigt: Rechte nur auf <code>wordpress.*</code>, genau wie im Störfall „Access denied“.` },
    { title: "WordPress herunterladen und auspacken",
      text: `Die aktuelle Version gibt es immer unter derselben Adresse. <code>-C</code> sagt <code>tar</code>, wohin es auspacken soll.`,
      cmd: "cd /tmp && curl -sSLO https://wordpress.org/latest.tar.gz && sudo tar xzf latest.tar.gz -C /var/www/ && ls /var/www/wordpress | head",
      check: { cmd: /tar\s+x/, out: /wp-config-sample\.php/ } },
    { title: "Dateien dem Webserver geben",
      text: `nginx und PHP-FPM laufen als Benutzer <code>www-data</code>. Damit WordPress Plugins und Bilder speichern kann, müssen ihm die Dateien gehören.`,
      cmd: "sudo chown -R www-data:www-data /var/www/wordpress && ls -ld /var/www/wordpress",
      check: { cmd: /chown\s+-R\s+www-data/, out: /www-data www-data/ } },
    { title: "wp-config.php: Zugangsdaten eintragen",
      text: `WordPress liest seine Datenbank-Zugangsdaten aus <code>wp-config.php</code>. Die Vorlage kopieren und die drei Platzhalter ersetzen:`,
      cmd: [`sudo -u www-data cp /var/www/wordpress/wp-config-sample.php /var/www/wordpress/wp-config.php`,
            `sudo -u www-data sed -i "s/database_name_here/wordpress/; s/username_here/wp/; s/password_here/Wp_Passwort_2026/" /var/www/wordpress/wp-config.php && grep -E "DB_(NAME|USER|PASSWORD)" /var/www/wordpress/wp-config.php`],
      check: { cmd: /grep/, out: /Wp_Passwort_2026/ },
      explain: `Auf echten Servern trägst du außerdem eigene <b>Sicherheitsschlüssel</b> ein (die Zeilen mit <code>put your unique phrase here</code>) – frische gibt es unter <code>https://api.wordpress.org/secret-key/1.1/salt/</code>. Und: <code>wp-config.php</code> enthält ein Passwort, also gehört sie nie in ein öffentliches Git-Repository.` },
    { title: "nginx-Server-Block auf Port 8081",
      text: `Fast wie bei LEMP – aber eigener Port, eigenes Verzeichnis, und <code>try_files … /index.php?$args</code>, damit schöne Adressen wie <code>/2026/11/mein-beitrag/</code> funktionieren.`,
      cmd: `sudo tee /etc/nginx/sites-available/wordpress << 'EOF'
server {
    listen 8081;
    server_name _;
    root /var/www/wordpress;
    index index.php;
    client_max_body_size 32M;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php-fpm.sock;
    }
}
EOF`, check: { cmd: /sites-available\/wordpress/ } },
    { title: "Aktivieren und testen",
      cmd: "sudo ln -sf /etc/nginx/sites-available/wordpress /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx && curl -sI http://localhost:8081/ | head -3",
      check: { cmd: /nginx\s+-t/, out: /successful/ },
      explain: `Die Antwort ist ein <b>302</b> – WordPress leitet zur Installation weiter (<code>wp-admin/install.php</code>). Das ist richtig so.` },
    { title: "Installation abschließen",
      text: `Öffne <a href="http://{{IP}}:8081/" target="_blank">http://{{IP}}:8081/</a> im Windows-Browser und folge dem Assistenten: Sprache, Titel, Admin-Benutzer, Passwort (aufschreiben!). Ist die Firewall aktiv: <code>sudo ufw allow 8081/tcp</code>.
        <br>Hast du im Browser installiert, klicke unten auf „Schritt überspringen“. <b>Oder</b> du schickst das Formular wie ein Admin-Skript per <code>curl</code>:`,
      cmd: `curl -s -d "weblog_title=Nordlicht+Blog&user_name=admin&admin_password=Admin_2026_sicher&admin_password2=Admin_2026_sicher&admin_email=admin@example.com&blog_public=0" "http://localhost:8081/wp-admin/install.php?step=2" | grep -o "Success\\|Erfolgreich\\|already installed" | head -1`,
      check: { cmd: /install\.php/, out: /Success|Erfolgreich|already installed/ },
      explain: `Fertig! Anmelden kannst du dich unter <a href="http://{{IP}}:8081/wp-admin/" target="_blank">http://{{IP}}:8081/wp-admin/</a>.` },
  ],
  outro: `WordPress läuft auf deinem eigenen Server – nichts davon hat die App für dich erledigt. In der nächsten Lektion schaust du in die Datenbank, die WordPress gerade angelegt hat.`,
},
{
  id: "db3-wp-sql", mode: "ssh", vm: "server", group: "db", topic: "db", stage: 3, title: "WordPress: SQL an der echten Datenbank",
  intro: `Alles, was WordPress speichert – Beiträge, Benutzer, Kommentare, Einstellungen – liegt in der Datenbank <code>wordpress</code>. Admins greifen dort direkt mit SQL ein, wenn die Weboberfläche nicht mehr hilft: vergessenes Passwort, falsche Adresse nach einem Umzug, Auswertungen.`,
  steps: [
    { title: "Was hat WordPress angelegt?",
      cmd: `sudo mariadb wordpress -e "SHOW TABLES;"`, check: { cmd: /show\s+tables/i, out: /wp_options/ },
      explain: `Alle Tabellen beginnen mit <code>wp_</code> – dem <b>Präfix</b> aus <code>wp-config.php</code>. Mehrere WordPress-Seiten könnten sich so eine Datenbank teilen.` },
    { title: "Die Adresse der Seite",
      text: `Zieht ein Server um oder ändert sich die IP, ist die Seite plötzlich nicht mehr erreichbar – WordPress leitet auf die alte Adresse um. Sie steht in <code>wp_options</code>:`,
      cmd: `sudo mariadb wordpress -e "SELECT option_name, option_value FROM wp_options WHERE option_name IN ('siteurl', 'home');"`,
      check: { cmd: /wp_options/, out: /siteurl/ },
      explain: `Repariert wird das mit <code>UPDATE wp_options SET option_value = 'http://NEUE-IP:8081' WHERE option_name IN ('siteurl', 'home');</code> – genau so geht man bei einem Umzug vor.` },
    { title: "Wer darf sich anmelden?",
      cmd: `sudo mariadb wordpress -e "SELECT ID, user_login, user_email, user_registered FROM wp_users;"`,
      check: { cmd: /wp_users/, out: /user_login/ },
      explain: `In <code>user_pass</code> steht kein Klartext, sondern ein <b>Hash</b> – auch du als Admin kannst das Passwort nicht lesen, nur ersetzen.` },
    { title: "Passwort vergessen? Per SQL zurücksetzen",
      text: `Der Klassiker: Die Chefin hat ihr Admin-Passwort vergessen, und die „Passwort vergessen“-Mail kommt nicht an. WordPress akzeptiert beim nächsten Login auch einen MD5-Hash und ersetzt ihn dann sofort durch einen sicheren.`,
      cmd: `sudo mariadb wordpress -e "UPDATE wp_users SET user_pass = MD5('Neu_2026_sicher') WHERE ID = 1; SELECT ID, user_login FROM wp_users WHERE ID = 1;"`,
      check: { cmd: /update\s+wp_users/i, out: /user_login/ },
      explain: `Melde dich ruhig mit dem neuen Passwort an. Danach steht in <code>user_pass</code> wieder ein sicherer Hash statt MD5. Wichtig: Wer SQL-Zugriff hat, hat damit praktisch Admin-Zugriff auf die Seite.` },
    { title: "Beiträge pro Autor: JOIN + GROUP BY",
      text: `Wie im Krimi – nur in einer echten Anwendung. <code>LEFT JOIN</code> zeigt auch Benutzer ohne Beiträge (mit 0).`,
      cmd: `sudo mariadb wordpress -e "SELECT u.user_login, COUNT(p.ID) AS beitraege FROM wp_users u LEFT JOIN wp_posts p ON p.post_author = u.ID AND p.post_type = 'post' AND p.post_status = 'publish' GROUP BY u.user_login;"`,
      check: { cmd: /group\s+by/i, out: /beitraege[\s\S]*?\s\d+\s/ } },   // mit Terminal: "| admin | 1 |", ohne: "admin<TAB>1"
    { title: "Deine Aufgabe: Kommentare pro Beitrag",
      task: `Gib für jeden veröffentlichten Beitrag (<code>post_type = 'post'</code>) den Titel (<code>post_title</code>) und die Anzahl seiner Kommentare aus. Kommentare stehen in <code>wp_comments</code>, die Spalte <code>comment_post_ID</code> verweist auf <code>wp_posts.ID</code>.`,
      hint: `Gleiches Muster wie eben: <code>FROM wp_posts p LEFT JOIN wp_comments c ON c.comment_post_ID = p.ID WHERE … GROUP BY p.ID, p.post_title</code>`,
      solution: `sudo mariadb wordpress -e "SELECT p.post_title, COUNT(c.comment_ID) AS kommentare FROM wp_posts p LEFT JOIN wp_comments c ON c.comment_post_ID = p.ID WHERE p.post_type = 'post' AND p.post_status = 'publish' GROUP BY p.ID, p.post_title;"`,
      check: { cmd: /join/i, out: /post_title/ },
      explain: `Ein frisches WordPress hat einen Beitrag („Hallo Welt!“ bzw. „Hello world!“) mit einem Beispielkommentar.` },
    { title: "Sicherung der WordPress-Datenbank",
      text: `Vor jedem Update gehört eine Sicherung dazu. <code>gzip</code> packt sie klein, das Datum im Namen hält mehrere Stände auseinander.`,
      cmd: "sudo mariadb-dump wordpress | gzip > ~/wordpress-$(date +%F).sql.gz && ls -lh ~/wordpress-*.sql.gz",
      check: { cmd: /mariadb-dump|mysqldump/, out: /wordpress-.*\.sql\.gz/ },
      explain: `Zu einer vollständigen WordPress-Sicherung gehört auch <code>/var/www/wordpress/wp-content</code> (Bilder, Plugins, Themes): <code>sudo tar czf ~/wp-content-$(date +%F).tgz -C /var/www/wordpress wp-content</code>.` },
  ],
  outro: `Du hast den ganzen Weg gemacht: SQL im Krimi gelernt, an einer Übungsdatenbank geübt und jetzt an einer echten Anwendung angewendet. Bereit für ④? Die Datenbank-Störfälle warten im Tab 🎯 Missionen.`,
},
);
