/* Teil 8 – Datenbanken (group "db", topic "db").
 * Lernpfad: ① SQL im Browser (folgt) → ② Üben in der Übungs-VM → ③ MariaDB auf der Server-VM (v8-db) → ④ Störfälle (folgen).
 * Übungen (vm: "uebung") laufen in der Wegwerf-VM; prep wird nach dem Zurücksetzen auf „basis“ als root ausgeführt.
 */
window.LESSONS.push(
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
