/* Datenbanken für die SQL-Konsole (Modus "sql", sql.js = SQLite im Browser).
 * Jede Datenbank ist SQL-Text, der beim Öffnen einer Lektion frisch geladen wird (Lektionsfeld db: "<id>").
 * Nur SQL verwenden, das in SQLite UND MariaDB gleich funktioniert: Zeiten als Text 'YYYY-MM-DD HH:MM'.
 * Alle Personen, Firmen und Ereignisse sind frei erfunden.
 */
window.SQL_DBS = window.SQL_DBS || {};

/* ---------- Fall 1: Der verschwundene Laptop (Nordlicht Logistik GmbH) ---------- */
window.SQL_DBS.krimi1 = {
  title: "Fall 1 · Nordlicht Logistik",
  sql: `
CREATE TABLE meldungen (id INTEGER PRIMARY KEY, zeit TEXT, von TEXT, text TEXT);
INSERT INTO meldungen VALUES
 (1, '2026-10-24 07:40', 'Hausmeister Kowalski', 'Im Serverraum fehlt der Admin-Laptop LT-0815 aus dem Schrank. Darauf liegen die Zugangsdaten für die Backups.'),
 (2, '2026-10-24 07:55', 'Jonas Weber (IT)', 'Beim Abendrundgang am Freitag um 21:30 lag LT-0815 noch im Schrank. Danach habe ich abgeschlossen.');

CREATE TABLE mitarbeiter (id INTEGER PRIMARY KEY, name TEXT, abteilung TEXT, benutzer TEXT, karte TEXT);
INSERT INTO mitarbeiter VALUES
 (1, 'Jonas Weber', 'IT', 'jweber', 'K-104'),
 (2, 'Mehmet Arslan', 'IT', 'marslan', 'K-121'),
 (3, 'Sabine Krüger', 'Buchhaltung', 'skrueger', 'K-117'),
 (4, 'Tobias Bauer', 'Vertrieb', 'tbauer', 'K-133'),
 (5, 'Ayşe Kaya', 'IT', 'akaya', 'K-102'),
 (6, 'Lena Schmidt', 'Vertrieb', 'lschmidt', 'K-138'),
 (7, 'Petra Hoffmann', 'Personal', 'phoffmann', 'K-140'),
 (8, 'Murat Demir', 'Lager', 'mdemir', 'K-150'),
 (9, 'Elif Yıldız', 'Buchhaltung', 'eyildiz', 'K-118'),
 (10, 'Frank Neumann', 'Geschäftsführung', 'fneumann', 'K-101'),
 (11, 'Nina Wolf', 'Lager', 'nwolf', 'K-151'),
 (12, 'Kai Richter', 'Vertrieb', 'krichter', 'K-135');

CREATE TABLE geraete (id INTEGER PRIMARY KEY, inventarnr TEXT, typ TEXT, hostname TEXT, standort TEXT, status TEXT);
INSERT INTO geraete VALUES
 (1, 'LT-0815', 'Laptop', 'nl-lt-0815', 'Serverraum', 'vermisst'),
 (2, 'LT-0816', 'Laptop', 'nl-lt-0816', 'IT-Büro', 'ok'),
 (3, 'SRV-01', 'Server', 'nl-srv-01', 'Serverraum', 'ok'),
 (4, 'SRV-02', 'Server', 'nl-srv-02', 'Serverraum', 'ok'),
 (5, 'NAS-01', 'Speicher', 'nl-nas-01', 'Serverraum', 'ok'),
 (6, 'PC-221', 'PC', 'nl-pc-221', 'Buchhaltung', 'ok'),
 (7, 'PC-305', 'PC', 'nl-pc-305', 'Vertrieb', 'ok'),
 (8, 'DR-07', 'Drucker', 'nl-dr-07', 'Personal', 'defekt');

CREATE TABLE zutritte (id INTEGER PRIMARY KEY, karte TEXT, raum TEXT, zeit TEXT);
INSERT INTO zutritte (karte, raum, zeit) VALUES
 ('K-104', 'Serverraum', '2026-10-05 09:10'), ('K-121', 'Serverraum', '2026-10-07 14:20'),
 ('K-104', 'Serverraum', '2026-10-12 08:55'), ('K-102', 'Serverraum', '2026-10-14 11:30'),
 ('K-121', 'Serverraum', '2026-10-16 10:05'), ('K-104', 'Serverraum', '2026-10-19 09:02'),
 ('K-133', 'Kantine', '2026-10-21 12:10'), ('K-138', 'Kantine', '2026-10-21 12:12'), ('K-104', 'Kantine', '2026-10-21 12:30'),
 ('K-150', 'Lager', '2026-10-22 07:05'), ('K-151', 'Lager', '2026-10-22 07:20'),
 ('K-117', 'Kantine', '2026-10-22 12:05'), ('K-133', 'Kantine', '2026-10-22 12:08'), ('K-140', 'Kantine', '2026-10-22 12:10'),
 ('K-150', 'Kantine', '2026-10-22 12:15'), ('K-118', 'Kantine', '2026-10-22 12:20'), ('K-104', 'Kantine', '2026-10-22 12:50'),
 ('K-101', 'Haupteingang', '2026-10-23 07:45'), ('K-118', 'Haupteingang', '2026-10-23 07:58'), ('K-133', 'Haupteingang', '2026-10-23 08:20'),
 ('K-121', 'Haupteingang', '2026-10-23 08:31'), ('K-138', 'Haupteingang', '2026-10-23 08:40'),
 ('K-133', 'Kantine', '2026-10-23 12:02'), ('K-121', 'Kantine', '2026-10-23 12:15'),
 ('K-104', 'Haupteingang', '2026-10-23 20:50'), ('K-104', 'Serverraum', '2026-10-23 21:25'),
 ('K-117', 'Haupteingang', '2026-10-23 21:41'), ('K-117', 'Serverraum', '2026-10-23 21:47'),
 ('K-121', 'Haupteingang', '2026-10-23 22:20'), ('K-121', 'Serverraum', '2026-10-23 22:31');

CREATE TABLE tickets (id INTEGER PRIMARY KEY, mitarbeiter_id INTEGER, erstellt TEXT, betreff TEXT, status TEXT);
INSERT INTO tickets VALUES
 (1, 12, '2026-10-19 11:11', 'Neue Maus für den Arbeitsplatz', 'erledigt'),
 (2, 7, '2026-10-20 09:12', 'Drucker im Personalbüro druckt nicht', 'offen'),
 (3, 4, '2026-10-21 10:00', 'Laptop für Kundentermin ausleihen', 'abgelehnt'),
 (4, 3, '2026-10-22 13:02', 'Zugangskarte K-117 in der Kantine verloren', 'offen'),
 (5, 6, '2026-10-22 15:40', 'Passwort vergessen', 'erledigt'),
 (6, 9, '2026-10-23 08:15', 'Excel stürzt beim Speichern ab', 'offen'),
 (7, 1, '2026-10-23 21:31', 'Abendrundgang Serverraum: alles in Ordnung, abgeschlossen', 'erledigt'),
 (8, 2, '2026-10-23 22:25', 'Serverraum: Alarm der Klimaanlage', 'erledigt');

CREATE TABLE vpn_logins (id INTEGER PRIMARY KEY, benutzer TEXT, geraet TEXT, ip TEXT, zeit TEXT);
INSERT INTO vpn_logins (benutzer, geraet, ip, zeit) VALUES
 ('jweber', 'nl-lt-0816', '87.79.20.11', '2026-10-20 19:30'),
 ('akaya', 'nl-lt-0816', '93.199.4.8', '2026-10-21 21:05'),
 ('skrueger', 'nl-pc-221', '84.152.10.23', '2026-10-21 18:10'),
 ('skrueger', 'nl-pc-221', '84.152.10.23', '2026-10-23 21:15'),
 ('skrueger', 'nl-pc-221', '84.152.10.23', '2026-10-23 22:40'),
 ('marslan', 'nl-lt-0816', '178.4.92.17', '2026-10-24 08:10'),
 ('tbauer', 'nl-lt-0815', '91.64.3.120', '2026-10-25 19:03'),
 ('tbauer', 'nl-lt-0815', '91.64.3.120', '2026-10-25 19:41');
`,
};
