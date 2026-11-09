/* Datenbanken für die SQL-Konsole (Modus "sql", sql.js = SQLite im Browser).
 * Jede Datenbank ist SQL-Text, der beim Öffnen einer Lektion frisch geladen wird (Lektionsfeld db: "<id>").
 * Nur SQL verwenden, das in SQLite UND MariaDB gleich funktioniert: Zeiten als Text 'YYYY-MM-DD HH:MM'.
 * Alle Personen, Firmen und Ereignisse sind frei erfunden.
 */
window.SQL_DBS = window.SQL_DBS || {};

/* ---------- Fall 2: Das Datenleck (offen ermitteln) ----------
 * Größere Datenbank: Ein Generator mit festem Startwert erzeugt zwei Arbeitswochen Alltagsrauschen
 * (Logins, CRM-Exporte, USB, Zutritte). Darin stecken die Spuren der Tatnacht am 30.10.
 * Lösung über INSERT INTO loesung – geprüft per Hash in lessons-db.js, nicht im Klartext.
 */
window.SQL_DBS.krimi2 = {
  title: "Fall 2 · Das Datenleck",
  get sql() {
    let seed = 20261103;
    const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const two = (n) => String(n).padStart(2, "0");
    const at = (day, h, m) => `${day} ${two(h)}:${two(m)}`;
    const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
    const P = [   // id, name, abteilung, benutzer, karte, rechner, raum
      [1, "Jonas Weber", "IT", "jweber", "K-104", "PC-101", "IT-Büro"], [2, "Mehmet Arslan", "IT", "marslan", "K-121", "PC-102", "IT-Büro"],
      [3, "Sabine Krüger", "Buchhaltung", "skrueger", "K-117", "PC-221", "Buchhaltung"], [4, "Elif Yıldız", "Buchhaltung", "eyildiz", "K-118", "PC-222", "Buchhaltung"],
      [5, "Ayşe Kaya", "IT", "akaya", "K-102", "PC-103", "IT-Büro"], [6, "Lena Schmidt", "Vertrieb", "lschmidt", "K-138", "PC-305", "Vertrieb"],
      [7, "Petra Hoffmann", "Personal", "phoffmann", "K-140", "PC-401", "Personal"], [8, "Murat Demir", "Lager", "mdemir", "K-150", "PC-501", "Lager"],
      [9, "Frank Neumann", "Geschäftsführung", "fneumann", "K-101", "PC-001", "Geschäftsführung"], [10, "Nina Wolf", "Lager", "nwolf", "K-151", "PC-502", "Lager"],
      [11, "Tobias Bauer", "Vertrieb", "tbauer", "K-133", "PC-307", "Vertrieb"], [12, "Kai Richter", "Vertrieb", "krichter", "K-135", "PC-306", "Vertrieb"],
      [13, "Jana Lorenz", "Vertrieb", "jlorenz", "K-139", "PC-308", "Vertrieb"], [14, "Ole Brandt", "Buchhaltung", "obrandt", "K-119", "PC-223", "Buchhaltung"],
    ];
    const days = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];
    const away = { 6: ["2026-10-27", "2026-11-07"], 11: ["2026-11-02", "2026-11-04"] };   // Urlaub (Lena) und krank (Tobias)
    const isAway = (id, d) => away[id] && d >= away[id][0] && d <= away[id][1];
    const usbOf = { 1: "SN-1043-JW", 2: "SN-2210-MA", 3: "SN-3317-SK", 12: "SN-7781-KR", 13: "SN-1390-JL", 9: "SN-0001-FN" };
    const L = [], X = [], U = [], Z = [];
    for (const d of days) for (const p of P) {
      const [id, , abt, user, karte, pc, raum] = p;
      if (isAway(id, d)) continue;
      const h = 7 + Math.floor(rnd() * 2), m = Math.floor(rnd() * 60);
      Z.push([karte, "Haupteingang", at(d, h, m)]);
      if (rnd() < 0.6) Z.push([karte, raum, at(d, h, Math.min(59, m + 3))]);
      if (rnd() < 0.08) L.push([user, pc, at(d, h, Math.min(59, m + 4)), 0]);
      L.push([user, pc, at(d, h, Math.min(59, m + 5)), 1]);
      if (rnd() < 0.5) Z.push([karte, "Kantine", at(d, 12, Math.floor(rnd() * 50))]);
      if ((abt === "Vertrieb" || abt === "Buchhaltung") && rnd() < 0.45) {
        const name = pick(["angebote", "kunden_calw", "offene_posten", "lieferanten", "kunden_nagold", "mahnungen", "umsatz_q3"]);
        X.push([user, pc, at(d, 9 + Math.floor(rnd() * 7), Math.floor(rnd() * 60)), `${name}_${d.slice(5).replace("-", "")}.csv`, 20 + Math.floor(rnd() * 380)]);
      }
      if (usbOf[id] && rnd() < 0.3) {
        const h2 = 10 + Math.floor(rnd() * 6), m2 = Math.floor(rnd() * 50);
        U.push([pc, usbOf[id], at(d, h2, m2), "eingesteckt"], [pc, usbOf[id], at(d, h2, m2 + 5 + Math.floor(rnd() * 4)), "ausgeworfen"]);
      }
    }
    // Die Tatnacht (Freitag, 30.10.)
    Z.push(["K-150", "Haupteingang", "2026-10-30 21:52"], ["K-150", "Lager", "2026-10-30 21:58"],
           ["K-135", "Haupteingang", "2026-10-30 22:51"], ["K-135", "Vertrieb", "2026-10-30 22:55"], ["K-135", "Haupteingang", "2026-10-30 23:31"]);
    L.push(["lschmidt", "PC-305", "2026-10-30 23:08", 0], ["lschmidt", "PC-305", "2026-10-30 23:09", 0], ["lschmidt", "PC-305", "2026-10-30 23:10", 1]);
    X.push(["lschmidt", "PC-305", "2026-10-30 23:14", "kunden_export_2026-10.csv", 4812]);
    U.push(["PC-305", "SN-7781-KR", "2026-10-30 23:16", "eingesteckt"], ["PC-305", "SN-7781-KR", "2026-10-30 23:19", "ausgeworfen"]);
    const byTime = (i) => (a, b) => (a[i] < b[i] ? -1 : a[i] > b[i] ? 1 : 0);
    L.sort(byTime(2)); X.sort(byTime(2)); U.sort(byTime(2)); Z.sort(byTime(2));
    const rows = (arr) => arr.map((r) => `(${r.map((v) => (typeof v === "number" ? v : q(v))).join(", ")})`).join(",\n ");
    return `
CREATE TABLE meldungen (id INTEGER PRIMARY KEY, zeit TEXT, von TEXT, text TEXT);
INSERT INTO meldungen VALUES
 (1, '2026-11-03 10:20', 'Datenschutzbeauftragte Dr. Haas', 'Im Forum „leakbase“ wird die Datei kunden_export_2026-10.csv mit 4812 Kundendatensätzen angeboten. Die Spaltennamen stammen eindeutig aus unserem CRM. Wer hat diese Daten exportiert? Wir müssen den Vorfall binnen 72 Stunden melden.'),
 (2, '2026-11-03 10:45', 'Ayşe Kaya (IT-Leitung)', 'Das CRM protokolliert jeden Export in crm_exporte. Für Logins, USB-Geräte und den Kartenleser gibt es eigene Tabellen. Wenn du den Täter hast: INSERT INTO loesung (name) VALUES (''Vorname Nachname'');');
CREATE TABLE mitarbeiter (id INTEGER PRIMARY KEY, name TEXT, abteilung TEXT, benutzer TEXT, karte TEXT);
INSERT INTO mitarbeiter VALUES
 ${rows(P.map((p) => p.slice(0, 5)))};
CREATE TABLE arbeitsplaetze (rechner TEXT PRIMARY KEY, raum TEXT, mitarbeiter_id INTEGER);
INSERT INTO arbeitsplaetze VALUES
 ${rows(P.map((p) => [p[5], p[6], p[0]]))};
CREATE TABLE abwesenheiten (mitarbeiter_id INTEGER, von TEXT, bis TEXT, art TEXT);
INSERT INTO abwesenheiten VALUES (6, '2026-10-27', '2026-11-07', 'Urlaub'), (11, '2026-11-02', '2026-11-04', 'krank'), (4, '2026-11-09', '2026-11-13', 'Urlaub');
CREATE TABLE logins (id INTEGER PRIMARY KEY, benutzer TEXT, rechner TEXT, zeit TEXT, erfolgreich INTEGER);
INSERT INTO logins (benutzer, rechner, zeit, erfolgreich) VALUES
 ${rows(L)};
CREATE TABLE crm_exporte (id INTEGER PRIMARY KEY, benutzer TEXT, rechner TEXT, zeit TEXT, datei TEXT, zeilen INTEGER);
INSERT INTO crm_exporte (benutzer, rechner, zeit, datei, zeilen) VALUES
 ${rows(X)};
CREATE TABLE usb_ereignisse (id INTEGER PRIMARY KEY, rechner TEXT, seriennr TEXT, zeit TEXT, aktion TEXT);
INSERT INTO usb_ereignisse (rechner, seriennr, zeit, aktion) VALUES
 ${rows(U)};
CREATE TABLE usb_inventar (seriennr TEXT PRIMARY KEY, mitarbeiter_id INTEGER, beschreibung TEXT);
INSERT INTO usb_inventar VALUES
 ${rows(Object.entries(usbOf).map(([id, sn]) => [sn, Number(id), "USB-Stick 64 GB (dienstlich)"]))};
CREATE TABLE zutritte (id INTEGER PRIMARY KEY, karte TEXT, raum TEXT, zeit TEXT);
INSERT INTO zutritte (karte, raum, zeit) VALUES
 ${rows(Z)};
CREATE TABLE loesung (name TEXT);
`;
  },
};

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
