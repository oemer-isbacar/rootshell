#!/usr/bin/env node
/* Prüft Missionen gegen die echte Übungs-VM (rs-uebung; mit --vm server gegen fis-lab):
 *   Setup → Prüfung muss SCHEITERN → Musterlösung → Prüfung muss BESTEHEN.
 * Vorher wird ein Snapshot angelegt und danach zurückgespielt – deine VM ist hinterher genau wie vorher.
 *
 *   npm run test:vm                  alle Linux-Missionen
 *   npm run test:vm -- mnet-dns ...  nur bestimmte Missionen
 *   npm run test:vm -- --no-snapshot ohne Sicherung/Zurückspielen (schneller, hinterlässt Spuren)
 *
 * Mission-Felder: test = Lösungsskript für den Test (sonst wird der Text aus solution genommen),
 *                 testFile = Pfad, unter dem die Lösung (ein Skript im <pre>) als ausführbare Datei abgelegt wird.
 */
"use strict";
const vmctl = require("../vmctl");
const MISSIONS = require("../missions");

const args = process.argv.slice(2);
const snapshot = !args.includes("--no-snapshot");
const vi = args.indexOf("--vm");
const VMID = vi >= 0 ? args[vi + 1] : "uebung";   // Missionen laufen in der App in der Übungs-VM
const ids = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--vm");
const SNAP = "vor-test";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (h) => h.replace(/<br\s*\/?>/g, "\n").replace(/<small>[\s\S]*?<\/small>/g, "").replace(/<[^>]+>/g, "")
  .replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").trim();
const last = (r) => (r.stdout + r.stderr).trim().split("\n").pop();

async function job(j) {
  if (j.error) throw new Error(j.error);
  for (;;) { const s = vmctl.getJob(j.id); if (s.done) { if (!s.ok) throw new Error(s.log.slice(-400)); return; } await sleep(2000); }
}

(async () => {
  const prof = vmctl.profile(VMID);
  const env = (await vmctl.env()).vms[prof.id];
  if (!env.vm || env.vm.state !== "Running") { console.error(`Die ${prof.label} (${prof.name}) läuft nicht – erst in rootshell starten.`); process.exit(2); }
  const list = MISSIONS.filter((m) => m.target !== "sandbox" && (m.track || "linux") === "linux" && (!ids.length || ids.includes(m.id)));
  if (!list.length) { console.error("Keine passenden Missionen."); process.exit(2); }

  if (snapshot) {
    console.log(`## Sicherung „${SNAP}“ anlegen …`);
    if (env.snapshots.some((s) => s.name === SNAP)) await job(vmctl.actions.deleteSnapshot({ vm: VMID, name: SNAP }));
    await job(vmctl.actions.snapshot({ vm: VMID, name: SNAP, comment: "automatischer Test" }));
    await sleep(5000);
  }

  let failed = 0;
  try {
    for (const m of list) {
      const t0 = Date.now();
      const s = await vmctl.execScript(m.setup, 300000, VMID);
      const v1 = await vmctl.execScript(m.verify, 60000, VMID);
      const fix = m.testFile
        ? `cat > ${m.testFile} << 'ROOTSHELL_EOF'\n${plain(m.solution)}\nROOTSHELL_EOF\nchmod 755 ${m.testFile}; chown ubuntu:ubuntu ${m.testFile}`
        : m.test || plain(m.solution);
      const sol = await vmctl.execScript(fix, 300000, VMID);
      const v2 = await vmctl.execScript(m.verify, 60000, VMID);
      const ok = s.ok && !v1.ok && v2.ok;
      if (!ok) failed++;
      console.log(`${ok ? "PASS" : "FAIL"}  ${m.id.padEnd(16)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)} s`);
      if (!ok) {
        console.log(`      setup=${s.ok} vorher-scheitert=${!v1.ok} nachher-besteht=${v2.ok}`);
        console.log(`      vorher:  ${last(v1)}\n      nachher: ${last(v2)}`);
        if (!s.ok) console.log(`      setup:   ${(s.stdout + s.stderr).trim().slice(-300)}`);
        if (!v2.ok) console.log(`      lösung:  ${(sol.stdout + sol.stderr).trim().slice(-300)}`);
      }
    }
  } finally {
    if (snapshot) {
      console.log(`## VM auf „${SNAP}“ zurücksetzen …`);
      await job(vmctl.actions.restore({ vm: VMID, name: SNAP }));
      await job(vmctl.actions.deleteSnapshot({ vm: VMID, name: SNAP }));
    }
  }
  console.log(`\n${list.length - failed} von ${list.length} Missionen bestanden.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("Fehler:", e.message); process.exit(2); });
