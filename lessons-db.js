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
);
