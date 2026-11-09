/* Inhalts-Test: prüft alle Lektionen, Karten, Missionen, Prüfungsfragen und Wargame-Level auf Vollständigkeit.
 * Läuft ohne VM und ohne Browser (npm test) – auch in GitHub Actions.
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// Inhaltsdateien in der Reihenfolge aus index.html laden – wie im Browser
const html = read("index.html");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !s.startsWith("lib/") && s !== "app.js");
const ctx = { window: {}, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const s of scripts) vm.runInContext(read(s), ctx, { filename: s });
const W = ctx.window;
const { LESSONS, DRILLS, QUIZ, WARGAME } = W;
const MISSIONS = require("../missions.js");
const appJs = read("app.js");
const GROUPS = Object.fromEntries([...appJs.match(/const GROUPS = \{([\s\S]*?)\};/)[1].matchAll(/"?([\w-]+)"?\s*:\s*"/g)].map((m) => [m[1], true]));

const uniq = (arr, what) => {
  const seen = new Set();
  for (const id of arr) { assert.ok(!seen.has(id), `${what}: doppelte ID ${id}`); seen.add(id); }
};

test("alle Inhaltsdateien sind eingebunden und werden ausgeliefert", () => {
  const server = read("server.js");
  for (const s of scripts.concat(["app.js", "style.css"])) assert.ok(server.includes(`"${s}"`), `${s} fehlt in PUBLIC (server.js)`);
  for (const f of fs.readdirSync(ROOT).filter((f) => /^lessons.*\.js$/.test(f))) assert.ok(scripts.includes(f), `${f} ist nicht in index.html eingebunden`);
});

test("Lektionen", () => {
  assert.ok(LESSONS.length > 50);
  uniq(LESSONS.map((l) => l.id), "Lektion");
  for (const l of LESSONS) {
    assert.ok(l.title && l.intro && Array.isArray(l.steps) && l.steps.length, `${l.id}: Titel, Intro oder Schritte fehlen`);
    assert.ok(["browser", "ssh", "ps", "win", "sql"].includes(l.mode || "browser"), `${l.id}: unbekannter mode ${l.mode}`);
    if (l.mode === "sql") assert.ok(W.SQL_DBS && W.SQL_DBS[l.db], `${l.id}: Datenbank ${l.db} fehlt in sql-cases.js`);
    assert.ok(GROUPS[l.group || l.mode || "browser"], `${l.id}: Gruppe ${l.group || l.mode} fehlt in GROUPS (app.js)`);
    l.steps.forEach((s, i) => {
      assert.ok(s.title, `${l.id} Schritt ${i + 1}: Titel fehlt`);
      if (s.check && typeof s.check !== "function") {
        assert.ok(s.check.cmd || s.check.out, `${l.id} Schritt ${i + 1}: check ohne cmd/out`);
        for (const k of ["cmd", "out", "notOut"]) if (s.check[k]) assert.strictEqual(Object.prototype.toString.call(s.check[k]), "[object RegExp]", `${l.id} Schritt ${i + 1}: check.${k} ist kein RegExp`);
      }
    });
  }
});

test("Lektionen: vorgeschlagene Befehle bestehen ihre eigene Prüfung (Befehlsteil)", () => {
  const bad = [];
  for (const l of LESSONS) l.steps.forEach((s, i) => {
    // Schritte mit eigener Aufgabe (task) wollen bewusst einen anderen Befehl als den gezeigten
    if (!s.check || typeof s.check === "function" || !s.check.cmd || !s.cmd || s.task) return;
    const cmds = [].concat(s.cmd).map((c) => c.replace(/\{\{IP\}\}/g, "10.0.0.5"));
    // mindestens einer der angebotenen Befehle (oder eine Zeile daraus) muss zum cmd-Muster passen
    const ok = cmds.some((c) => s.check.cmd.test(c) || c.split("\n").some((line) => s.check.cmd.test(line.trim())));
    if (!ok) bad.push(`${l.id} Schritt ${i + 1} „${s.title}“: ${s.check.cmd}`);
  });
  assert.deepStrictEqual(bad, [], "Diese Schritte lassen sich mit dem gezeigten Befehl nicht abschließen");
});

test("Lernpfad: Themen, Stufen und VMs", () => {
  const topics = new Set((W.TOPICS || []).map((t) => t.id));
  assert.ok(topics.size > 0, "topics.js definiert keine Themen");
  uniq((W.TOPICS || []).map((t) => t.id), "Thema");
  for (const l of LESSONS) {
    if (l.vm !== undefined) {
      assert.ok(["uebung", "server"].includes(l.vm), `${l.id}: vm muss "uebung" oder "server" sein`);
      assert.ok(["ssh", "ps"].includes(l.mode), `${l.id}: vm gibt es nur bei mode ssh/ps`);
    }
    if (l.prep !== undefined) {
      assert.strictEqual(l.vm, "uebung", `${l.id}: prep nur bei Übungen (vm: "uebung")`);
      assert.strictEqual(typeof l.prep, "string", `${l.id}: prep muss ein Skript (Text) sein`);
    }
    if (l.topic !== undefined || l.stage !== undefined) {
      assert.ok(topics.has(l.topic), `${l.id}: Thema ${l.topic} fehlt in topics.js`);
      assert.ok([1, 2, 3].includes(l.stage), `${l.id}: stage muss 1–3 sein`);
      if (l.stage === 1) assert.ok(["browser", "sql"].includes(l.mode || "browser"), `${l.id}: Stufe 1 (Lernen) läuft im Browser`);
      if (l.stage === 2 && ["ssh", "ps"].includes(l.mode)) assert.strictEqual(l.vm, "uebung", `${l.id}: Stufe 2 (Üben) läuft in der Übungs-VM`);
      if (l.stage === 3) assert.ok((l.vm || "server") === "server", `${l.id}: Stufe 3 (Anwenden) läuft auf der Server-VM`);
    }
  }
  for (const m of MISSIONS) if (m.topic !== undefined) assert.ok(topics.has(m.topic), `${m.id}: Thema ${m.topic} fehlt in topics.js`);
});

test("Server findet prep-Skripte nur über die Lektions-ID", () => {
  const server = read("server.js");
  assert.ok(/body\.lesson/.test(server) && !/body\.(prep|script)/.test(server), "server.js darf kein Skript aus dem Browser annehmen");
  const vmctl = read("vmctl.js");
  assert.ok(/const PROFILES = \{/.test(vmctl) && /function profile\(vm\)/.test(vmctl), "vmctl.js: VM-Profile fehlen");
});

test("Trainingskarten", () => {
  uniq(DRILLS.map((d) => d.id), "Karte");
  const ids = new Set(LESSONS.map((l) => l.id));
  for (const d of DRILLS) {
    assert.ok(d.q && d.a && d.check, `${d.id}: q, a oder check fehlt`);
    assert.ok([1, 2, 3].includes(d.lvl), `${d.id}: lvl muss 1–3 sein`);
    assert.ok(!d.after || ids.has(d.after), `${d.id}: after verweist auf unbekannte Lektion ${d.after}`);
    if (typeof d.check !== "function" && d.check.cmd) {
      const a = d.a.replace(/\{\{IP\}\}/g, "10.0.0.5");
      assert.ok(d.check.cmd.test(a), `${d.id}: die Musterlösung „${d.a}“ passt nicht zu ${d.check.cmd}`);
    }
  }
});

test("Missionen", () => {
  assert.ok(MISSIONS.length >= 30);
  uniq(MISSIONS.map((m) => m.id), "Mission");
  for (const m of MISSIONS) {
    for (const k of ["title", "story", "goal", "solution", "setup", "verify"]) assert.ok(m[k], `${m.id}: ${k} fehlt`);
    assert.ok([1, 2, 3].includes(m.level), `${m.id}: level muss 1–3 sein`);
    assert.ok(Array.isArray(m.hints) && m.hints.length >= 2, `${m.id}: mindestens 2 Tipps`);
    if ((m.track || "linux") === "linux" && m.target !== "sandbox") assert.ok(/(^|\n)\s*echo "✅|"✅/.test(m.verify), `${m.id}: verify meldet keinen Erfolg (✅)`);
  }
  // Freischaltung: es muss genug leichte Missionen geben
  for (const t of ["linux", "windows"]) {
    const ms = MISSIONS.filter((m) => (m.track || "linux") === t);
    assert.ok(ms.filter((m) => m.level === 1).length >= 2, `${t}: weniger als 2 Missionen der Stufe 1`);
  }
});

test("Prüfungsfragen", () => {
  assert.ok(QUIZ.length >= 50);
  uniq(QUIZ.map((q) => q.id), "Frage");
  for (const q of QUIZ) {
    assert.ok(q.q && q.topic && q.e, `${q.id}: q, topic oder e fehlt`);
    assert.ok(["linux", "windows", "all"].includes(q.track), `${q.id}: track ungültig`);
    assert.ok(Array.isArray(q.o) && q.o.length >= 3, `${q.id}: mindestens 3 Antworten`);
    assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length, `${q.id}: a zeigt auf keine Antwort`);
    assert.strictEqual(new Set(q.o).size, q.o.length, `${q.id}: doppelte Antworten`);
  }
  for (const t of ["linux", "windows"]) assert.ok(QUIZ.filter((q) => q.track === "all" || q.track === t).length >= 20, `${t}: zu wenige Fragen für eine Prüfung`);
});

test("Wargame-Level", () => {
  uniq(WARGAME.map((w) => w.id), "Level");
  for (const w of WARGAME) {
    assert.ok(w.title && w.task && w.hint && w.tools, `${w.id}: Felder fehlen`);
    const s = w.setup("FLAG{test-abc123}");
    assert.ok(typeof s === "string", `${w.id}: setup liefert keinen Text`);
    assert.ok(Buffer.from(s).toString("base64").length < 3500, `${w.id}: setup zu lang für die serielle Konsole`);
    assert.ok(!/\bbash\b|python|perl/.test(s), `${w.id}: setup nutzt Programme, die das Mini-Linux nicht hat`);
    assert.ok(!/\btar\s+-?\w*z/.test(s), `${w.id}: das BusyBox-tar im Mini-Linux kennt kein -z`);
  }
});

/* Subnetting-Generator aus app.js gegen eine unabhängige Rechnung prüfen */
test("Subnetting-Aufgaben rechnen richtig", () => {
  const src = appJs.slice(appJs.indexOf("const rnd = "), appJs.indexOf("const quizPool"));
  const sctx = { Math };
  vm.createContext(sctx);
  vm.runInContext(src + "\nthis.subnetTask = subnetTask;", sctx);
  const toInt = (s) => s.split(".").reduce((a, o) => a * 256 + +o, 0);
  for (let n = 0; n < 3000; n++) {
    const t = sctx.subnetTask();
    assert.ok(t.q && t.a && t.e, "Aufgabe unvollständig");
    const m = t.q.match(/<code>(?:(\d+\.\d+\.\d+\.\d+))?\/(\d+)<\/code>/);
    const need = t.q.match(/<b>(\d+) Geräte<\/b>/);
    if (need) {
      const p = +t.a.slice(1), h = 32 - p;
      assert.ok(2 ** h - 2 >= +need[1] && 2 ** (h - 1) - 2 < +need[1], `Präfix ${t.a} falsch für ${need[1]} Geräte`);
      continue;
    }
    const p = +m[2], size = 2 ** (32 - p);
    if (/nutzbare Hostadressen/.test(t.q)) { assert.strictEqual(+t.a, size - 2); continue; }
    if (/Subnetzmaske/.test(t.q)) { assert.strictEqual(toInt(t.a), 2 ** 32 - size); continue; }
    const ip = toInt(m[1]), net = ip - (ip % size);
    const want = /Netzadresse/.test(t.q) ? net : /Broadcast/.test(t.q) ? net + size - 1 : /erste/.test(t.q) ? net + 1 : net + size - 2;
    assert.strictEqual(toInt(t.a), want, `${t.q} → ${t.a}`);
  }
});

/* SQL-Lektionen: jede Musterlösung läuft fehlerfrei gegen die Fall-Datenbank (sql.js wie im Browser)
 * und besteht die eigene Schrittprüfung – mit derselben Fehlererkennung wie die App. */
test("SQL-Krimi: Musterlösungen bestehen ihre Prüfung", async () => {
  // sql.js aus lib/ laden (wie im Browser) – die CI läuft ohne npm install, node_modules gibt es dort nicht
  const initSqlJs = require(path.join(ROOT, "lib", "sql-wasm.js"));
  const SQL = await initSqlJs({ locateFile: (f) => path.join(ROOT, "lib", f) });
  const [, reSrc, reFlags] = appJs.match(/const ERR_LINE_RE = \/(.*)\/(\w*);/);
  const ERR = new RegExp(reSrc, reFlags);
  const errorLines = (out) => out.split("\n").filter((l) => ERR.test(l)).join("\n");
  const textOf = (res) => res.map((r) => [r.columns.join(" | "), ...r.values.map((v) => v.map((x) => (x === null ? "NULL" : String(x))).join(" | "))].join("\n")).join("\n\n");
  const sqlLessons = LESSONS.filter((l) => l.mode === "sql");
  assert.ok(sqlLessons.length >= 2, "zu wenige SQL-Lektionen");
  const bad = [];
  for (const l of sqlLessons) {
    const db = new SQL.Database();
    db.exec(W.SQL_DBS[l.db].sql);
    l.steps.forEach((s, i) => {
      const where = `${l.id} Schritt ${i + 1} „${s.title}“`;
      if (!s.check) return;
      if (!s.solution) { bad.push(`${where}: Musterlösung (solution) fehlt`); return; }
      let out;
      try { out = textOf(db.exec(s.solution)); } catch (e) { bad.push(`${where}: SQL-Fehler ${e.message}`); return; }
      const c = s.check;
      if (c.cmd && !c.cmd.test(s.solution)) bad.push(`${where}: Lösung passt nicht zu ${c.cmd}`);
      if (errorLines(out)) bad.push(`${where}: Ausgabe sieht wie ein Fehler aus`);
      if (c.out && !c.out.test(out)) bad.push(`${where}: Ausgabe passt nicht zu ${c.out}\n${out}`);
      if (c.notOut && c.notOut.test(out)) bad.push(`${where}: Ausgabe enthält ${c.notOut}`);
    });
    db.close();
  }
  assert.deepStrictEqual(bad, []);
});