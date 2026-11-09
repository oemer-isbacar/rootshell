#!/usr/bin/env node
/* Spielt Lektionen auf der echten Übungs-VM durch: Jeder vorgeschlagene Befehl wird als Benutzer „ubuntu“
 * ausgeführt und mit derselben Prüfung bewertet wie in der App (Befehl + Ausgabe + Fehlererkennung).
 *
 *   npm run test:vm-lessons -- net1-ipv4 dev1-git     bestimmte Lektionen
 *   npm run test:vm-lessons -- --group net            eine ganze Gruppe (Teil)
 *   --snapshot   vorher sichern und danach zurückspielen (empfohlen – Lektionen installieren Software)
 *   --vm uebung|server   in welcher VM (Standard: die VM der ersten Lektion). Übungen mit prep werden vorher vorbereitet.
 *
 * Nur für Lektionen mit mode "ssh". Schritte ohne Befehl oder mit eigener Aufgabe (task) werden übersprungen.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vmctx = require("vm");
const vmctl = require("../vmctl");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const gi = args.indexOf("--group");
const group = gi >= 0 ? args[gi + 1] : null;
const vi = args.indexOf("--vm");
const ids = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--group" && args[i - 1] !== "--vm");
const snapshot = args.includes("--snapshot");
const SNAP = "vor-test";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Inhalte laden wie im Browser
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ctx = { window: {} }; ctx.window.window = ctx.window; vmctx.createContext(ctx);
for (const m of html.matchAll(/<script src="(lessons[^"]*|drills\.js)"><\/script>/g)) vmctx.runInContext(fs.readFileSync(path.join(ROOT, m[1]), "utf8"), ctx);
const LESSONS = ctx.window.LESSONS;

// Prüflogik aus app.js übernehmen (ERR_LINE_RE), damit Test und App gleich urteilen
const appJs = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const [, reSrc, reFlags] = appJs.match(/const ERR_LINE_RE = \/(.*)\/(\w*);/);
const ERR_LINE_RE = new RegExp(reSrc, reFlags);
const errorLines = (out) => out.split("\n").filter((l) => ERR_LINE_RE.test(l.replace(/\r/g, ""))).join("\n");
function runCheck(check, cmd, out) {
  if (typeof check === "function") return check(cmd, out);
  if (check.cmd && !check.cmd.test(cmd)) return false;
  if (check.notOut && check.notOut.test(out)) return false;
  const errs = check.err ? "" : errorLines(out);
  if (errs) return !!(check.out && check.out.test(errs));
  if (check.out && !check.out.test(out)) return false;
  return true;
}

async function job(j) {
  if (j.error) throw new Error(j.error);
  for (;;) { const s = vmctl.getJob(j.id); if (s.done) { if (!s.ok) throw new Error(s.log.slice(-400)); return; } await sleep(2000); }
}
// Befehl als ubuntu ausführen; Arbeitsverzeichnis bleibt zwischen den Befehlen erhalten (wie in einer echten Sitzung)
let PROF = vmctl.profile("server");
async function sh(cmd, ip) {
  const script = `cd "$(cat /tmp/.rs_cwd 2>/dev/null || echo ~)" 2>/dev/null || cd ~\n${cmd.replace(/\{\{IP\}\}/g, ip)}\npwd > /tmp/.rs_cwd`;
  const b64 = Buffer.from(script).toString("base64");
  const r = await vmctl.mp(["exec", PROF.name, "--", "sudo", "-u", "ubuntu", "-H", "bash", "-c", `echo ${b64} | base64 -d | bash 2>&1`], { timeout: 600000 });
  return (r.stdout + r.stderr).replace(/\r/g, "");
}

(async () => {
  const list = LESSONS.filter((l) => l.mode === "ssh" && (ids.includes(l.id) || (group && l.group === group)));
  if (!list.length) { console.error("Keine passenden Lektionen (Lektions-IDs oder --group angeben)."); process.exit(2); }
  const VMID = vi >= 0 ? args[vi + 1] : list[0].vm || "server";
  PROF = vmctl.profile(VMID);
  const env = (await vmctl.env()).vms[PROF.id];
  if (!env.vm || env.vm.state !== "Running") { console.error(`Die ${PROF.label} (${PROF.name}) läuft nicht.`); process.exit(2); }
  if (snapshot) {
    console.log(`## Sicherung „${SNAP}“ anlegen …`);
    if (env.snapshots.some((s) => s.name === SNAP)) await job(vmctl.actions.deleteSnapshot({ vm: VMID, name: SNAP }));
    await job(vmctl.actions.snapshot({ vm: VMID, name: SNAP, comment: "automatischer Test" }));
    await sleep(5000);
  }
  let failed = 0, total = 0;
  try {
    const ip = (await vmctl.env()).vms[PROF.id].vm.ip;
    await sh("rm -f /tmp/.rs_cwd", ip);
    for (const l of list) {
      console.log(`\n== ${l.id} · ${l.title}`);
      if (l.prep) {
        const p = await vmctl.execScript(l.prep, 600000, PROF.id);
        console.log(`   ${p.ok ? "OK  " : "FAIL"} prep (Übung vorbereiten)`);
        if (!p.ok) { failed++; console.log("        " + (p.stdout + p.stderr).trim().slice(-300)); continue; }
      }
      for (const [i, s] of l.steps.entries()) {
        if (!s.cmd || !s.check || s.task) { console.log(`   –   ${i + 1}. ${s.title} (übersprungen)`); continue; }
        total++;
        let ok = false, last = "";
        for (const c of [].concat(s.cmd)) {
          const out = await sh(c, ip);
          last = out;
          if (runCheck(s.check, c.replace(/\{\{IP\}\}/g, ip), out)) ok = true;
        }
        if (!ok) failed++;
        console.log(`   ${ok ? "OK  " : "FAIL"} ${i + 1}. ${s.title}`);
        if (!ok) console.log("        " + last.trim().split("\n").slice(-6).join("\n        "));
      }
    }
  } finally {
    if (snapshot) {
      console.log(`\n## VM auf „${SNAP}“ zurücksetzen …`);
      await job(vmctl.actions.restore({ vm: VMID, name: SNAP }));
      await job(vmctl.actions.deleteSnapshot({ vm: VMID, name: SNAP }));
    }
  }
  console.log(`\n${total - failed} von ${total} Schritten bestanden.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("Fehler:", e.message); process.exit(2); });
