#!/usr/bin/env node
/* Baut die Online-Demo (statische Dateien für einen beliebigen Webserver) nach dist/demo.
 * Enthalten ist nur, was im Browser läuft: Mini-Linux (v86), Lektionen, Training, Wargame, Prüfung.
 * Server, VM-Steuerung und Sandbox bleiben draußen – die App erkennt die Demo am Hostnamen.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dist", "demo");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const files = new Set(["index.html", "style.css"]);
for (const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) files.add(m[1]);

fs.rmSync(OUT, { recursive: true, force: true });
let bytes = 0;
const copy = (rel) => {
  const src = path.join(ROOT, rel), dst = path.join(OUT, rel);
  if (!fs.existsSync(src)) throw new Error(`Datei fehlt: ${rel}`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  bytes += fs.statSync(src).size;
};
// lib/ und vm/ komplett – app.js lädt z. B. lib/v86.wasm und die VM-Abbilder erst zur Laufzeit
for (const dir of ["lib", "vm"]) for (const f of fs.readdirSync(path.join(ROOT, dir))) files.add(`${dir}/${f}`);
[...files].forEach(copy);
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
console.log(`Online-Demo gebaut: ${files.size} Dateien, ${(bytes / 1048576).toFixed(1)} MB → ${path.relative(ROOT, OUT)}`);
