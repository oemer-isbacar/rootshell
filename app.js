/* rootshell – echtes Linux (v86 im Browser) oder Übungs-VM per SSH + Tutorial, Training, Missionen */
"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const PROMPT_RE = /(?:^|\n)[^\n]*[#$%] $/;
const INPUT_RE = /^[^#$%]*[#$%] (.*)$/;
const PS_PROMPT_RE = /(?:^|\n)PS [^\n]*> ?$/;   // PowerShell: "PS /home/ubuntu> " (Windows-ConPTY lässt das Leerzeichen weg)
const PS_INPUT_RE = /^PS [^>]*> (.*)$/;
const isPS = () => mode === "ps" || mode === "win";
const promptRe = () => (isPS() ? PS_PROMPT_RE : PROMPT_RE);
const ANSI_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?<>=]*[ -\/]*[@-~]|\x1b[()][0-9A-Za-z]|\x1b[=>78NOMDEHc]|[\r\x07]/g;
const KEYS = { progress: "linuxlab.progress.v1", ssh: "linuxlab.ssh.v1", drills: "linuxlab.drills.v1", missions: "linuxlab.missions.v1", settings: "linuxlab.settings.v1",
  wargame: "linuxlab.wargame.v1", exam: "linuxlab.exam.v1" };
const PARAMS = new URLSearchParams(location.search);
// Online-Demo (statisch gehostet): kein lokaler Server → nur Mini-Linux, Training, Wargame und Prüfung
const STATIC = PARAMS.has("demo") || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const REPO_URL = "https://github.com/oemer-isbacar/rootshell";
const DEMO_MSG = `Das geht nur in der installierten Version (Übungs-VM bzw. Windows-Sandbox auf deinem PC). <a href="${REPO_URL}#installation" target="_blank" rel="noopener">So installierst du rootshell</a>.`;

function load(key, def) { try { return Object.assign(def, JSON.parse(localStorage.getItem(key) || "{}")); } catch { return def; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Zustand ---------- */
let progress = load(KEYS.progress, { lesson: 0, lessonId: null, done: {}, events: {} });
const saveProgress = () => save(KEYS.progress, progress);
const doneSet = (id) => new Set(progress.done[id] || []);
let settings = load(KEYS.settings, { idleMin: 30, tab: "lessons" });
const saveSettings = () => save(KEYS.settings, settings);
let drillState = load(KEYS.drills, { cards: {}, newDay: "", newCount: 0 });
let missionState = load(KEYS.missions, { m: {} });

/* ---------- Snapshot des Mini-Linux (IndexedDB) ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("linuxlab", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction("state").objectStore("state").get(key);
      q.onsuccess = () => res(q.result); q.onerror = () => res(undefined);
    });
  } catch { return undefined; }
}
async function idbPut(key, val) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction("state", "readwrite");
    val === undefined ? tx.objectStore("state").delete(key) : tx.objectStore("state").put(val, key);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

/* ---------- Server-API ---------- */
async function api(path, body) {
  if (STATIC) return { error: "In der Online-Demo nicht verfügbar – dafür rootshell lokal installieren." };
  const r = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-LinuxLab": "1", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({ error: "Ungültige Antwort" }));
  if (!r.ok && !j.error) j.error = "HTTP " + r.status;
  return j;
}

/* ---------- Terminal ---------- */
const term = new Terminal({
  cursorBlink: true,
  fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
  fontSize: 15,
  theme: { background: "#000000", foreground: "#e6e8ee", cursor: "#4ade80", selectionBackground: "#334155" },
  scrollback: 5000,
});
const fit = new FitAddon.FitAddon();
term.loadAddon(fit);
term.open($("#terminal"));
fit.fit();

let mode = "browser";     // "browser" | "ssh" | "ps"
let tracking = null;      // { cmd, out } – laufender Befehl
let promptTimer = null;
let lastActivity = Date.now();

/* ===== Backend 1: Mini-Linux im Browser (v86) ===== */
const vm = {
  emulator: null, loggedIn: false, bootLog: "", scroll: "",
  // serielle Schnittstelle arbeitet byteweise → Umlaute als UTF-8-Bytes senden
  send(s) { this.emulator?.serial0_send(unescape(encodeURIComponent(s))); },
  resize() { if (this.loggedIn) this.send(`stty rows ${term.rows} cols ${term.cols}\n`); },
};
const decoder = new TextDecoder();
let vmPending = "", vmFlushScheduled = false;

function vmOnByte(b) {
  vmPending += decoder.decode(new Uint8Array([b]), { stream: true });
  if (!vmFlushScheduled) { vmFlushScheduled = true; setTimeout(vmFlush, 0); }
}
function vmFlush() {
  vmFlushScheduled = false;
  const chunk = vmPending; vmPending = "";
  vm.scroll = (vm.scroll + chunk).slice(-60000);
  const clean = chunk.replace(ANSI_RE, "");
  if (mode === "browser") term.write(chunk);
  if (!vm.loggedIn) {
    vm.bootLog = (vm.bootLog + clean).slice(-400);
    if (/login: ?$/.test(vm.bootLog)) { vm.bootLog = ""; vm.send("root\n"); }
    else if (PROMPT_RE.test(vm.bootLog)) {
      vm.loggedIn = true; vm.bootLog = "";
      vm.send(`stty rows ${term.rows} cols ${term.cols}; export PS1='\\w # '; cd ~; clear\n`);
      if (mode === "browser") { updateStatus(); setTimeout(() => term.focus(), 200); if (settings.tab === "wargame") renderWargame(); }
    }
    return;
  }
  if (mode === "browser") trackOutput(clean);
}

async function vmBoot() {
  const snapshot = await idbGet("snapshot");
  const opts = {
    wasm_path: "lib/v86.wasm",
    memory_size: 128 * 1024 * 1024,
    vga_memory_size: 2 * 1024 * 1024,
    bios: { url: "vm/seabios.bin" },
    vga_bios: { url: "vm/vgabios.bin" },
    bzimage: { url: "vm/buildroot-bzimage68.bin" },
    cmdline: "tsc=reliable mitigations=off random.trust_cpu=on console=ttyS0 quiet",
    autostart: true, disable_keyboard: true, disable_mouse: true, disable_speaker: true,
  };
  if (snapshot) { opts.initial_state = { buffer: snapshot }; vm.loggedIn = true; }
  vm.emulator = new V86(opts);
  vm.emulator.add_listener("serial0-output-byte", vmOnByte);
  if (snapshot) {
    vm.emulator.add_listener("emulator-ready", () => {
      if (mode === "browser") term.writeln("\x1b[32mGespeicherter Zustand wiederhergestellt.\x1b[0m");
      setTimeout(() => { vm.send("\n"); vm.resize(); updateStatus(); }, 300);
    });
  }
}

/* ===== Backend 2+3: Echte VM per SSH – bash ("ssh") oder PowerShell 7 ("ps") ===== */
function makeRemote(modeName, shell) { return {
  mode: modeName, shell, ws: null, connected: false, connecting: false, scroll: "", target: "",
  send(s) { if (this.connected) this.ws.send(JSON.stringify({ type: "data", data: s })); },
  resize() { if (this.connected) this.ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })); },
  managedVm: null,   // "uebung" | "server", wenn mit einer App-VM verbunden; null = fremde Maschine
  connect(opts) {
    this.disconnect();
    this.managedVm = null;
    if (STATIC) return;
    this.connecting = true; this.target = opts.target === "sandbox" ? "Windows-Sandbox" : `${opts.username}@${opts.host}`;
    updateStatus();
    const ws = new WebSocket(`ws://${location.host}/ssh`);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "connect", ...opts, shell: this.shell, cols: term.cols, rows: term.rows }));
    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;   // Nachzügler einer alten Verbindung ignorieren
      const m = JSON.parse(ev.data);
      if (m.type === "ready") {
        this.connected = true; this.connecting = false;
        updateStatus(); markEvent("ssh-connected");
        if (settings.tab === "lessons" && this.mode !== "win") renderLesson();
        if (mode === this.mode) term.focus();
      } else if (m.type === "data") {
        this.scroll = (this.scroll + m.data).slice(-60000);
        if (mode === this.mode) { term.write(m.data); trackOutput(m.data.replace(ANSI_RE, "")); }
      } else if (m.type === "error") {
        if (mode === this.mode) {
          term.writeln(`\r\n\x1b[31mVerbindung fehlgeschlagen: ${m.message}\x1b[0m`);
          term.writeln(this.mode === "win" ? "\x1b[90mLäuft die Sandbox? → oben „▶ Sandbox starten“\x1b[0m" : "\x1b[90mLäuft die VM? Stimmen IP, Benutzer und Passwort? → ⚙ VM-Zentrale\x1b[0m");
        }
      }
    };
    ws.onerror = () => { if (this.ws === ws && mode === this.mode) term.writeln("\r\n\x1b[31mKein Kontakt zum rootshell-Server. Läuft start.bat noch?\x1b[0m"); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      const was = this.connected;
      this.connected = false; this.connecting = false; this.ws = null;
      if (mode === this.mode && was) term.writeln("\r\n\x1b[33mVerbindung getrennt.\x1b[0m");
      updateStatus();
      if (was && settings.tab === "lessons" && this.mode !== "win") renderLesson();
    };
  },
  disconnect() { if (this.ws) { this.ws.close(); this.ws = null; } this.connected = false; this.connecting = false; if (typeof updateStatus === "function") updateStatus(); },
}; }
const ssh = makeRemote("ssh");
const ps = makeRemote("ps", "pwsh");
const win = makeRemote("win");   // echte Windows PowerShell 5.1 in der Windows-Sandbox
/* ===== Backend 4: SQL-Konsole (sql.js = SQLite als WebAssembly, läuft komplett im Browser) ===== */
const sqlb = {
  SQL: null, db: null, dbId: null, loading: null, history: [], hpos: 0,
  send() {}, resize() {},
  /* sql.js einmalig laden */
  init() {
    if (this.SQL) return Promise.resolve(this.SQL);
    if (typeof initSqlJs !== "function") return Promise.reject(new Error("sql.js fehlt (lib/sql-wasm.js)"));
    return (this.loading ||= initSqlJs({ locateFile: (f) => "lib/" + f }).then((S) => (this.SQL = S)));
  },
  /* Datenbank eines Falls laden (frisch), sofern nicht schon geladen */
  async use(id, { fresh = false } = {}) {
    if (!fresh && this.db && this.dbId === id) return;
    const src = (window.SQL_DBS || {})[id];
    if (!src) throw new Error(`Unbekannte Datenbank: ${id}`);
    const S = await this.init();
    if (this.db) this.db.close();
    this.db = new S.Database();
    this.db.exec(src.sql);
    this.dbId = id;
    sqlRenderSchema();
    $("#sql-dbname").textContent = `· Datenbank: ${src.title}`;
  },
};
/* Ergebnis als Text (für die Schrittprüfung): Kopfzeile, dann je Zeile „wert | wert“ */
const sqlText = (res) => res.map((r) => [r.columns.join(" | "), ...r.values.map((v) => v.map((x) => (x === null ? "NULL" : String(x))).join(" | "))].join("\n")).join("\n\n");
function sqlTable(r) {
  const head = r.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const rows = r.values.slice(0, 500).map((v) => `<tr>${v.map((x) => x === null ? `<td class="null">NULL</td>` : `<td${typeof x === "number" ? ' class="num"' : ""}>${escapeHtml(x)}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
    <p class="sql-msg">${r.values.length} Zeile${r.values.length === 1 ? "" : "n"}${r.values.length > 500 ? " (die ersten 500 angezeigt)" : ""}</p>`;
}
function sqlRenderSchema() {
  const el = $("#sql-schema");
  if (!sqlb.db) { el.innerHTML = ""; return; }
  const tables = sqlb.db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.map((v) => v[0]) || [];
  el.innerHTML = `<div class="muted small">Tabellen – Klick zeigt alle Zeilen</div>` + tables.map((t) => {
    const cols = sqlb.db.exec(`PRAGMA table_info("${t.replace(/"/g, "")}")`)[0]?.values.map((v) => v[1]) || [];
    return `<h5><button data-sqltable="${escapeHtml(t)}" title="SELECT * FROM ${escapeHtml(t)};">${escapeHtml(t)}</button></h5><ul>${cols.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`;
  }).join("");
}
async function sqlRun(q = $("#sql-input").value) {
  q = q.trim();
  if (!q) return;
  lastActivity = Date.now();
  const out = $("#sql-out");
  const lesson = LESSONS[progress.lesson];
  try { await sqlb.use(lesson?.mode === "sql" && lesson.db ? lesson.db : sqlb.dbId || Object.keys(window.SQL_DBS || {})[0]); }
  catch (e) { out.innerHTML = `<p class="sql-msg err">${escapeHtml(e.message)}</p>`; return; }
  if (sqlb.history[sqlb.history.length - 1] !== q) sqlb.history.push(q);
  sqlb.hpos = sqlb.history.length;
  let text;
  try {
    const res = sqlb.db.exec(q);
    const changed = sqlb.db.getRowsModified();
    if (res.length) { out.innerHTML = res.map(sqlTable).join(""); text = sqlText(res); }
    else { out.innerHTML = `<p class="sql-msg ok">✓ Ausgeführt${changed ? ` – ${changed} Zeile${changed === 1 ? "" : "n"} geändert` : " – keine Ergebniszeilen"}.</p>`; text = changed ? `${changed} rows affected` : ""; }
    if (/^\s*(create|drop|alter)\b/i.test(q)) sqlRenderSchema();
  } catch (e) {
    out.innerHTML = `<p class="sql-msg err">Fehler: ${escapeHtml(e.message)}</p>`;
    text = "ERROR: " + e.message;   // zählt in der Prüfung als Fehlerzeile
  }
  onCommandFinished(q, text);
  // Offene Fälle: nach INSERT INTO loesung klar sagen, ob der Name stimmt (die Prüfung selbst ist ein Hash)
  const solveIdx = lesson?.steps.findIndex((s) => s.testSolution);
  if (lesson && solveIdx >= 0 && /insert\s+into\s+loesung/i.test(q) && !text.startsWith("ERROR")) {
    out.insertAdjacentHTML("beforeend", doneSet(lesson.id).has(solveIdx)
      ? `<p class="sql-msg ok">🎉 Richtig – Fall gelöst! Die Auflösung steht rechts in der Lektion.</p>`
      : `<p class="sql-msg err">❌ Das ist nicht der Täter. Prüfe deine Spuren noch einmal – die Tipps rechts helfen.</p>`);
  }
}
$("#sql-go").addEventListener("click", () => sqlRun());
$("#sql-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sqlRun(); return; }
  if ((e.key === "ArrowUp" || e.key === "ArrowDown") && (e.ctrlKey || e.metaKey) && sqlb.history.length) {
    e.preventDefault();
    sqlb.hpos = Math.max(0, Math.min(sqlb.history.length, sqlb.hpos + (e.key === "ArrowUp" ? -1 : 1)));
    e.target.value = sqlb.history[sqlb.hpos] || "";
  }
});
$("#sql-schema").addEventListener("click", (e) => {
  const t = e.target.closest("[data-sqltable]");
  if (t) { const q = `SELECT * FROM ${t.dataset.sqltable};`; $("#sql-input").value = q; sqlRun(q); }
});
$("#sql-reset").addEventListener("click", async () => {
  const id = sqlb.dbId || LESSONS[progress.lesson]?.db;
  if (!id) return;
  await sqlb.use(id, { fresh: true });
  $("#sql-out").innerHTML = `<p class="sql-msg ok">↺ Datenbank frisch geladen.</p>`;
});
/* Datenbank der aktuellen SQL-Lektion bereitstellen */
function sqlEnsure(lesson) {
  if (lesson?.mode !== "sql" || !lesson.db) return;
  sqlb.use(lesson.db).catch((e) => { $("#sql-out").innerHTML = `<p class="sql-msg err">${escapeHtml(e.message)}</p>`; });
}

const isRemote = () => mode === "ssh" || mode === "ps";
const remote = () => (mode === "ps" ? ps : mode === "win" ? win : ssh);
const vmMode = () => (settings.track === "windows" ? "ps" : "ssh");
function disconnectAll() { ssh.disconnect(); ps.disconnect(); }
let pwshInstalling = false;

/* ---------- Windows-Sandbox ---------- */
let sb = { state: "unknown" };   // unavailable | off | starting | ready
let sbTimer = null;
async function refreshSandbox() {
  if (STATIC) { sb = { state: "demo" }; updateStatus(); return sb; }
  try { sb = await api("sandbox"); } catch { sb = { state: "unknown" }; }
  updateStatus();
  if (mode === "win" && sb.state === "ready" && !win.connected && !win.connecting) connectSandbox();
  if (settings.tab === "missions") renderMissions();
  if (settings.tab === "lessons" && LESSONS[progress.lesson]?.mode === "win") renderLesson();
  clearTimeout(sbTimer);
  // während des Starts oft nachsehen, sonst selten
  sbTimer = setTimeout(refreshSandbox, sb.state === "starting" ? 3000 : mode === "win" || sb.running ? 15000 : 60000);
  return sb;
}
function connectSandbox() {
  if (mode === "win") { term.reset(); win.scroll = ""; }
  win.connect({ target: "sandbox" });
}
async function startSandbox() {
  if (sb.state === "unavailable") { toast("Die Windows-Sandbox ist auf diesem PC nicht aktiviert."); return; }
  const r = await api("sandbox/start", {});
  if (r.error) { toast(r.error); return; }
  if (mode === "win") term.writeln("\r\n\x1b[36m🪟 Windows-Sandbox startet … (beim ersten Mal bis zu 2 Minuten, danach meist unter einer Minute)\x1b[0m\r\n\x1b[90mEs öffnet sich ein Fenster mit einem frischen Windows – das kannst du minimieren. Schließt du es, ist die Sandbox weg.\x1b[0m");
  sb.state = "starting"; updateStatus();
  refreshSandbox();
}
async function stopSandbox(ask = true) {
  if (ask && !confirm("Windows-Sandbox beenden?\nAlles darin (Benutzer, Dateien, Einstellungen) wird gelöscht – beim nächsten Start ist sie wieder frisch.")) return;
  win.disconnect();
  if (mode === "win") term.writeln("\r\n\x1b[33m⏹ Sandbox wird beendet …\x1b[0m");
  sb.state = "stopping"; updateStatus();
  await api("sandbox/stop", {});
  await refreshSandbox();
  if (mode === "win") term.writeln("\x1b[33mSandbox beendet. Mit „▶ Sandbox starten“ bekommst du ein frisches Windows.\x1b[0m");
}
$("#btn-sb-start").addEventListener("click", startSandbox);
$("#btn-sb-stop").addEventListener("click", () => stopSandbox());

/* Mit einer App-VM verbinden – standardmäßig mit der, die die aktuelle Lektion/Mission braucht */
async function connectManaged({ quiet, vm: want } = {}) {
  const R = mode === "ps" ? ps : ssh;
  const id = want || wantedVm();
  if (R.connecting) return false;   // läuft schon
  if (R.connected && R.managedVm === id) return true;
  if (activeVm !== id || (R.connected && R.managedVm !== id)) { disconnectAll(); activeVm = id; }
  R.connecting = true; updateStatus();
  const r = await api("vm/prepare-ssh", { vm: id });
  R.connecting = false;
  if (r.error || !r.host) {
    updateStatus();
    if (!quiet) toast(r.error || "VM nicht bereit");
    return false;
  }
  if (R === ps && !r.pwsh) {
    // PowerShell fehlt in der VM → einmalig nachinstallieren, dann verbinden
    if (pwshInstalling) return false;
    pwshInstalling = true;
    if (mode === "ps") term.writeln("\x1b[36m⚡ PowerShell 7 wird in deiner VM installiert (einmalig, ca. 1 Minute) …\x1b[0m");
    const ok = await startJob("vm/installPwsh", { vm: id });
    pwshInstalling = false;
    if (!ok) { if (mode === "ps") term.writeln("\x1b[31mInstallation fehlgeschlagen – Details in der ⚙ VM-Zentrale.\x1b[0m"); return false; }
    return connectManaged({ quiet, vm: id });
  }
  if (mode === R.mode) { term.reset(); R.scroll = ""; }
  R.connect({ host: r.host, username: r.username, managed: true });
  R.managedVm = id;
  return true;
}

/* ===== Gemeinsam: Befehle verfolgen ===== */
const backend = () => (mode === "browser" ? vm : mode === "sql" ? sqlb : mode === "ps" ? ps : mode === "win" ? win : ssh);

// Nur den Prompt am Ende entfernen – Ausgaben ohne Zeilenende (z. B. curl) kleben sonst davor und gingen verloren
const stripPrompt = (o) => isPS() ? o.replace(/PS [^\n]*> ?$/, "") : o.replace(/(?:[\w.-]+@[\w.-]+:[^\n]*?|(?:^|\n)[~\/][^\n\s]*\s?)?[#$%] $/, "");

function trackOutput(clean) {
  if (!tracking) return;
  tracking.out += clean;
  clearTimeout(promptTimer);
  promptTimer = setTimeout(() => {
    // Windows-ConPTY zeichnet nach Fortschrittsbalken Bildschirmteile neu → dann steht der Prompt nicht am Ende
    // der Ausgabe. Deshalb zusätzlich die Zeile am Cursor prüfen.
    const atPrompt = () => {
      if (mode !== "win") return false;
      const b = term.buffer.active;
      return /^PS [^>\n]*> ?$/.test(b.getLine(b.baseY + b.cursorY)?.translateToString(true) ?? "");
    };
    if (tracking && (promptRe().test(tracking.out) || atPrompt())) {
      const t = tracking; tracking = null;
      if (t.cmd) onCommandFinished(t.cmd, stripPrompt(t.out));
    }
  }, 150);
}

/* Aktuelle Eingabezeile aus dem Terminal-Puffer lesen (funktioniert auch mit ↑ und Tab) */
function currentInputLine() {
  const buf = term.buffer.active;
  let y = buf.baseY + buf.cursorY;
  let text = buf.getLine(y)?.translateToString(true) ?? "";
  // Windows-ConPTY: füllt die Eingabe die Zeile exakt, steht der Cursor schon in der nächsten (leeren) Zeile
  if (!text && buf.cursorX === 0 && y > 0 && !buf.getLine(y)?.isWrapped) { y--; text = buf.getLine(y)?.translateToString(true) ?? ""; }
  while (y > 0 && buf.getLine(y)?.isWrapped) {
    y--;
    text = (buf.getLine(y)?.translateToString(true) ?? "") + text;
  }
  const m = text.match(isPS() ? PS_INPUT_RE : INPUT_RE);
  return m ? m[1].trim() : null;
}

let lastInserted = null;   // mehrzeiliger Befehl aus dem Tutorial (Here-Docs etc.)
let pasting = false;
term.onData((data) => {
  lastActivity = Date.now();
  if (data.includes("\r") && !pasting && !data.startsWith("\x1b[200~")) {
    const inserted = lastInserted; lastInserted = null;
    const prev = tracking;
    const t = { cmd: null, out: "" };
    tracking = t;
    // erst alle ausstehenden Ausgaben verarbeiten lassen, dann die Eingabezeile lesen
    term.write("", () => {
      t.cmd = inserted || currentInputLine();
      if (!t.cmd && tracking === t) {
        // Enter innerhalb eines Programms (vi, Passwortabfrage …) → laufenden Befehl weiter verfolgen
        tracking = prev && prev.cmd ? prev : null;
        if (tracking) tracking.out += t.out;
      }
    });
  }
  // Die BusyBox-Shell im Mini-Linux kennt kein UTF-8: ein getipptes „Ü“ sind 2 Bytes, Backspace löscht nur eins
  // → unsichtbarer Rest in der Zeile. Deshalb Umlaute beim Tippen umschreiben (ä→ae …), Rest weglassen.
  if (mode === "browser" && /[^\x00-\x7f]/.test(data)) {
    const map = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss", "€": "EUR", "§": "", "´": "'", "`": "`" };
    data = data.replace(/[^\x00-\x7f]/g, (c) => map[c] ?? "");
    if (!umlautHint) { umlautHint = true; toast("Das Mini-Linux versteht keine Umlaute in der Eingabe – ä/ö/ü/ß werden zu ae/oe/ue/ss."); }
    if (!data) return;
  }
  backend().send(data);
});
let umlautHint = false;

function insertCommand(text) {
  if (mode === "sql") { const i = $("#sql-input"); i.value = text; i.focus(); return; }
  const multi = text.includes("\n");
  lastInserted = multi ? text : null;
  backend().send("\x15");  // Strg+U leert vorher die Zeile
  if (multi) { pasting = true; term.paste(text); pasting = false; }  // als Block einfügen (bash nimmt ihn am Stück)
  else backend().send(text);
  term.focus();
}

let resizeTimer, sizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => fit.fit(), 100); });
term.onResize(() => { clearTimeout(sizeTimer); sizeTimer = setTimeout(() => backend().resize(), 300); });

/* ---------- Status oben ---------- */
let env = null;          // letzter Stand von /api/env
let job = null;          // laufender VM-Job
let lastAutoConnect = 0; // letzter automatischer Verbindungsversuch
/* Zwei App-VMs: Übungs-VM (Wegwerf: Übungen, Missionen) und Server-VM (bleibt: dein Server) */
let activeVm = "server";  // mit welcher VM das Terminal (ssh/ps) arbeitet
let prepared = null;      // ID der Übung, die in dieser Sitzung in der Übungs-VM vorbereitet wurde
let preparing = false;    // Vorbereitung läuft gerade
let preparedMini = null;  // ID der Browser-Lektion, deren Übungsdaten im Mini-Linux bereitstehen
const VM_IDS = ["uebung", "server"];
const VM_LABEL = { uebung: "🧪 Übungs-VM", server: "🖥 Server-VM" };
const VM_PLAIN = { uebung: "Übungs-VM", server: "Server-VM" };
const vmEnv = (id = activeVm) => env?.vms?.[id] || null;
function vmState(id = activeVm) { return vmEnv(id)?.vm?.state || (env ? "none" : "unknown"); }
function vmIP(id = activeVm) { return vmEnv(id)?.vm?.ip || null; }
const hasSnap = (id, name) => !!vmEnv(id)?.snapshots?.some((s) => s.name === name);
const lessonVm = (l) => (l && (l.mode === "ssh" || l.mode === "ps") ? l.vm || "server" : null);
/* Welche VM braucht die aktuelle Ansicht? */
function wantedVm() {
  if (settings.tab === "missions" && currentMission && currentMission.target !== "sandbox") return "uebung";
  if (settings.tab === "lessons") return lessonVm(LESSONS[progress.lesson]) || activeVm;
  return activeVm;
}

function updateStatus() {
  let cls = "", text = "";
  if (mode === "browser") {
    cls = vm.loggedIn ? "running" : "booting";
    text = vm.loggedIn ? "Mini-Linux läuft · du bist root" : "Mini-Linux startet …";
  } else if (mode === "sql") {
    cls = "running"; text = "SQL-Konsole · SQLite im Browser";
  } else if (STATIC) {
    text = "Online-Demo · nur Mini-Linux";
  } else if (mode === "win") {
    if (win.connected) { cls = "running"; text = "Windows-Sandbox · PowerShell 5.1"; }
    else {
      text = { unavailable: "Windows-Sandbox nicht aktiviert", off: "Sandbox ist aus", starting: "Sandbox startet …", stopping: "Sandbox wird beendet …", ready: win.connecting ? "Verbinde mit der Sandbox …" : "Sandbox läuft · nicht verbunden" }[sb.state] || "Windows-Sandbox";
      cls = sb.state === "starting" || sb.state === "stopping" || win.connecting ? "booting" : sb.state === "ready" ? "warn" : "";
    }
  } else if (job && !job.done) { cls = "booting"; text = job.title + " …"; }
  else if (remote().connected) {
    cls = "running";
    const where = remote().managedVm ? VM_LABEL[remote().managedVm] : remote().target;
    text = mode === "ps" ? `PowerShell 7 · ${where}` : remote().managedVm ? `${where} · ${remote().target}` : `Echte VM · ${where}`;
  }
  else if (remote().connecting) { cls = "booting"; text = `Verbinde mit ${VM_LABEL[activeVm]} …`; }
  else {
    const s = vmState(), n = VM_LABEL[activeVm];
    text = { Running: `${n} läuft · nicht verbunden`, Stopped: `${n} ist aus`, Suspended: `${n} pausiert`, Starting: `${n} startet …`, none: `Noch keine ${VM_PLAIN[activeVm]}`, unknown: "Echte VM" }[s] || `${n}: ${s}`;
    cls = s === "Running" ? "warn" : "";
  }
  $("#vm-dot").className = "dot " + cls;
  $("#vm-text").textContent = text;
  const s = vmState();
  $("#btn-pause").hidden = s !== "Running";
  $("#btn-resume").hidden = !(s === "Suspended" || s === "Stopped");
  $("#btn-endday").hidden = !(VM_IDS.some((id) => ["Running", "Suspended"].includes(vmState(id))) || sb.running);
  $("#btn-sb-start").hidden = !(sb.state === "off" || sb.state === "unknown");
  $("#btn-sb-stop").hidden = !(sb.running || sb.state === "ready");
  $("#btn-ssh").textContent = remote().connected ? "🔌 Trennen" : "🔌 Verbinden";
}

async function refreshEnv() {
  if (STATIC) { env = null; updateStatus(); return null; }
  try { env = await api("env"); if (env.error) env = null; } catch { env = null; }
  if (env?.multipass?.installed && env?.hyperv?.running !== false) markEvent("env-ready");
  if (VM_IDS.some((id) => vmEnv(id)?.vm)) markEvent("vm-created");
  updateStatus();
  // VM läuft (z. B. außerhalb der App gestartet), aber keine Verbindung → selbst verbinden (höchstens alle 20 s)
  if (isRemote() && vmState(wantedVm()) === "Running" && vmIP(wantedVm()) && !remote().connected && !remote().connecting && !pwshInstalling
      && !(job && !job.done) && Date.now() - lastAutoConnect > 20000) {
    lastAutoConnect = Date.now();
    connectManaged({ quiet: true });
  }
  if ($("#vm-dialog").open) renderVmCenter();
  if (settings.tab === "missions") renderMissions();
  if (settings.tab === "lessons" && lessonVm(LESSONS[progress.lesson])) renderLesson();
  return env;
}

/* ---------- Moduswechsel ---------- */
// Beim erneuten Anzeigen alter Ausgaben keine Terminal-Abfragen (Cursorposition, Gerätetyp) mitschicken –
// sonst antwortet xterm darauf und die Antworten landen als Text (z. B. "1;1R") in der Eingabezeile.
const replayable = (s) => s.replace(/\x1b\[[>?]?\d*(?:;\d+)*[cn]/g, "");
function setMode(m) {
  if (m === mode) return;
  mode = m;
  tracking = null;
  document.body.dataset.mode = m;
  $$(".mode-switch button").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
  term.reset();
  if (m === "browser") {
    term.write(replayable(vm.scroll));
    if (!vm.scroll) bootBanner();
  } else if (m === "sql") {
    sqlEnsure(LESSONS[progress.lesson]);
    if (!sqlb.db) sqlb.use(LESSONS[progress.lesson]?.db || Object.keys(window.SQL_DBS || {})[0]).catch(() => {});
    setTimeout(() => $("#sql-input").focus(), 50);
  } else {
    const R = remote();
    if (STATIC) {
      term.writeln(`\x1b[36m${{ ssh: "Echte VM (Ubuntu)", ps: "PowerShell 7", win: "Windows-Sandbox" }[m]}\x1b[0m – in der Online-Demo nicht verfügbar.`);
      term.writeln("Dafür brauchst du die installierte Version mit Übungs-VM: \x1b[4m" + REPO_URL + "\x1b[0m");
      term.writeln("\x1b[90mIm Browser funktionieren: 🖥 Mini-Linux, Training, 🏴 Wargame und 🎓 Prüfung.\x1b[0m");
    } else if (R.connected) term.write(replayable(R.scroll));
    else if (m === "win") {
      winBanner();
      refreshSandbox().then((st) => {
        if (mode !== "win" || win.connected || win.connecting) return;
        if (st.state === "off") term.writeln("\x1b[90mStarte sie oben mit „▶ Sandbox starten“.\x1b[0m");
        if (st.state === "unavailable") term.writeln("\x1b[31mDie Windows-Sandbox ist auf diesem PC nicht aktiviert (siehe Lektion „Windows verwalten“).\x1b[0m");
      });
    } else {
      m === "ps" ? psBanner() : sshBanner();
      refreshEnv().then((e) => {
        if (mode !== m || R.connected || R.connecting) return;
        if (vmState(wantedVm()) === "Running") connectManaged({ quiet: true });
        else openVmCenter();
      });
    }
  }
  setTimeout(() => backend().resize(), 50);
  updateStatus();
  renderTutor();
  term.focus();
}
$$(".mode-switch button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

function bootBanner() {
  term.writeln("\x1b[32mrootshell\x1b[0m – eine echte Linux-VM startet gerade in deinem Browser …");
  term.writeln("\x1b[90m(Das dauert ca. 5–20 Sekunden.)\x1b[0m\r\n");
}
function winBanner() {
  term.writeln("\x1b[36mWindows-Sandbox\x1b[0m – ein echtes, frisches Windows 11 nur für dich. Hier darfst du Dienste stoppen, Benutzer anlegen und die Registry ändern.");
  term.writeln("\x1b[90mBeim Beenden wird alles gelöscht – dein PC bleibt unberührt.\x1b[0m\r\n");
}
function psBanner() {
  term.writeln("\x1b[36mPowerShell 7\x1b[0m – läuft in deiner Übungs-VM. Sprache, Pipeline und Skripte sind dieselben wie unter Windows.");
  term.writeln("\x1b[90mDie VM verwaltest du über ⚙ VM-Zentrale (oben rechts).\x1b[0m\r\n");
}
function sshBanner() {
  term.writeln("\x1b[36mEchte VM\x1b[0m – hier arbeitest du auf einem vollwertigen Ubuntu.");
  term.writeln("\x1b[90mDie VM verwaltest du über ⚙ VM-Zentrale (oben rechts).\x1b[0m\r\n");
}

/* ---------- Jobs (lange VM-Aktionen) ---------- */
async function startJob(path, body, { after } = {}) {
  if (job && !job.done) { toast("Es läuft schon eine Aktion."); return null; }
  const r = await api(path, body || {});
  if (r.error) { toast(r.error); return null; }
  job = { id: r.id, title: "Aktion", log: "", done: false };
  renderJob(); updateStatus();
  while (true) {
    await sleep(1000);
    const j = await api("jobs/" + r.id);
    if (j.error) break;
    job = j; renderJob(); updateStatus();
    if (j.done) break;
  }
  const ok = job.ok;
  await refreshEnv();
  if (after) await after(ok);
  return ok;
}
function renderJob() {
  const el = $("#job");
  if (!el) return;
  if (!job) { el.hidden = true; return; }
  el.hidden = false;
  el.querySelector(".job-title").textContent = (job.done ? (job.ok ? "✅ " : "❌ ") : "⏳ ") + job.title;
  const bar = el.querySelector(".job-bar");
  bar.hidden = job.progress == null;
  bar.firstElementChild.style.width = (job.progress || 0) + "%";
  const log = el.querySelector("pre");
  log.textContent = (job.log || "").trim().split("\n").slice(-12).join("\n");
  log.scrollTop = log.scrollHeight;
}

/* ---------- VM-Zentrale ---------- */
function openVmCenter() {
  markEvent("vm-center-opened");
  if (!$("#vm-dialog").open) $("#vm-dialog").showModal();
  renderVmCenter();
  refreshEnv();
}
$("#btn-vm").addEventListener("click", openVmCenter);
$("#vm-close").addEventListener("click", () => $("#vm-dialog").close());

function fmtGB(b) { return b ? (Number(b) / 1073741824).toFixed(1) + " GB" : "–"; }

const VM_INFO = {
  uebung: { size: "1 CPU-Kern, 1 GB RAM und 8 GB Platte", base: "basis",
    role: "Wegwerf-Umgebung für Übungen und 🎯 Missionen. Vor jeder Übung springt sie auf „basis“ zurück – hier darf alles kaputtgehen." },
  server: { size: "2 CPU-Kernen, 2 GB RAM und 15 GB Platte", base: "frisch",
    role: "Dein Server: Hier installierst du echte Dienste Schritt für Schritt. Was du einrichtest, bleibt." },
};
/* Eine Karte der VM-Zentrale (Übungs-VM oder Server-VM) */
function vmCard(id) {
  const e = vmEnv(id), v = e?.vm, info = VM_INFO[id], t = `data-target="${id}"`;
  let h = `<section class="vmcard${activeVm === id ? " active" : ""}"><h4>${VM_LABEL[id]} <code>${escapeHtml(e?.name || "")}</code></h4>
    <p class="muted small">${info.role}</p>`;
  const needGB = id === "server" ? 2 : 1;
  if (env.ramFreeGB != null && env.ramFreeGB < needGB + 0.3 && (!v || v.state !== "Running"))
    h += `<p class="box warn small">⚠️ Gerade sind nur ${String(env.ramFreeGB).replace(".", ",")} GB Arbeitsspeicher frei – die ${VM_PLAIN[id]} braucht ${needGB} GB. Schließe vorher Programme (z. B. Browser-Tabs), sonst kann Windows sie nicht starten.</p>`;
  if (!v) {
    h += `<p>Noch nicht angelegt. Erstellt wird Ubuntu 24.04 LTS mit ${info.size} (wächst nur bei Bedarf).</p>
      <button class="primary" data-vm="launch" ${t}>🚀 ${VM_PLAIN[id]} erstellen</button></section>`;
    return h;
  }
  const stateTxt = { Running: "🟢 läuft", Stopped: "⚫ aus", Suspended: "⏸ pausiert", Starting: "🟡 startet", Restarting: "🟡 startet neu", Deleted: "🗑 gelöscht" }[v.state] || v.state;
  h += `<table class="vminfo"><tr><td>Zustand</td><td><b>${stateTxt}</b></td></tr>
    <tr><td>IP-Adresse</td><td>${v.ip ? `<code>${v.ip}</code>` : "–"}</td></tr>
    <tr><td>System</td><td>${escapeHtml(v.release || "")}</td></tr>
    ${v.mem ? `<tr><td>RAM</td><td>${fmtGB(v.mem.used)} von ${fmtGB(v.mem.total)}</td></tr>` : ""}
    ${v.disk ? `<tr><td>Platte</td><td>${fmtGB(v.disk.used)} von ${fmtGB(v.disk.total)}</td></tr>` : ""}</table>
    <div class="btnrow">
      ${v.state === "Running" ? `<button data-vm="connect" class="primary" ${t}>🔌 Verbinden</button><button data-vm="suspend" ${t}>☕ Pause</button><button data-vm="stop" ${t}>🌙 Herunterfahren</button>`
        : `<button data-vm="start" class="primary" ${t}>▶ ${v.state === "Suspended" ? "Fortsetzen" : "Starten"}</button>`}
    </div>`;
  h += hasSnap(id, info.base)
    ? `<div class="reset-row"><div><b>${id === "uebung" ? "Neu anfangen?" : "VM verbastelt?"}</b><br><span class="muted small">Zurück auf den Snapshot „${info.base}“. Dein Lernfortschritt in der App bleibt.</span></div>
       <button data-vm="reset-fresh" class="danger" ${t}>⟲ Auf ${id === "uebung" ? "Basis" : "Werkszustand"}</button></div>`
    : `<div class="reset-row"><div><b>Ausgangszustand sichern</b><br><span class="muted small">Es gibt noch keinen Snapshot „${info.base}“. Lege ihn jetzt an, dann kannst du die VM später mit einem Klick zurücksetzen.</span></div>
       <button data-vm="save-fresh" ${t}>📸 Als „${info.base}“ sichern</button></div>`;
  h += `<details class="snapbox"><summary>Snapshots (${e.snapshots.length})</summary><ul class="snaps">`;
  for (const s of e.snapshots) {
    h += `<li><code>${escapeHtml(s.name)}</code> <small>${escapeHtml(s.comment)}</small>
      <button data-vm="restore" data-name="${escapeHtml(s.name)}" ${t}>↺ zurückspielen</button>
      <button data-vm="delsnap" data-name="${escapeHtml(s.name)}" class="ghost" ${t}>🗑</button></li>`;
  }
  if (!e.snapshots.length) h += `<li class="muted">Noch keine Snapshots.</li>`;
  h += `</ul><div class="btnrow"><input class="snap-name" ${t} placeholder="z. B. vor-lemp" maxlength="30"><button data-vm="snapshot" ${t}>📸 Snapshot anlegen</button></div>
    <p class="muted small">Die VM wird dafür kurz angehalten und danach wieder gestartet.</p>
    <p class="muted small">Brauchst du sie nicht mehr? Gestoppt braucht sie keinen RAM. <button data-vm="delete" class="danger small" ${t}>🗑 ${VM_PLAIN[id]} löschen</button></p></details></section>`;
  return h;
}

function renderVmCenter() {
  const box = $("#vm-body");
  if (!env) { box.innerHTML = `<p class="muted">Prüfe deinen PC …</p>`; return; }
  const ok = (b) => (b ? `<span class="ok">✓</span>` : `<span class="bad">✗</span>`);
  const hv = env.hyperv || {};
  const mp = env.multipass || {};
  let h = `<section><h4>1 · Voraussetzungen</h4><ul class="checks">`;
  if (env.platform === "win32") {
    h += `<li>${ok(hv.supported)} Windows: ${escapeHtml(env.os || "?")}${hv.supported ? "" : ` <small>– Home-Edition hat kein Hyper-V. Multipass kann dann VirtualBox nutzen: VirtualBox installieren, danach <code>multipass set local.driver=virtualbox</code>.</small>`}</li>`;
    h += `<li>${ok(hv.running)} Hyper-V ${hv.running ? "aktiv" : hv.enabled ? "installiert, aber nicht aktiv – Windows neu starten" : "nicht aktiviert"}
      ${!hv.enabled && hv.supported ? `<button data-vm="hyperv">Hyper-V aktivieren</button>` : ""}
      ${!hv.running && hv.firmware === false && !hv.enabled ? `<small>Falls das nicht klappt: Virtualisierung (Intel VT-x / AMD-V / SVM) im BIOS/UEFI einschalten.</small>` : ""}</li>`;
    h += `<li>${ok(env.ramGB >= 8)} Arbeitsspeicher: ${env.ramGB || "?"} GB${env.ramFreeGB != null ? `, davon gerade frei: <b>${String(env.ramFreeGB).replace(".", ",")} GB</b>` : ""} <small>(Server-VM 2 GB, Übungs-VM 1 GB – nie beide gleichzeitig)</small></li>`;
  }
  h += `<li>${ok(mp.installed)} Multipass ${mp.installed ? escapeHtml(mp.version || "") : "nicht installiert"}
    ${!mp.installed ? (env.winget ? `<button data-vm="install">Multipass installieren</button>` : `<small>Download: multipass.run</small>`) : ""}</li></ul></section>`;

  h += `<p class="muted small">Es läuft immer nur eine VM – startest du die andere, wird die laufende pausiert.</p>
    <div class="vmcards">${mp.installed ? VM_IDS.map(vmCard).join("") : `<p class="muted">Erst die Voraussetzungen erfüllen.</p>`}</div>`;

  h += `<section><h4>Ressourcen schonen</h4>
    <label class="inline">Automatisch pausieren nach <select id="idle-min">
      ${[0, 15, 30, 60, 120].map((n) => `<option value="${n}" ${settings.idleMin === n ? "selected" : ""}>${n ? n + " Minuten" : "nie"}</option>`).join("")}
    </select> ohne Eingabe</label></section>`;

  h += `<section><h4>Andere Maschine (Proxmox, Server, …)</h4>
    <button data-vm="manual">Per IP + Passwort verbinden …</button></section>
    <section><h4>Hilfe</h4><button data-vm="check">🩺 Systemcheck: Was ist eingerichtet, was fehlt?</button></section>`;
  box.innerHTML = h;
  $("#idle-min").addEventListener("change", (e) => { settings.idleMin = +e.target.value; saveSettings(); toast(settings.idleMin ? `Auto-Pause nach ${settings.idleMin} Min.` : "Auto-Pause aus"); });
}

$("#vm-body").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-vm]");
  if (!b) return;
  const a = b.dataset.vm;
  const id = VM_IDS.includes(b.dataset.target) ? b.dataset.target : activeVm;
  const base = VM_INFO[id].base;
  const reconnect = (ok) => ok && isRemote() && activeVm === id && connectManaged({ quiet: true, vm: id });
  if (a === "install") {
    if (!confirm("Multipass (von Canonical) jetzt über winget installieren?\nWindows fragt evtl. nach Administratorrechten.")) return;
    startJob("install/multipass");
  } else if (a === "hyperv") {
    if (!confirm("Hyper-V aktivieren?\n\nWindows fragt nach Administratorrechten. Danach ist ein NEUSTART nötig.")) return;
    startJob("install/hyperv");
  } else if (a === "launch") {
    if (activeVm !== id) disconnectAll();
    activeVm = id;
    startJob("vm/launch", { vm: id }, { after: async (ok) => { if (ok) { markEvent("vm-created"); setMode(vmMode()); await connectManaged({ vm: id }); } } });
  } else if (a === "start") {
    if (activeVm !== id) disconnectAll();
    activeVm = id;
    startJob("vm/start", { vm: id }, { after: async (ok) => { if (ok) { $("#vm-dialog").close(); setMode(vmMode()); await connectManaged({ vm: id }); } } });
  } else if (a === "connect") {
    $("#vm-dialog").close(); setMode(vmMode()); connectManaged({ vm: id });
  } else if (a === "suspend") { doPause(false, id); }
  else if (a === "stop") { if (activeVm === id) disconnectAll(); startJob("vm/stop", { vm: id }); }
  else if (a === "snapshot") {
    const input = b.parentElement.querySelector(".snap-name");
    const name = (input?.value || "").trim() || "punkt-" + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    if (activeVm === id) disconnectAll();
    startJob("vm/snapshot", { vm: id, name, comment: new Date().toLocaleString("de-DE") }, { after: reconnect });
  } else if (a === "restore") {
    if (!confirm(`${VM_PLAIN[id]} auf „${b.dataset.name}“ zurücksetzen?\nAlles, was du seitdem geändert hast, ist danach weg.`)) return;
    if (activeVm === id) disconnectAll();
    startJob("vm/restore", { vm: id, name: b.dataset.name }, { after: reconnect });
  } else if (a === "reset-fresh") {
    resetVmFresh(id);
  } else if (a === "save-fresh") {
    if (activeVm === id) disconnectAll();
    startJob("vm/snapshot", { vm: id, name: base, comment: "Ausgangszustand (" + new Date().toLocaleDateString("de-DE") + ")" }, { after: reconnect });
  } else if (a === "delsnap") {
    if (!confirm(`Snapshot „${b.dataset.name}“ löschen?`)) return;
    startJob("vm/deleteSnapshot", { vm: id, name: b.dataset.name });
  } else if (a === "delete") {
    if (!confirm(`Die ${VM_PLAIN[id]} (${vmEnv(id)?.name}) wirklich LÖSCHEN?\nAlle Dateien, Dienste und Snapshots darin sind danach weg. (Du kannst jederzeit eine neue erstellen.)`)) return;
    if (prompt('Zur Sicherheit bitte "löschen" eintippen:') !== "löschen") return;
    if (activeVm === id) disconnectAll();
    startJob("vm/delete", { vm: id });
  } else if (a === "manual") {
    $("#vm-dialog").close(); openSshDialog();
  } else if (a === "check") {
    $("#vm-dialog").close(); openCheck();
  }
});

/* Ein-Klick-Reset: Übungs-VM auf „basis“, Server-VM auf „frisch“ */
async function resetVmFresh(id = activeVm) {
  const base = VM_INFO[id].base;
  if (id === "server" && !hasSnap(id, base)) { toast("Es gibt keinen Snapshot „frisch“ – lege ihn in der VM-Zentrale an."); openVmCenter(); return; }
  if (!vmEnv(id)?.vm) { toast(`Die ${VM_PLAIN[id]} gibt es noch nicht.`); openVmCenter(); return; }
  if (!confirm(`${VM_PLAIN[id]} auf „${base}“ zurücksetzen?\n\nAlles, was du darin installiert, angelegt oder geändert hast, ist danach weg. Dein Lernfortschritt in rootshell bleibt erhalten.`)) return;
  if (activeVm === id) disconnectAll();
  if (!$("#vm-dialog").open) openVmCenter();
  const after = (ok) => ok && isRemote() && activeVm === id && connectManaged({ quiet: true, vm: id });
  // Übungs-VM: resetBase legt „basis“ an, falls er fehlt
  const ok = await startJob(id === "uebung" ? "vm/resetBase" : "vm/restore", { vm: id, name: base }, { after });
  if (ok) {
    if (id === "uebung") {
      // gestartete Missionen und Übungen gelten nach dem Reset als nicht mehr vorbereitet
      Object.values(missionState.m).forEach((s) => { s.started = false; });
      saveMissions(); missionMsg = null; prepared = null;
    }
    toast(`⟲ ${VM_PLAIN[id]} ist wieder im Zustand „${base}“.`);
    renderTutor();
  }
}

/* ---------- Pause / Fortsetzen / Feierabend ---------- */
async function doPause(auto, id = activeVm) {
  if (id === activeVm) disconnectAll();
  if (isRemote() && id === activeVm) { term.writeln(`\r\n\x1b[33m☕ ${VM_PLAIN[id]} wird pausiert${auto ? " (keine Eingabe seit " + settings.idleMin + " Minuten)" : ""} …\x1b[0m`); }
  const ok = await startJob("vm/suspend", { vm: id });
  if (ok && isRemote()) term.writeln("\x1b[33m⏸ Pausiert. Weiter mit „▶ Fortsetzen“ oben.\x1b[0m");
}
$("#btn-pause").addEventListener("click", () => doPause());
$("#btn-resume").addEventListener("click", () => startJob("vm/start", { vm: activeVm }, { after: (ok) => ok && connectManaged({ vm: activeVm }) }));
$("#btn-endday").addEventListener("click", () => $("#endday-dialog").showModal());
$("#endday-form").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "ok") return;
  const stopVm = $("#endday-vm").checked, saveMini = $("#endday-mini").checked;
  if (saveMini && vm.emulator) {
    try { await idbPut("snapshot", await vm.emulator.save_state()); } catch {}
  }
  if (sb.running) await stopSandbox(false);
  if (stopVm) {
    for (const id of VM_IDS) {
      if (vmState(id) !== "Running" && vmState(id) !== "Suspended") continue;
      disconnectAll();
      await startJob("vm/stop", { vm: id });
    }
  }
  const st = load(KEYS.drills, { cards: {} });
  const due = Object.values(st.cards).filter((c) => c.due <= Date.now() + 86400000).length;
  $("#bye-text").innerHTML = `Alles gesichert${stopVm ? ", die VM ist heruntergefahren" : ""}. Dein PC ist wieder entlastet.<br>
    ${due ? `Morgen warten <b>${due}</b> Trainingskarten auf dich.` : ""}`;
  $("#bye-dialog").showModal();
});

/* Auto-Pause bei Inaktivität */
["keydown", "mousedown", "wheel"].forEach((ev) => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
let idleWarnTimer = null;
setInterval(() => {
  if (!settings.idleMin || vmState() !== "Running" || (job && !job.done) || idleWarnTimer) return;
  if (Date.now() - lastActivity < settings.idleMin * 60000) return;
  let left = 60;
  const d = $("#idle-dialog");
  const tick = () => { $("#idle-left").textContent = left; };
  tick(); d.showModal();
  idleWarnTimer = setInterval(() => {
    left--; tick();
    if (Date.now() - lastActivity < 2000) { clearInterval(idleWarnTimer); idleWarnTimer = null; d.close(); return; }
    if (left <= 0) { clearInterval(idleWarnTimer); idleWarnTimer = null; d.close(); doPause(true); }
  }, 1000);
}, 20000);
$("#idle-stay").addEventListener("click", () => { lastActivity = Date.now(); });

/* ---------- SSH-Dialog (fremde Maschine) ---------- */
function openSshDialog() {
  const saved = load(KEYS.ssh, {});
  $("#ssh-host").value = saved.host || "";
  $("#ssh-port").value = saved.port || 22;
  $("#ssh-user").value = saved.username || "";
  $("#ssh-pass").value = "";
  $("#ssh-dialog").showModal();
  ($("#ssh-host").value ? $("#ssh-pass") : $("#ssh-host")).focus();
}
$("#ssh-form").addEventListener("submit", (e) => {
  if (e.submitter?.value === "cancel") return;
  const cfg = { host: $("#ssh-host").value.trim(), port: +$("#ssh-port").value || 22, username: $("#ssh-user").value.trim() };
  save(KEYS.ssh, cfg);
  setMode("ssh");
  term.reset(); ssh.scroll = "";
  ssh.connect({ ...cfg, password: $("#ssh-pass").value });
  $("#ssh-pass").value = "";
});
$("#btn-ssh").addEventListener("click", () => {
  if (remote().connected) return remote().disconnect();
  if (vmState(wantedVm()) === "Running") return connectManaged();
  openVmCenter();
});

/* ---------- Mini-Linux: speichern / neu starten ---------- */
$("#btn-save").addEventListener("click", async () => {
  if (!vm.emulator) return;
  const btn = $("#btn-save"); btn.disabled = true; btn.textContent = "Speichere …";
  try {
    const state = await vm.emulator.save_state();
    await idbPut("snapshot", state);
    toast(`Zustand gespeichert (${(state.byteLength / 1048576).toFixed(0)} MB) – beim nächsten Öffnen geht's genau hier weiter.`);
  } catch (e) { toast("Speichern fehlgeschlagen: " + e.message); }
  btn.disabled = false; btn.textContent = "💾 Zustand speichern";
});
$("#btn-reset").addEventListener("click", async () => {
  if (!confirm("Mini-Linux neu starten? Alle Dateien darin und der gespeicherte Zustand gehen verloren. (Dein Lernfortschritt bleibt.)")) return;
  try { await idbPut("snapshot", undefined); } catch {}
  location.reload();
});

/* ===================================================================== */
/* TUTOR: Tabs                                                           */
/* ===================================================================== */
function renderTutor() {
  if (settings.tab === "wargame" && settings.track === "windows") settings.tab = "lessons";   // Wargame gibt's nur im Linux-Kurs
  $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === settings.tab));
  $$(".tabpane").forEach((p) => (p.hidden = p.dataset.pane !== settings.tab));
  if (settings.tab === "lessons") renderLesson();
  else if (settings.tab === "train") renderTraining();
  else if (settings.tab === "wargame") renderWargame();
  else if (settings.tab === "exam") renderExam();
  else renderMissions();
}
const TABS = ["lessons", "train", "missions", "wargame", "exam"];
$$(".tabs button").forEach((b) => b.addEventListener("click", () => { settings.tab = b.dataset.tab; saveSettings(); renderTutor(); }));

const subIP = (html) => html.replace(/\{\{IP\}\}/g, vmIP() || "IP-DEINER-VM");

/* ---------- Lektionen ---------- */
const GROUPS = { browser: "Teil 1 · Grundlagen im Mini-Linux", ssh: "Teil 2 · Echte VM – Installationen & Dienste (FISI)", self: "Teil 3 · Selbst hosten",
  ps: "Teil 1 · PowerShell-Grundlagen", "ps-admin": "Teil 2 · Windows-Verwaltung", win: "Teil 3 · Echtes Windows (Sandbox)",
  script: "Teil 4 · Skripte schreiben (Bash)", "ps-script": "Teil 4 · Skripte schreiben (PowerShell)",
  sec: "Teil 5 · IT-Security (Blue Team)", net: "Teil 6 · Netzwerk für FISI", devops: "Teil 7 · Git & Docker", db: "Teil 8 · Datenbanken" };
const trackOf = (l) => (l.mode === "ps" || l.mode === "win" ? "windows" : "linux");
const trackIdx = () => LESSONS.map((l, i) => i).filter((i) => trackOf(LESSONS[i]) === (settings.track || "linux"));
function renderNav() {
  const sel = $("#lesson-select");
  let html = "", group = null;
  const idx = trackIdx();
  idx.forEach((i, n) => { const l = LESSONS[i];
    const g = GROUPS[l.group || l.mode || "browser"];
    if (g !== group) { if (group) html += "</optgroup>"; html += `<optgroup label="${g}">`; group = g; }
    const d = doneSet(l.id).size;
    const k = l.steps.length;
    html += `<option value="${i}">${d === k ? "✓ " : ""}${n + 1}. ${l.title} (${d}/${k})</option>`;
  });
  sel.innerHTML = html + "</optgroup>";
  sel.value = progress.lesson;
  const total = idx.reduce((a, i) => a + LESSONS[i].steps.length, 0);
  const done = idx.reduce((a, i) => a + doneSet(LESSONS[i].id).size, 0);
  $("#progress-bar").style.width = (100 * done / total) + "%";
  $("#progress-text").textContent = `${done} von ${total} Schritten erledigt`;
  $("#btn-prev").disabled = progress.lesson === idx[0];
  $("#btn-next").disabled = progress.lesson === idx[idx.length - 1];
}

/* ---------- Lernpfad: ① Lernen → ② Üben → ③ Anwenden → ④ Störfall ---------- */
const STAGES = {
  1: { icon: "①", name: "Lernen", where: "im Browser" },
  2: { icon: "②", name: "Üben", where: "in der 🧪 Übungs-VM" },
  3: { icon: "③", name: "Anwenden", where: "auf deiner 🖥 Server-VM" },
  4: { icon: "④", name: "Störfall", where: "Mission in der 🧪 Übungs-VM" },
};
const lessonDone = (l) => doneSet(l.id).size >= l.steps.length;
/* Stationen eines Themas: Lektionen je Stufe (aktueller Kurs) und Missionen als Stufe 4 */
function stations(topic) {
  const t = settings.track || "linux";
  return [1, 2, 3, 4].map((stage) => {
    const items = stage === 4
      ? MISSIONS.filter((m) => m.topic === topic && (m.track || "linux") === t).map((m) => ({ kind: "mission", ref: m, done: mState(m.id).solved }))
      : LESSONS.map((l, i) => ({ l, i })).filter(({ l }) => l.topic === topic && l.stage === stage && trackOf(l) === t)
        .map(({ l, i }) => ({ kind: "lesson", ref: l, idx: i, done: lessonDone(l) }));
    return { stage, items, done: items.length > 0 && items.every((x) => x.done) };
  });
}
function pathBar(topic, current) {
  const tp = (window.TOPICS || []).find((x) => x.id === topic);
  const st = stations(topic).filter((s) => s.items.length);
  return `<nav class="pathbar" aria-label="Lernpfad">${tp ? `<span class="pathtopic">${escapeHtml(tp.title)}</span>` : ""}${st.map((s, n) =>
    `${n ? `<span class="patharrow">→</span>` : ""}<button data-goto="${topic}:${s.stage}" class="station${s.stage === current ? " on" : ""}${s.done ? " done" : ""}"
      title="${STAGES[s.stage].name} ${STAGES[s.stage].where}">${STAGES[s.stage].icon} ${STAGES[s.stage].name}${s.done ? " ✓" : ""}</button>`).join("")}</nav>`;
}
/* Zur Station springen: erste unerledigte Lektion bzw. Mission der Stufe */
function gotoStation(key) {
  const [topic, stage] = [key.split(":")[0], +key.split(":")[1]];
  const s = stations(topic).find((x) => x.stage === stage);
  if (!s || !s.items.length) return;
  const it = s.items.find((x) => !x.done) || s.items[0];
  if (it.kind === "mission") {
    currentMission = it.ref; missionMsg = null; settings.tab = "missions"; saveSettings(); renderTutor(); return;
  }
  if (settings.tab !== "lessons") { settings.tab = "lessons"; saveSettings(); }
  gotoLesson(it.idx);
  renderTutor();
  const want = it.ref.mode || "browser";
  if (want !== mode && !(want === "win" && STATIC)) setMode(want);
}
/* Kasten oben in VM-Lektionen: richtige VM vorhanden, vorbereitet, verbunden? */
function vmBox(lesson) {
  const id = lessonVm(lesson), st = vmState(id), R = remote();
  const busyNow = preparing || (job && !job.done);
  if (!vmEnv(id)?.vm) {
    return `<div class="box warn">Diese Lektion läuft in der <b>${VM_LABEL[id]}</b> – die gibt es noch nicht.
      <button class="primary" data-action="vm-launch" data-target="${id}" ${busyNow ? "disabled" : ""}>🚀 ${VM_PLAIN[id]} erstellen</button>
      <br><small class="muted">Einmalig, dauert ein paar Minuten. ${VM_INFO[id].role}</small></div>`;
  }
  if (id === "uebung" && prepared !== lesson.id) {
    return `<div class="box tip">🧪 <b>Übung in der Wegwerf-VM.</b> „Vorbereiten“ setzt die Übungs-VM auf „basis“ zurück${lesson.prep ? " und richtet alles ein, was du für diese Übung brauchst" : ""} (ca. 1 Minute). Danach darfst du hier alles ausprobieren.
      <div class="btnrow"><button class="primary" data-action="prep" ${busyNow ? "disabled" : ""}>${busyNow ? "⏳ Läuft …" : "▶ Übung vorbereiten"}</button></div></div>`;
  }
  if (R.connected && R.managedVm === id) return "";
  if (st === "Running") return `<div class="box warn">Das Terminal ist nicht mit der <b>${VM_LABEL[id]}</b> verbunden. <button class="primary" data-action="vm-connect" data-target="${id}">🔌 Verbinden</button></div>`;
  return `<div class="box warn">Die <b>${VM_LABEL[id]}</b> ist ${st === "Suspended" ? "pausiert" : "aus"}. <button class="primary" data-action="vm-start" data-target="${id}" ${busyNow ? "disabled" : ""}>▶ ${st === "Suspended" ? "Fortsetzen" : "Starten"}</button></div>`;
}
async function prepareExercise() {
  const l = LESSONS[progress.lesson];
  disconnectAll(); activeVm = "uebung";
  preparing = true; renderLesson();
  const ok = await startJob("vm/prepare", { lesson: l.id });
  preparing = false;
  if (ok) {
    prepared = l.id;
    if (mode !== (l.mode || "ssh")) setMode(l.mode || "ssh");
    await connectManaged({ vm: "uebung" });
    toast("🧪 Übung ist vorbereitet – leg los!");
  } else toast("Vorbereitung fehlgeschlagen – Details in der ⚙ VM-Zentrale.");
  renderLesson();
}

function renderLesson(scrollToActive = false) {
  const lesson = LESSONS[progress.lesson];
  const done = doneSet(lesson.id);
  const active = lesson.steps.findIndex((_, i) => !done.has(i));
  const lmode = lesson.mode || "browser";
  // Solange das Terminal nirgends verbunden ist, folgt die aktive VM der Lektion
  if (lessonVm(lesson) && ![ssh, ps].some((R) => R.connected || R.connecting) && !(job && !job.done)) activeVm = lessonVm(lesson);
  let html = `<h2>${lesson.title}</h2>`;
  if (STATIC && lmode !== "browser" && lmode !== "sql") {
    html += `<div class="box warn">📖 Diese Lektion kannst du hier lesen. Zum Mitmachen brauchst du ${lmode === "win" ? "die Windows-Sandbox" : "die Übungs-VM"}. ${DEMO_MSG}</div>`;
  } else if (lmode !== mode) {
    html += lmode === "win"
      ? (mode === "win" ? "" : `<div class="box warn">Diese Lektion läuft in der <b>Windows-Sandbox</b> – einem echten Windows. <button data-mode="win">🪟 Zur Windows-Sandbox</button></div>`)
      : lmode === "ps"
      ? `<div class="box warn">Diese Lektion läuft in <b>PowerShell</b>. <button data-mode="ps">⚡ Zu PowerShell wechseln</button></div>`
      : lmode === "sql"
      ? `<div class="box warn">Diese Lektion läuft in der <b>SQL-Konsole</b> – eine echte Datenbank direkt im Browser. <button data-mode="sql">🗄 Zur SQL-Konsole</button></div>`
      : lmode === "ssh"
      ? `<div class="box warn">Diese Lektion läuft in deiner <b>${VM_LABEL[lessonVm(lesson)]}</b> (Ubuntu). <button data-mode="ssh">🔌 Zur echten VM wechseln</button></div>`
      : `<div class="box warn">Diese Lektion ist fürs <b>Mini-Linux</b> gedacht (geht aber meist auch auf der VM). <button data-mode="browser">🖥 Zum Mini-Linux wechseln</button></div>`;
  }
  if (lmode === "win" && mode === "win" && !win.connected) {
    html += sb.state === "unavailable"
      ? `<div class="box warn">Die Windows-Sandbox ist auf diesem PC nicht aktiviert.</div>`
      : sb.state === "starting" ? `<div class="box tip">⏳ Die Sandbox startet gerade …</div>`
      : `<div class="box warn">Die Sandbox läuft noch nicht. <button data-action="sb-start" class="primary">▶ Sandbox starten</button></div>`;
  }
  if (!STATIC && lmode === mode && (lmode === "ssh" || lmode === "ps")) html += vmBox(lesson);
  if (lmode === "sql" && mode === "sql") sqlEnsure(lesson);
  if (lmode === "browser" && mode === "browser" && lesson.prep && preparedMini !== lesson.id)
    html += `<div class="box tip">📦 Diese Lektion braucht Übungsdaten im Mini-Linux. <button class="primary" data-action="prep-mini">▶ Übungsdaten bereitstellen</button></div>`;
  if (lesson.topic) html = pathBar(lesson.topic, lesson.stage) + html;
  html += `<p class="intro">${lesson.intro}</p>`;
  lesson.steps.forEach((s, i) => {
    const cls = done.has(i) ? "done" : i === active ? "active" : i > active && active !== -1 ? "locked" : "";
    html += `<div class="step ${cls}" data-i="${i}">
      <div class="step-head"><span class="check">${done.has(i) ? "✓" : i + 1}</span>${s.title}</div>
      <div class="step-body">${s.text || ""}`;
    for (const c of [].concat(s.cmd || [])) {
      html += `<div class="cmd"><pre>${escapeHtml(c)}</pre><button data-cmd="${escapeHtml(c)}" title="In die Eingabezeile übernehmen – Enter drückst du selbst">⌨ übernehmen</button></div>`;
    }
    for (const c of [].concat(s.win || [])) {
      html += `<div class="cmd win"><span class="tag">Windows</span><pre>${escapeHtml(c)}</pre><button data-copy="${escapeHtml(c)}" title="In die Zwischenablage kopieren">📋 kopieren</button></div>`;
    }
    if (s.task) html += `<div class="task">${s.task}</div>`;
    if (s.hint) html += `<details class="hint"><summary>Tipp anzeigen</summary>${s.hint}</details>`;
    if (s.solution) html += `<details class="hint"><summary>Lösung zeigen</summary><div class="cmd"><pre>${escapeHtml(s.solution)}</pre><button data-cmd="${escapeHtml(s.solution)}" title="In das Eingabefeld übernehmen">⌨ übernehmen</button></div></details>`;
    if (s.explain) html += `<div class="explain">${s.explain}</div>`;
    if (!done.has(i)) {
      html += s.check
        ? `<button class="skip" data-skip="${i}">Schritt überspringen</button>`
        : `<div style="margin-top:8px"><button class="primary" data-skip="${i}">✓ Erledigt</button></div>`;
    }
    html += `</div></div>`;
  });
  if (lesson.outro) html += `<div class="box tip">${lesson.outro}</div>`;
  if (active === -1) {
    // erst offene Lektionen derselben Station (z. B. Teil 2 eines Falls), dann die nächste Station
    const st = lesson.topic ? stations(lesson.topic) : [];
    const sameOpen = st.find((s) => s.stage === lesson.stage)?.items.find((x) => !x.done && x.ref.id !== lesson.id);
    const next = sameOpen ? null : st.find((s) => s.stage > lesson.stage && s.items.length);
    const btn = sameOpen ? `Weiter: ${escapeHtml(sameOpen.ref.title)} →` : next ? `Weiter: ${STAGES[next.stage].icon} ${STAGES[next.stage].name} →` : "";
    const goto = sameOpen ? lesson.stage : next?.stage;
    html += `<div class="lesson-done">🎉 Lektion abgeschlossen!${btn ? "" : progress.lesson < trackIdx().slice(-1)[0] ? " Weiter geht's mit der nächsten." : ""}<br><small>Neue Trainingskarten sind jetzt im Tab 🔁 Training freigeschaltet.</small>
      ${btn ? `<div class="btnrow center"><button class="primary" data-goto="${lesson.topic}:${goto}">${btn}</button></div>` : ""}</div>`;
  }
  $("#lesson").innerHTML = subIP(html);
  renderNav();
  if (scrollToActive) {
    const el = $("#lesson .step.active") || $("#lesson .lesson-done");
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function markDone(lessonIdx, stepIdx, viaCheck) {
  const lesson = LESSONS[lessonIdx];
  const d = doneSet(lesson.id);
  if (d.has(stepIdx)) return;
  d.add(stepIdx);
  progress.done[lesson.id] = [...d];
  saveProgress();
  if (settings.tab === "lessons" && lessonIdx === progress.lesson) renderLesson(true); else renderNav();
  if (viaCheck) toast("✓ " + lesson.steps[stepIdx].title);
}
function markEvent(name) {
  LESSONS.forEach((l, li) => l.steps.forEach((s, si) => { if (s.event === name) markDone(li, si, true); }));
}

// Fehlermeldungen von Programmen und Shell (BusyBox, GNU, deutsch) – nur am Zeilenanfang "prog: …",
// reine Hinweise ("info: …", z. B. von adduser beim Installieren von nginx/MariaDB) zählen nicht,
// damit Log-Zeilen (journalctl, grep in Logs) nicht fälschlich als Fehler zählen.
const ERR_LINE_RE = /^(?!info: )(?:[^\s:]+:.*(?:No such file or directory|command not found|: not found|Permission denied|Keine Berechtigung|nicht gefunden|invalid option|unrecognized option|unknown option|ungültige Option|missing (?:file )?operand|fehlender Operand|Is a directory|Not a directory|cannot access|can't (?:open|create|remove|cd|access|stat)|syntax error|Syntaxfehler|applet not found|Usage: |usage: |is not recognized|Cannot find|does not exist|cannot be found|A parameter cannot be found|Cannot bind|Cannot convert|is denied|Could not find)|E: |ERROR|Failed to |Unit \S+ (?:could not be found|not found)|ParserError|InvalidOperation:|\s+\+ (?:CategoryInfo|FullyQualifiedErrorId)\s+:|\s+\| .*(?:is not recognized|Cannot find|does not exist|Unexpected token|Missing ))/;
function errorLines(out) { return out.split("\n").filter((l) => ERR_LINE_RE.test(l.replace(/\r/g, ""))).join("\n"); }

function runCheck(check, cmd, out) {
  if (typeof check === "function") return check(cmd, out);
  if (check.cmd && !check.cmd.test(cmd)) return false;
  if (check.notOut && check.notOut.test(out)) return false;
  const errs = check.err ? "" : errorLines(out);
  if (errs) {
    // Fehler ist nur ok, wenn der Schritt genau diesen Fehler zeigen will (z. B. „Permission denied“)
    return !!(check.out && check.out.test(errs));
  }
  if (check.out && !check.out.test(out)) return false;
  return true;
}

function onCommandFinished(cmd, out) {
  // 1. Trainingskarte
  if (settings.tab === "train" && currentCard && currentCard.mode === mode) {
    let ok = false;
    try { ok = runCheck(currentCard.check, cmd, out); } catch {}
    if (ok) cardSolved();
  }
  // 2. Lektion
  const lesson = LESSONS[progress.lesson];
  const done = doneSet(lesson.id);
  for (let i = 0; i < lesson.steps.length; i++) {
    const s = lesson.steps[i];
    if (done.has(i) || !s.check) continue;
    let ok = false;
    try { ok = runCheck(s.check, cmd, out); } catch {}
    if (ok) markDone(progress.lesson, i, true);
  }
}

$(".tutor").addEventListener("click", async (e) => {
  const c = e.target.closest("[data-cmd]");
  if (c) { insertCommand(c.dataset.cmd); return; }
  const cp = e.target.closest("[data-copy]");
  if (cp) {
    try { await navigator.clipboard.writeText(cp.dataset.copy); toast("Kopiert"); }
    catch { toast("Kopieren nicht möglich – bitte markieren und Strg+C"); }
    return;
  }
  // nur Knöpfe – <body> trägt selbst data-mode und würde sonst jeden Klick abfangen
  const md = e.target.closest("button[data-mode]");
  if (md && !md.closest(".mode-switch")) { setMode(md.dataset.mode); return; }
  const act = e.target.closest("[data-action]");
  if (act?.dataset.action === "vm-center") { openVmCenter(); return; }
  if (act?.dataset.action === "vm-reset") { resetVmFresh(act.dataset.target || activeVm); return; }
  if (act?.dataset.action === "vm-launch" || act?.dataset.action === "vm-start") {
    const id = VM_IDS.includes(act.dataset.target) ? act.dataset.target : activeVm;
    if (activeVm !== id) disconnectAll();
    activeVm = id;
    if (!$("#vm-dialog").open) openVmCenter();
    startJob(act.dataset.action === "vm-launch" ? "vm/launch" : "vm/start", { vm: id }, { after: async (ok) => { if (ok) { markEvent("vm-created"); if (!isRemote()) setMode(vmMode()); await connectManaged({ vm: id }); renderTutor(); } } });
    return;
  }
  if (act?.dataset.action === "vm-connect") { const id = act.dataset.target || wantedVm(); if (!isRemote()) setMode(vmMode()); connectManaged({ vm: id }); return; }
  if (act?.dataset.action === "prep") { prepareExercise(); return; }
  if (act?.dataset.action === "prep-mini") {
    const l = LESSONS[progress.lesson];
    if (!vm.loggedIn) { toast("Das Mini-Linux startet noch – einen Moment."); return; }
    vmRunHidden(l.prep); preparedMini = l.id;
    toast("📦 Übungsdaten sind bereit."); renderLesson(); setTimeout(() => term.focus(), 1600); return;
  }
  const go = e.target.closest("[data-goto]");
  if (go) { gotoStation(go.dataset.goto); return; }
  if (act?.dataset.action === "sb-start") { if (mode !== "win") setMode("win"); startSandbox(); return; }
  const sk = e.target.closest("[data-skip]");
  if (sk) markDone(progress.lesson, +sk.dataset.skip, false);
});
function gotoLesson(i) { progress.lesson = i; progress.lessonId = LESSONS[i].id; saveProgress(); renderLesson(); $("#lesson").scrollTop = 0; }
$("#lesson-select").addEventListener("change", (e) => gotoLesson(+e.target.value));
function stepLesson(dir) { const idx = trackIdx(); const p = idx.indexOf(progress.lesson); const n = idx[p + dir]; if (n !== undefined) gotoLesson(n); }
$("#btn-prev").addEventListener("click", () => stepLesson(-1));
$("#btn-next").addEventListener("click", () => stepLesson(1));

/* ===================================================================== */
/* TRAINING – Lernkartei mit steigender Schwierigkeit                    */
/* ===================================================================== */
const INTERVALS = [0, 10, 24 * 60, 3 * 24 * 60, 7 * 24 * 60, 16 * 24 * 60, 35 * 24 * 60]; // Minuten je Fach
const NEW_PER_DAY = 10;
const LVL_NAMES = { 1: "Stufe 1 · Abrufen", 2: "Stufe 2 · Anwenden", 3: "Stufe 3 · Suchen & Lösen" };
let currentCard = null, cardHinted = false, cardRevealed = false;

const saveDrills = () => save(KEYS.drills, drillState);
function lessonUnlocked(id) {
  const l = LESSONS.find((x) => x.id === id);
  return !l || doneSet(id).size >= Math.ceil(l.steps.length / 2);
}
function unlockedLevel(m) {
  const cnt = (lvl) => DRILLS.filter((d) => d.mode === m && d.lvl === lvl && (drillState.cards[d.id]?.box || 0) >= 2).length;
  if (cnt(1) >= 6 && cnt(2) >= 4) return 3;
  if (cnt(1) >= 6) return 2;
  return 1;
}
function pool(m) {
  const lvl = unlockedLevel(m);
  return DRILLS.filter((d) => d.mode === m && d.lvl <= lvl && lessonUnlocked(d.after));
}
function nextCard() {
  const now = Date.now();
  const p = pool(mode);
  const due = p.filter((d) => drillState.cards[d.id] && drillState.cards[d.id].due <= now)
    .sort((a, b) => drillState.cards[a.id].box - drillState.cards[b.id].box || drillState.cards[a.id].due - drillState.cards[b.id].due);
  if (due.length) return due[0];
  const today = new Date().toDateString();
  if (drillState.newDay !== today) { drillState.newDay = today; drillState.newCount = 0; }
  if (drillState.newCount >= NEW_PER_DAY) return null;
  const fresh = p.filter((d) => !drillState.cards[d.id]).sort((a, b) => a.lvl - b.lvl);
  return fresh[0] || null;
}
function showCard(card) {
  currentCard = card; cardHinted = false; cardRevealed = false;
  if (card?.setup && mode === "browser" && vm.loggedIn) vm.send(` { ${card.setup}; } >/dev/null 2>&1; clear\n`);
  renderTraining();
}
function cardSolved() {
  const c = currentCard; if (!c) return;
  const st = drillState.cards[c.id] || { box: 0, ok: 0, fail: 0 };
  if (!drillState.cards[c.id]) drillState.newCount++;
  st.ok++;
  st.box = cardRevealed ? 1 : cardHinted ? Math.max(1, st.box) : Math.min(6, st.box + 1);
  st.due = Date.now() + INTERVALS[st.box] * 60000;
  const before = unlockedLevel(c.mode);
  drillState.cards[c.id] = st; saveDrills();
  const after = unlockedLevel(c.mode);
  $("#train").querySelector(".card")?.classList.add("solved");
  toast(cardRevealed ? "✓ Gut – die Karte kommt gleich nochmal" : cardHinted ? "✓ Richtig (mit Tipp)" : "✓ Richtig!");
  if (after > before) setTimeout(() => toast(`🔓 ${LVL_NAMES[after]} freigeschaltet!`), 1600);
  currentCard = null;
  setTimeout(() => { if (settings.tab === "train") showCard(nextCard()); }, 1400);
}
function cardFailed() {
  const c = currentCard; if (!c) return;
  const st = drillState.cards[c.id] || { box: 0, ok: 0, fail: 0 };
  if (!drillState.cards[c.id]) drillState.newCount++;
  st.fail++; st.box = 1; st.due = Date.now() + INTERVALS[1] * 60000;
  drillState.cards[c.id] = st; saveDrills();
}
function renderTraining() {
  const el = $("#train");
  const m = mode;
  const all = DRILLS.filter((d) => d.mode === m);
  const lvl = unlockedLevel(m);
  const boxes = [0, 0, 0, 0, 0, 0, 0];
  all.forEach((d) => { const s = drillState.cards[d.id]; if (s) boxes[s.box]++; });
  const seen = all.filter((d) => drillState.cards[d.id]).length;
  const mastered = all.filter((d) => (drillState.cards[d.id]?.box || 0) >= 4).length;
  if (currentCard && currentCard.mode !== m) currentCard = null;
  if (!currentCard) currentCard = nextCard();
  let h = `<h2>🔁 Training <small class="muted">${{ browser: "Mini-Linux", ssh: "Echte VM", ps: "PowerShell 7", win: "Windows-Sandbox" }[m]}</small></h2>
    <p class="intro">Karten kommen wieder, bis sie sitzen: Richtig → in größeren Abständen, falsch → bald wieder. Je mehr sitzt, desto schwieriger wird's – bis du selbst <b>suchen</b> musst.</p>
    <div class="levels">${[1, 2, 3].map((n) => `<span class="lvl ${n <= lvl ? "on" : ""}">${n <= lvl ? "" : "🔒 "}${LVL_NAMES[n]}</span>`).join("")}</div>
    <div class="boxes" title="Lernkartei: Fach 1 = übt bald wieder, Fach 6 = sitzt">${boxes.slice(1).map((n, i) => `<div><b>${n}</b><span>Fach ${i + 1}</span></div>`).join("")}</div>
    <p class="muted small">${seen} von ${all.length} Karten gesehen · ${mastered} sitzen sicher</p>`;
  const c = currentCard;
  if (m === "win" && !win.connected) h += `<div class="box warn">Für diese Karten brauchst du die Windows-Sandbox. <button data-action="sb-start">▶ Sandbox starten</button></div>`;
  else if (isRemote() && !remote().connected) h += `<div class="box warn">Für diese Karten brauchst du eine Verbindung zur VM. <button data-action="vm-center">⚙ VM-Zentrale</button></div>`;
  if (c) {
    const st = drillState.cards[c.id];
    h += `<div class="card lvl${c.lvl}">
      <div class="card-head"><span class="badge l${c.lvl}">${LVL_NAMES[c.lvl]}</span>${st ? `<span class="muted small">Fach ${st.box}</span>` : `<span class="badge new">neu</span>`}</div>
      <div class="q">${subIP(c.q)}</div>
      <p class="muted small">Tipp die Lösung links ins Terminal – die Karte erkennt es automatisch.</p>
      ${cardHinted && c.hint ? `<div class="box tip">💡 ${c.hint}</div>` : ""}
      ${cardRevealed ? `<div class="answer">Lösung: <code>${escapeHtml(c.a)}</code><br><small>Probier es jetzt selbst aus – dann geht's weiter.</small></div>` : ""}
      <div class="btnrow">
        ${c.hint && !cardHinted ? `<button data-card="hint">💡 Tipp</button>` : ""}
        ${!cardRevealed ? `<button data-card="reveal">👀 Lösung zeigen</button>` : ""}
        <button data-card="skip" class="ghost">Überspringen</button>
      </div></div>`;
  } else {
    const nextDue = all.map((d) => drillState.cards[d.id]?.due).filter(Boolean).sort((a, b) => a - b)[0];
    const lockedLessons = all.filter((d) => !lessonUnlocked(d.after)).length;
    h += `<div class="lesson-done">✅ Für jetzt ist alles wiederholt!<br><small>${nextDue ? "Nächste Karte fällig: " + new Date(nextDue).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : ""}
      ${lockedLessons ? `<br>${lockedLessons} weitere Karten werden mit neuen Lektionen freigeschaltet.` : ""}</small></div>`;
  }
  el.innerHTML = h;
}
$("#train").addEventListener("click", (e) => {
  const b = e.target.closest("[data-card]");
  if (!b || !currentCard) return;
  if (b.dataset.card === "hint") { cardHinted = true; renderTraining(); }
  else if (b.dataset.card === "reveal") { cardRevealed = true; cardFailed(); renderTraining(); }
  else if (b.dataset.card === "skip") {
    const st = drillState.cards[currentCard.id];
    if (st) { st.due = Date.now() + 5 * 60000; saveDrills(); }
    const skipped = currentCard.id;
    let n = nextCard();
    if (n && n.id === skipped) n = pool(mode).find((d) => d.id !== skipped && (!drillState.cards[d.id] || drillState.cards[d.id].due <= Date.now())) || null;
    showCard(n);
  }
});

/* ===================================================================== */
/* MISSIONEN – Störfälle in der echten VM                                */
/* ===================================================================== */
let currentMission = null;
let missionMsg = null;
const saveMissions = () => save(KEYS.missions, missionState);
const mState = (id) => (missionState.m[id] ||= { solved: false, started: false, hints: 0 });
const trackMissions = () => MISSIONS.filter((x) => (x.track || "linux") === (settings.track || "linux"));
function missionUnlocked(mi) {
  const solved = trackMissions().filter((x) => mState(x.id).solved).length;
  return mi.level === 1 || (mi.level === 2 && solved >= 2) || (mi.level === 3 && solved >= 5) || mState(mi.id).forced;
}
function renderMissions() {
  const el = $("#missions");
  const onSb = currentMission?.target === "sandbox";
  const want = onSb ? "win" : vmMode();
  const managed = onSb ? sb.state === "ready" : !!vmEnv("uebung")?.vm;   // Setup setzt die Übungs-VM zurück und startet sie
  let h = `<h2>🎯 Missionen</h2>
    <p class="intro">Echte Störfälle wie im Admin-Alltag. Die App baut den Fehler <b>unbemerkt</b> ein – du findest heraus, was los ist, und reparierst es. Ohne Schritt-für-Schritt-Anleitung.${settings.track === "windows" ? " Missionen mit 🪟 laufen in der Windows-Sandbox." : ""}</p>`;
  if (STATIC) h += `<div class="box warn">Missionen laufen auf deiner eigenen Übungs-VM. ${DEMO_MSG}</div>`;
  else if (currentMission && !managed) h += onSb
    ? `<div class="box warn">Diese Mission läuft in der Windows-Sandbox – die muss laufen. <button data-action="sb-start">▶ Sandbox starten</button></div>`
    : `<div class="box warn">Missionen laufen in der <b>🧪 Übungs-VM</b> – einer Wegwerf-VM, damit dein Server heil bleibt. Die gibt es noch nicht. <button data-action="vm-launch" data-target="uebung" class="primary">🚀 Übungs-VM erstellen</button></div>`;
  else if (currentMission && mode !== want) h += `<div class="box warn">Wechsle ins passende Terminal. <button data-mode="${want}">${{ ps: "⚡ Zu PowerShell 7", win: "🪟 Zur Windows-Sandbox", ssh: "🔌 Zur echten VM" }[want]}</button></div>`;
  if (!currentMission) {
    const solved = trackMissions().filter((x) => mState(x.id).solved).length;
    h += `<p class="muted small">${solved} von ${trackMissions().length} gelöst · Tipp: Vor einer Mission einen Snapshot anlegen.</p>`;
    if (!STATIC && settings.track !== "windows" && vmEnv("uebung")?.vm)
      h += `<p class="muted small">Missionen laufen in der 🧪 Übungs-VM; „Mission starten“ setzt sie vorher auf „basis“ zurück. <button class="ghost small" data-action="vm-reset" data-target="uebung">⟲ Jetzt zurücksetzen</button></p>`;
    h += `<ul class="mlist">`;
    for (const mi of trackMissions()) {
      const s = mState(mi.id), open = missionUnlocked(mi);
      h += `<li class="${s.solved ? "solved" : ""} ${open ? "" : "locked"}" data-mission="${mi.id}">
        <span class="badge l${mi.level}">${"★".repeat(mi.level)}</span>
        <span class="mtitle">${s.solved ? "✅ " : open ? "" : "🔒 "}${mi.target === "sandbox" ? "🪟 " : ""}${mi.title}</span>
        ${open ? "" : `<small class="muted">${mi.level === 2 ? "ab 2" : "ab 5"} gelösten</small>`}</li>`;
    }
    h += `</ul>`;
  } else {
    const mi = currentMission, s = mState(mi.id);
    h += `<button class="ghost" data-mback>← alle Missionen</button>
      <div class="mission">
      <h3><span class="badge l${mi.level}">${"★".repeat(mi.level)}</span> ${mi.title} ${s.solved ? "✅" : ""}</h3>
      <div class="story">${subIP(mi.story)}</div>
      <div class="goal"><b>Ziel:</b> ${subIP(mi.goal)}</div>
      <div class="btnrow">
        <button class="primary" data-maction="setup" ${managed ? "" : "disabled"}>${s.started ? "↺ Mission neu vorbereiten" : "▶ Mission starten"}</button>
        <button data-maction="verify" ${managed && s.started && (onSb || vmState("uebung") === "Running") ? "" : "disabled"}>✓ Prüfen</button>
      </div>
      ${missionMsg ? `<pre class="verify ${missionMsg.ok ? "ok" : "bad"}">${escapeHtml(missionMsg.text)}</pre>` : ""}
      <div class="mhints">`;
    for (let i = 0; i < s.hints; i++) h += `<div class="box tip">💡 Tipp ${i + 1}: ${mi.hints[i]}</div>`;
    if (s.started && s.hints < mi.hints.length) h += `<button data-maction="hint">💡 Tipp ${s.hints + 1} von ${mi.hints.length}</button>`;
    if (s.started && (s.hints >= mi.hints.length || s.solved)) h += `<details class="hint"><summary>Lösung anzeigen</summary>${mi.solution}</details>`;
    h += `</div></div>`;
  }
  el.innerHTML = h;
}
$("#missions").addEventListener("click", async (e) => {
  const li = e.target.closest("[data-mission]");
  if (li) {
    const mi = MISSIONS.find((x) => x.id === li.dataset.mission);
    if (!missionUnlocked(mi)) {
      if (!confirm("Diese Mission ist noch gesperrt (erst leichtere lösen). Trotzdem öffnen?")) return;
      mState(mi.id).forced = true; saveMissions();
    }
    currentMission = mi; missionMsg = null; renderMissions(); return;
  }
  if (e.target.closest("[data-mback]")) { currentMission = null; missionMsg = null; renderMissions(); return; }
  const a = e.target.closest("[data-maction]")?.dataset.maction;
  if (!a || !currentMission) return;
  const mi = currentMission, s = mState(mi.id);
  if (a === "setup") {
    missionMsg = null;
    if (mi.target !== "sandbox") disconnectAll();   // Übungs-VM wird zurückgesetzt, ggf. pausiert die Server-VM
    const ok = await startJob(`mission/${mi.id}/setup`, {});
    if (ok) {
      s.started = true; s.hints = 0; saveMissions();
      if (mi.target !== "sandbox") prepared = null;   // Übungs-VM wurde zurückgesetzt
      missionMsg = { ok: true, text: "Mission vorbereitet. Viel Erfolg! 🕵️" };
      const want = mi.target === "sandbox" ? "win" : vmMode();
      if (mode !== want) setMode(want);
      if (want === "win") { if (!remote().connected) connectSandbox(); }
      else { activeVm = "uebung"; await connectManaged({ quiet: true, vm: "uebung" }); }
    } else missionMsg = { ok: false, text: "Vorbereitung fehlgeschlagen – Details in der VM-Zentrale." };
    renderMissions();
  } else if (a === "verify") {
    missionMsg = { ok: true, text: "Prüfe …" }; renderMissions();
    const r = await api(`mission/${mi.id}/verify`, {});
    missionMsg = { ok: !!r.ok, text: r.output || r.error || "?" };
    if (r.ok && !s.solved) { s.solved = true; saveMissions(); toast("🏆 Mission gelöst!"); }
    renderMissions();
  } else if (a === "hint") { s.hints++; saveMissions(); renderMissions(); }
});

/* ===================================================================== */
/* WARGAME – Flaggenjagd im Mini-Linux (läuft auch in der Online-Demo)    */
/* ===================================================================== */
let wg = load(KEYS.wargame, { solved: {}, flags: {}, cur: null });
let wgMsg = null;
const saveWg = () => save(KEYS.wargame, wg);
const WG_WORDS = ["pinguin", "kernel", "daemon", "socket", "inode", "pipe", "shell", "cron", "grep", "sudo", "tux", "bash"];
function genFlag() {
  const b = new Uint8Array(4); crypto.getRandomValues(b);
  return `FLAG{${WG_WORDS[b[0] % WG_WORDS.length]}-${[...b.slice(1)].map((x) => x.toString(16).padStart(2, "0")).join("")}}`;
}
/* Skript unsichtbar im Mini-Linux ausführen (base64, damit das Flag nicht im Klartext durchs Terminal läuft) */
/* Skript unsichtbar im Mini-Linux ausführen. Die BusyBox-Shell nimmt nur ~1000 Zeichen pro Zeile an –
 * deshalb geht das Skript base64-kodiert in Stücken in eine Datei und wird erst dann ausgeführt. */
function vmRunHidden(script) {
  const b64 = btoa(unescape(encodeURIComponent(script)));
  const parts = b64.match(/.{1,700}/g) || [];
  vm.send(" rm -f /tmp/.rs_prep\n");
  for (const p of parts) vm.send(` echo -n ${p} >> /tmp/.rs_prep\n`);
  vm.send(" base64 -d /tmp/.rs_prep | sh >/dev/null 2>&1; rm -f /tmp/.rs_prep; clear\n");
  setTimeout(() => { if (mode === "browser") term.clear(); vm.scroll = ""; }, 1500 + parts.length * 700);
}
const wgUnlocked = (i) => i === 0 || !!wg.solved[WARGAME[i - 1].id];
function renderWargame() {
  const el = $("#wargame");
  const n = WARGAME.filter((l) => wg.solved[l.id]).length;
  let h = `<h2>🏴 Wargame <small class="muted">Flaggenjagd</small></h2>
    <p class="intro">Jedes Level versteckt im <b>Mini-Linux</b> ein Flag der Form <code>FLAG{…}</code>. Finde es mit Shell-Werkzeugen und gib es hier ein. Es gibt keine Anleitung, nur einen Auftrag, wie beim bekannten „Bandit“ von OverTheWire.</p>
    <div class="progress"><div style="width:${(100 * n) / WARGAME.length}%"></div></div>
    <p class="muted small">${n} von ${WARGAME.length} Flaggen gefunden${n === WARGAME.length ? " – alle! 🏆" : ""}</p>`;
  const i = WARGAME.findIndex((l) => l.id === wg.cur);
  if (i < 0) {
    h += `<ul class="mlist">`;
    WARGAME.forEach((l, k) => {
      const open = wgUnlocked(k), done = wg.solved[l.id];
      h += `<li class="${done ? "solved" : ""} ${open ? "" : "locked"}" data-wg="${l.id}">
        <span class="badge ${k >= 10 ? "l3" : k >= 5 ? "l2" : ""}">L${k + 1}</span>
        <span class="mtitle">${done ? "✅ " : open ? "" : "🔒 "}${l.title}</span><small class="muted">${escapeHtml(l.tools)}</small></li>`;
    });
    h += `</ul>`;
  } else {
    const l = WARGAME[i], flag = wg.flags[l.id], done = wg.solved[l.id];
    h += `<button class="ghost" data-wga="back">← alle Level</button>
      <div class="mission"><h3><span class="badge ${i >= 10 ? "l3" : i >= 5 ? "l2" : ""}">L${i + 1}</span> ${l.title} ${done ? "✅" : ""}</h3>
      <div class="story">${l.task}</div>
      <p class="muted small">Werkzeuge: ${escapeHtml(l.tools)}</p>`;
    if (mode !== "browser") h += `<div class="box warn">Das Wargame läuft im Mini-Linux. <button data-mode="browser">🖥 Zum Mini-Linux</button></div>`;
    else if (!vm.loggedIn) h += `<div class="box tip">⏳ Das Mini-Linux startet noch …</div>`;
    h += `<div class="btnrow"><button class="${flag ? "" : "primary"}" data-wga="setup" ${mode === "browser" && vm.loggedIn ? "" : "disabled"}>${flag ? "↺ Level neu vorbereiten" : "▶ Level vorbereiten"}</button></div>`;
    if (flag) h += `<p class="muted small">Vorbereitet. Hast du das Mini-Linux neu gestartet, bereite das Level neu vor – dann gibt es ein neues Flag.</p>
      <form class="flag-form" data-wgform><input id="wg-flag" placeholder="FLAG{…}" autocomplete="off" spellcheck="false" ${done ? `value="${escapeHtml(flag)}"` : ""}><button class="primary">🏴 Prüfen</button></form>`;
    if (wgMsg) h += `<div class="box ${wgMsg.ok ? "info" : "warn"}">${wgMsg.text}</div>`;
    h += `<details class="hint"><summary>Tipp anzeigen</summary>${l.hint}</details>`;
    if (done && i + 1 < WARGAME.length) h += `<div class="btnrow"><button class="primary" data-wg="${WARGAME[i + 1].id}">Weiter zu Level ${i + 2} →</button></div>`;
    h += `</div>`;
  }
  el.innerHTML = h;
}
$("#wargame").addEventListener("click", (e) => {
  const li = e.target.closest("[data-wg]");
  if (li) {
    const k = WARGAME.findIndex((l) => l.id === li.dataset.wg);
    if (!wgUnlocked(k)) { toast("Erst das vorige Level lösen."); return; }
    wg.cur = li.dataset.wg; wgMsg = null; saveWg(); renderWargame(); return;
  }
  const a = e.target.closest("[data-wga]")?.dataset.wga;
  if (a === "back") { wg.cur = null; wgMsg = null; saveWg(); renderWargame(); }
  else if (a === "setup") {
    const l = WARGAME.find((x) => x.id === wg.cur);
    const flag = genFlag();
    wg.flags[l.id] = flag; saveWg();
    vmRunHidden(l.setup(flag));
    wgMsg = { ok: true, text: "Level vorbereitet – leg los! Tipp die Befehle links ins Terminal." };
    renderWargame(); setTimeout(() => term.focus(), 1600);
  }
});
$("#wargame").addEventListener("submit", (e) => {
  if (!e.target.closest("[data-wgform]")) return;
  e.preventDefault();
  const l = WARGAME.find((x) => x.id === wg.cur);
  const got = $("#wg-flag").value.trim();
  if (got && got === wg.flags[l.id]) {
    if (!wg.solved[l.id]) { wg.solved[l.id] = Date.now(); saveWg(); toast("🏴 Flagge erobert!"); }
    wgMsg = { ok: true, text: "✅ Richtig! " + (WARGAME.indexOf(l) + 1 === WARGAME.length ? "Das war der Endgegner – alle Flaggen gefunden! 🏆" : "Das nächste Level ist freigeschaltet.") };
  } else {
    wgMsg = { ok: false, text: /^FLAG\{.+\}$/.test(got) ? "❌ Das ist nicht das richtige Flag. Vorsicht vor Attrappen!" : "❌ Ein Flag sieht so aus: <code>FLAG{wort-1a2b3c}</code> – mit geschweiften Klammern." };
  }
  renderWargame();
});

/* ===================================================================== */
/* PRÜFUNG – Simulation im IHK-Stil, Themen üben, Subnetting-Trainer      */
/* ===================================================================== */
let examState = load(KEYS.exam, { history: [], sub: { ok: 0, n: 0 } });
const saveExam = () => save(KEYS.exam, examState);
let exam = null;   // { kind: "exam" | "topic" | "sub", items, i, answers, checked, end, done }
const EXAM_MC = 20, EXAM_SUB = 6, EXAM_MIN = 30;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ip2s = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
const normAns = (s) => String(s || "").trim().replace(/\s+/g, "").replace(/^\//, "").replace(/,/g, ".");

/* Eine zufällige Subnetting-Aufgabe mit Lösungsweg */
function subnetTask() {
  const p = rnd(17, 30);
  const o = [[10, rnd(0, 255), rnd(0, 255), rnd(1, 254)], [172, rnd(16, 31), rnd(0, 255), rnd(1, 254)], [192, 168, rnd(0, 255), rnd(1, 254)]][rnd(0, 2)];
  const ip = ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
  const mask = (0xffffffff << (32 - p)) >>> 0;
  const net = (ip & mask) >>> 0, bc = (net | ~mask) >>> 0;
  const hb = 32 - p, size = 2 ** hb, hosts = size - 2, cidr = `${ip2s(ip)}/${p}`;
  const oc = Math.floor(p / 8), block = 2 ** (8 - (p % 8));
  const way = `Host-Bits: 32 − ${p} = <b>${hb}</b> → 2<sup>${hb}</sup> = ${size} Adressen, davon ${hosts} nutzbar. ` +
    (p % 8 ? `Die Netzgrenze liegt im ${oc + 1}. Oktett, die Blockgröße dort ist 2<sup>${8 - (p % 8)}</sup> = <b>${block}</b>: ${o[oc]} liegt im Block ab ${Math.floor(o[oc] / block) * block}. ` : `Das Präfix endet genau an einer Oktettgrenze. `) +
    `Netz <code>${ip2s(net)}</code> · erste <code>${ip2s(net + 1)}</code> · letzte <code>${ip2s(bc - 1)}</code> · Broadcast <code>${ip2s(bc)}</code> · Maske <code>${ip2s(mask)}</code>.`;
  const need = rnd(2 ** (hb - 1) - 1, hosts);
  const kinds = [
    { q: `Wie viele <b>nutzbare Hostadressen</b> hat ein Netz mit dem Präfix <code>/${p}</code>?`, a: String(hosts) },
    { q: `Wie lautet die <b>Netzadresse</b> von <code>${cidr}</code>?`, a: ip2s(net) },
    { q: `Wie lautet die <b>Broadcastadresse</b> von <code>${cidr}</code>?`, a: ip2s(bc) },
    { q: `Wie lautet die <b>Subnetzmaske</b> in Punktschreibweise zu <code>/${p}</code>?`, a: ip2s(mask) },
    { q: `Wie lautet die <b>erste nutzbare</b> Hostadresse in <code>${cidr}</code>?`, a: ip2s(net + 1) },
    { q: `Wie lautet die <b>letzte nutzbare</b> Hostadresse in <code>${cidr}</code>?`, a: ip2s(bc - 1) },
    { q: `Ein Subnetz soll <b>${need} Geräte</b> aufnehmen und dabei so klein wie möglich sein. Welches Präfix brauchst du? (z. B. /26)`, a: "/" + p,
      e: `Gesucht ist das kleinste h mit 2<sup>h</sup> − 2 ≥ ${need} → h = <b>${hb}</b> (2<sup>${hb}</sup> − 2 = ${hosts}${hb > 2 ? `, mit ${hb - 1} Bit wären es nur ${2 ** (hb - 1) - 2}` : ""}). Präfix = 32 − ${hb} = <b>/${p}</b>.` },
  ];
  const k = kinds[rnd(0, kinds.length - 1)];
  return { type: "sub", topic: "Subnetting", q: k.q, a: k.a, e: k.e || way };
}
const quizPool = () => QUIZ.filter((q) => q.track === "all" || q.track === (settings.track || "linux"));
function mcItem(q) {
  const order = shuffle(q.o.map((_, i) => i));
  return { type: "mc", id: q.id, topic: q.topic, q: q.q, o: order.map((i) => q.o[i]), a: order.indexOf(q.a), e: q.e };
}
const isRight = (it, ans) => (it.type === "mc" ? ans === it.a : ans != null && normAns(ans) === normAns(it.a));
function ihkGrade(p) {
  return p >= 92 ? [1, "sehr gut"] : p >= 81 ? [2, "gut"] : p >= 67 ? [3, "befriedigend"] : p >= 50 ? [4, "ausreichend"] : p >= 30 ? [5, "mangelhaft"] : [6, "ungenügend"];
}
const fmtTime = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const ansText = (it, ans) => (ans == null || ans === "" ? "<i>keine Antwort</i>" : it.type === "mc" ? escapeHtml(it.o[ans]) : escapeHtml(ans));

function startExam(kind, topic) {
  if (kind === "exam") {
    const mc = shuffle(quizPool()).slice(0, EXAM_MC).map(mcItem);
    exam = { kind, items: shuffle([...mc, ...Array.from({ length: EXAM_SUB }, subnetTask)]), i: 0, answers: {}, checked: {}, end: Date.now() + EXAM_MIN * 60000 };
  } else if (kind === "topic") {
    exam = { kind, topic, items: shuffle(quizPool().filter((q) => q.topic === topic)).slice(0, 10).map(mcItem), i: 0, answers: {}, checked: {} };
  } else exam = { kind: "sub", items: [subnetTask()], i: 0, answers: {}, checked: {} };
  renderExam();
}
function finishExam(timeout) {
  if (!exam || exam.done) return;
  exam.done = true;
  const right = exam.items.filter((it, i) => isRight(it, exam.answers[i])).length;
  exam.pct = Math.round((100 * right) / exam.items.length);
  if (exam.kind === "exam") {
    examState.history.unshift({ at: Date.now(), pct: exam.pct, grade: ihkGrade(exam.pct)[0], n: exam.items.length, track: settings.track || "linux" });
    examState.history = examState.history.slice(0, 10); saveExam();
    if (timeout) toast("⏰ Zeit abgelaufen – die Prüfung wurde abgegeben.");
  }
  renderExam();
}
setInterval(() => {
  if (exam?.kind !== "exam" || exam.done) return;
  const left = exam.end - Date.now();
  if (left <= 0) { if (settings.tab !== "exam") { settings.tab = "exam"; saveSettings(); renderTutor(); } finishExam(true); return; }
  const t = $("#exam-timer"); if (t) { t.textContent = fmtTime(left); t.classList.toggle("low", left < 5 * 60000); }
}, 1000);

function renderExam() {
  const el = $("#exam");
  let h = `<h2>🎓 Prüfung</h2>`;
  if (!exam) {
    const topics = [...new Set(quizPool().map((q) => q.topic))];
    const best = examState.history.filter((x) => x.track === (settings.track || "linux")).sort((a, b) => b.pct - a.pct)[0];
    h += `<p class="intro">Fragen im Stil der IHK-Abschlussprüfung (AP1/AP2) für Fachinformatiker Systemintegration – ${settings.track === "windows" ? "Windows-Kurs" : "Linux-Kurs"} plus allgemeine Themen.</p>
      <div class="card"><div class="card-head"><b>📝 Prüfungssimulation</b>${best ? `<span class="badge">Bestwert ${best.pct} % · Note ${best.grade}</span>` : ""}</div>
        <p class="muted">${EXAM_MC + EXAM_SUB} Aufgaben (davon ${EXAM_SUB} Subnetting) · ${EXAM_MIN} Minuten · keine Tipps, keine Lösungen bis zur Abgabe · Note nach IHK-Schlüssel.</p>
        <div class="btnrow"><button class="primary" data-exam="start">▶ Prüfung starten</button></div></div>
      <div class="card"><div class="card-head"><b>🧮 Subnetting-Trainer</b><span class="muted small">${examState.sub.n ? `${examState.sub.ok} von ${examState.sub.n} richtig` : ""}</span></div>
        <p class="muted">Endlos neue Aufgaben: Hosts, Netz, Broadcast, Maske, Präfix. Nach jeder Antwort siehst du den Lösungsweg.</p>
        <div class="btnrow"><button data-exam="sub">▶ Trainieren</button></div></div>
      <div class="card"><div class="card-head"><b>📚 Themen üben</b></div>
        <p class="muted">10 Fragen zu einem Thema, mit Erklärung direkt nach jeder Antwort.</p>
        <div class="btnrow">${topics.map((t) => `<button data-exam="topic" data-topic="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("")}</div></div>`;
    if (examState.history.length) {
      h += `<h3>Letzte Prüfungen</h3><table class="vminfo">${examState.history.map((x) => `<tr><td>${new Date(x.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td>${x.track === "windows" ? "🪟" : "🐧"} ${x.pct} %</td><td><b>Note ${x.grade}</b> (${ihkGrade(x.pct)[1]})</td></tr>`).join("")}</table>`;
    }
    el.innerHTML = h; return;
  }
  const E = exam;
  if (E.kind === "exam" && E.done) {
    const [g, gt] = ihkGrade(E.pct);
    const byTopic = {};
    E.items.forEach((it, i) => { const t = (byTopic[it.topic] ||= { ok: 0, n: 0 }); t.n++; if (isRight(it, E.answers[i])) t.ok++; });
    h += `<div class="exam-result g${g}"><div class="grade">${g}</div><div><b>${gt}</b><br>${E.pct} % · ${E.items.filter((it, i) => isRight(it, E.answers[i])).length} von ${E.items.length} richtig</div></div>
      <table class="vminfo">${Object.entries(byTopic).map(([t, v]) => `<tr><td>${escapeHtml(t)}</td><td>${v.ok} / ${v.n}</td><td><div class="progress mini"><div style="width:${(100 * v.ok) / v.n}%"></div></div></td></tr>`).join("")}</table>
      <p class="muted small">IHK-Schlüssel: ab 92 % = 1 · ab 81 % = 2 · ab 67 % = 3 · ab 50 % = 4 (bestanden) · ab 30 % = 5.</p>
      <div class="btnrow"><button class="primary" data-exam="start">↺ Neue Prüfung</button><button data-exam="home">← Übersicht</button></div>
      <h3>Auswertung</h3>`;
    E.items.forEach((it, i) => {
      const ok = isRight(it, E.answers[i]);
      h += `<div class="review ${ok ? "ok" : "bad"}"><div>${ok ? "✅" : "❌"} <b>${i + 1}.</b> ${it.q}</div>
        ${ok ? "" : `<div class="small">Deine Antwort: ${ansText(it, E.answers[i])}<br>Richtig: <b>${it.type === "mc" ? escapeHtml(it.o[it.a]) : escapeHtml(it.a)}</b></div>`}
        <details class="hint"${ok ? "" : " open"}><summary>Erklärung</summary>${it.e}</details></div>`;
    });
    el.innerHTML = h; return;
  }
  const it = E.items[E.i], ans = E.answers[E.i], checked = E.checked[E.i];
  const immediate = E.kind !== "exam";
  h += `<div class="exam-head">
    <span>${E.kind === "exam" ? `Aufgabe ${E.i + 1} / ${E.items.length}` : E.kind === "sub" ? `🧮 Subnetting · ${examState.sub.ok} / ${examState.sub.n} richtig` : `📚 ${escapeHtml(E.topic)} · ${E.i + 1} / ${E.items.length}`}</span>
    ${E.kind === "exam" ? `<span id="exam-timer" class="exam-timer">${fmtTime(E.end - Date.now())}</span>` : `<button class="ghost" data-exam="home">✕ Beenden</button>`}</div>`;
  if (E.kind === "exam") h += `<div class="exam-map">${E.items.map((x, i) => `<button data-exam="goto" data-i="${i}" class="${i === E.i ? "cur" : ""} ${E.answers[i] != null && E.answers[i] !== "" ? "done" : ""}">${i + 1}</button>`).join("")}</div>`;
  h += `<div class="card"><div class="card-head"><span class="badge">${escapeHtml(it.topic)}</span></div><div class="q">${it.q}</div>`;
  if (it.type === "mc") {
    h += `<div class="mc">${it.o.map((o, k) => {
      const cls = checked ? (k === it.a ? "right" : k === ans ? "wrong" : "") : k === ans ? "sel" : "";
      return `<button data-exam="pick" data-k="${k}" class="${cls}" ${checked ? "disabled" : ""}>${String.fromCharCode(65 + k)}) ${escapeHtml(o)}</button>`;
    }).join("")}</div>`;
  } else {
    h += `<form class="flag-form" data-examform><input id="exam-input" placeholder="Antwort" autocomplete="off" spellcheck="false" value="${escapeHtml(ans || "")}" ${checked ? "disabled" : ""}>${immediate && !checked ? `<button class="primary">Prüfen</button>` : ""}</form>`;
  }
  if (checked) {
    const ok = isRight(it, ans);
    h += `<div class="box ${ok ? "info" : "warn"}">${ok ? "✅ Richtig!" : `❌ Richtig wäre: <b>${it.type === "mc" ? escapeHtml(it.o[it.a]) : escapeHtml(it.a)}</b>`}<br><span class="small">${it.e}</span></div>`;
  }
  h += `</div><div class="btnrow">`;
  if (E.kind === "exam") {
    h += `<button data-exam="prev" ${E.i ? "" : "disabled"}>← Zurück</button><button data-exam="next" ${E.i < E.items.length - 1 ? "" : "disabled"}>Weiter →</button>
      <button class="primary" data-exam="submit" style="margin-left:auto">✓ Abgeben</button>`;
  } else if (checked) {
    h += E.kind === "sub" || E.i < E.items.length - 1 ? `<button class="primary" data-exam="next">Nächste Aufgabe →</button>` : `<button class="primary" data-exam="submit">Auswertung →</button>`;
  }
  h += `</div>`;
  el.innerHTML = h;
  if (it.type === "sub" && !checked) $("#exam-input")?.focus();
}
function examCheckCurrent() {
  const E = exam; if (!E || E.kind === "exam" || E.checked[E.i]) return;
  E.checked[E.i] = true;
  if (E.kind === "sub") { examState.sub.n++; if (isRight(E.items[E.i], E.answers[E.i])) examState.sub.ok++; saveExam(); }
  renderExam();
}
$("#exam").addEventListener("click", (e) => {
  const b = e.target.closest("[data-exam]"); if (!b) return;
  const a = b.dataset.exam;
  if (a === "start") {
    if (exam?.kind === "exam" && !exam.done && !confirm("Die laufende Prüfung abbrechen und neu starten?")) return;
    startExam("exam");
  } else if (a === "sub") startExam("sub");
  else if (a === "topic") startExam("topic", b.dataset.topic);
  else if (a === "home") {
    if (exam?.kind === "exam" && !exam.done && !confirm("Prüfung abbrechen? Sie wird nicht gewertet.")) return;
    exam = null; renderExam();
  } else if (!exam) return;
  else if (a === "pick") { exam.answers[exam.i] = +b.dataset.k; if (exam.kind === "exam") renderExam(); else examCheckCurrent(); }
  else if (a === "goto") { exam.i = +b.dataset.i; renderExam(); }
  else if (a === "prev") { exam.i--; renderExam(); }
  else if (a === "next") {
    if (exam.kind === "sub") { exam.items.push(subnetTask()); }
    exam.i++; renderExam();
  } else if (a === "submit") {
    if (exam.kind === "exam") {
      const open = exam.items.length - Object.values(exam.answers).filter((v) => v != null && v !== "").length;
      if (open && !confirm(`Noch ${open} Aufgabe(n) unbeantwortet. Trotzdem abgeben?`)) return;
      finishExam();
    } else { exam.kind = "exam"; exam.done = false; finishExamPractice(); }
  }
});
/* Themen-Übung: kurze Auswertung ohne Note in der Historie */
function finishExamPractice() {
  const right = exam.items.filter((it, i) => isRight(it, exam.answers[i])).length;
  exam.pct = Math.round((100 * right) / exam.items.length); exam.done = true;
  renderExam();
}
$("#exam").addEventListener("input", (e) => { if (e.target.id === "exam-input" && exam) exam.answers[exam.i] = e.target.value; });
$("#exam").addEventListener("submit", (e) => {
  if (!e.target.closest("[data-examform]")) return;
  e.preventDefault();
  if (!exam) return;
  exam.answers[exam.i] = $("#exam-input").value;
  if (exam.kind === "exam") { if (exam.i < exam.items.length - 1) { exam.i++; renderExam(); } }
  else examCheckCurrent();
});

/* ===================================================================== */
/* FORTSCHRITT – Übersicht, Sicherung (Export/Import), Zurücksetzen       */
/* ===================================================================== */
function renderProgress() {
  const tr = (t) => {
    const ls = LESSONS.filter((l) => trackOf(l) === t);
    const steps = ls.reduce((a, l) => a + l.steps.length, 0), done = ls.reduce((a, l) => a + doneSet(l.id).size, 0);
    const full = ls.filter((l) => doneSet(l.id).size === l.steps.length).length;
    const ms = MISSIONS.filter((x) => (x.track || "linux") === t), mSolved = ms.filter((x) => missionState.m[x.id]?.solved).length;
    const modes = t === "windows" ? ["ps", "win"] : ["browser", "ssh"];
    const cards = DRILLS.filter((d) => modes.includes(d.mode)), seen = cards.filter((d) => drillState.cards[d.id]).length, sure = cards.filter((d) => (drillState.cards[d.id]?.box || 0) >= 4).length;
    const ex = examState.history.filter((x) => x.track === t), best = ex.sort((a, b) => b.pct - a.pct)[0];
    const bar = (a, b) => `<div class="progress mini"><div style="width:${b ? (100 * a) / b : 0}%"></div></div>`;
    return `<section><h4>${t === "windows" ? "🪟 Windows · PowerShell" : "🐧 Linux"}</h4><table class="vminfo">
      <tr><td>Lektionen</td><td>${full} / ${ls.length} fertig · ${done} / ${steps} Schritte</td><td>${bar(done, steps)}</td></tr>
      <tr><td>Training</td><td>${seen} / ${cards.length} Karten gesehen · ${sure} sitzen</td><td>${bar(sure, cards.length)}</td></tr>
      <tr><td>Missionen</td><td>${mSolved} / ${ms.length} gelöst</td><td>${bar(mSolved, ms.length)}</td></tr>
      ${t === "linux" ? `<tr><td>Wargame</td><td>${WARGAME.filter((l) => wg.solved[l.id]).length} / ${WARGAME.length} Flaggen</td><td>${bar(WARGAME.filter((l) => wg.solved[l.id]).length, WARGAME.length)}</td></tr>` : ""}
      <tr><td>Prüfung</td><td>${best ? `Bestwert ${best.pct} % (Note ${best.grade}) · ${ex.length}× geschrieben` : "noch nicht geschrieben"}</td><td></td></tr></table></section>`;
  };
  $("#progress-body").innerHTML = tr("linux") + tr("windows") + `
    <section><h4>Sicherung</h4>
      <p class="muted small">Dein Fortschritt liegt nur in diesem Browser. Leert der Browser seinen Speicher, ist er weg. Sichere ihn als Datei, auch für den Umzug auf einen anderen PC.</p>
      <div class="btnrow"><button data-prog="export" class="primary">⬇ Als Datei sichern</button><button data-prog="import">⬆ Aus Datei laden</button>
      <input type="file" id="prog-file" accept=".json,application/json" hidden></div></section>
    <section><h4>Sonstiges</h4><div class="btnrow"><button data-prog="check">🩺 Systemcheck</button><button data-prog="reset" class="danger">🗑 Fortschritt zurücksetzen</button></div></section>`;
}
function openProgress() { renderProgress(); $("#progress-dialog").showModal(); }
function exportProgress() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("linuxlab.") && k !== KEYS.ssh) data[k] = localStorage.getItem(k); }
  const blob = new Blob([JSON.stringify({ app: "rootshell", version: 1, exported: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `rootshell-fortschritt-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Fortschritt gesichert – die Datei liegt in deinen Downloads.");
}
async function importProgress(file) {
  let j;
  try { j = JSON.parse(await file.text()); } catch { toast("Die Datei ist kein gültiges JSON."); return; }
  if (j?.app !== "rootshell" || typeof j.data !== "object") { toast("Das ist keine rootshell-Sicherung."); return; }
  const entries = Object.entries(j.data).filter(([k, v]) => k.startsWith("linuxlab.") && k !== KEYS.ssh && typeof v === "string" && (() => { try { JSON.parse(v); return true; } catch { return false; } })());
  if (!entries.length) { toast("In der Datei steht kein Fortschritt."); return; }
  if (!confirm(`Sicherung vom ${new Date(j.exported).toLocaleString("de-DE")} laden?\nDein aktueller Fortschritt in diesem Browser wird dabei ersetzt.`)) return;
  entries.forEach(([k, v]) => localStorage.setItem(k, v));
  location.reload();
}
function resetProgress() {
  if (!confirm("Wirklich den GESAMTEN Lernfortschritt löschen (Lektionen, Training, Missionen, Wargame, Prüfungen)?\nTipp: Vorher „Als Datei sichern“.")) return;
  if (prompt('Zur Sicherheit bitte "löschen" eintippen:') !== "löschen") return;
  Object.values(KEYS).filter((k) => k !== KEYS.ssh).forEach((k) => localStorage.removeItem(k));
  location.reload();
}
$("#btn-progress").addEventListener("click", openProgress);
$("#progress-close").addEventListener("click", () => $("#progress-dialog").close());
$("#progress-body").addEventListener("click", (e) => {
  const a = e.target.closest("[data-prog]")?.dataset.prog;
  if (a === "export") exportProgress();
  else if (a === "import") $("#prog-file").click();
  else if (a === "reset") resetProgress();
  else if (a === "check") { $("#progress-dialog").close(); openCheck(); }
});
$("#progress-body").addEventListener("change", (e) => { if (e.target.id === "prog-file" && e.target.files[0]) importProgress(e.target.files[0]); });

/* ===================================================================== */
/* SYSTEMCHECK – was ist eingerichtet, was fehlt, was geht damit          */
/* ===================================================================== */
function checkItems() {
  const it = [{ ok: typeof WebAssembly === "object", name: "Browser", info: typeof WebAssembly === "object" ? "unterstützt alles" : "zu alt", fix: "Einen aktuellen Chrome, Edge oder Firefox verwenden." }];
  if (STATIC) {
    it.push({ ok: false, name: "Lokaler rootshell-Server", info: "Online-Demo", fix: `Für Übungs-VM, PowerShell 7 und Windows-Sandbox installierst du rootshell auf deinem PC: <a href="${REPO_URL}#installation" target="_blank" rel="noopener">Anleitung</a>.` });
    return it;
  }
  it.push({ ok: !!env, name: "rootshell-Server", info: env ? "läuft" : "nicht erreichbar", fix: "<code>start.bat</code> starten und das schwarze Fenster offen lassen." });
  if (!env) return it;
  if (env.platform === "win32") {
    const hv = env.hyperv || {};
    it.push({ ok: !!hv.running, name: "Hyper-V", info: hv.running ? "aktiv" : hv.enabled ? "installiert – Neustart nötig" : "nicht aktiv",
      fix: hv.supported ? "VM-Zentrale → „Hyper-V aktivieren“, danach Windows neu starten. Klappt es nicht: Virtualisierung (VT-x/AMD-V) im BIOS einschalten." : "Windows Home hat kein Hyper-V: VirtualBox installieren, dann <code>multipass set local.driver=virtualbox</code>." });
    it.push({ ok: env.ramGB >= 8, opt: true, name: "Arbeitsspeicher", info: `${env.ramGB || "?"} GB`, fix: "Unter 8 GB wird es eng: die VM pausieren, wenn du sie nicht brauchst." });
  }
  it.push({ ok: !!env.multipass?.installed, name: "Multipass", info: env.multipass?.installed ? `Version ${env.multipass.version || "?"}` : "nicht installiert", fix: "VM-Zentrale → „Multipass installieren“ (oder von multipass.run)." });
  for (const id of VM_IDS) {
    const v = vmEnv(id)?.vm, base = VM_INFO[id].base;
    it.push({ ok: !!v, name: `${VM_PLAIN[id]} ${vmEnv(id)?.name || ""}`, info: v ? { Running: "läuft", Stopped: "aus", Suspended: "pausiert" }[v.state] || v.state : "noch nicht erstellt",
      fix: `VM-Zentrale → „🚀 ${VM_PLAIN[id]} erstellen“ (einmalig, ca. 5–10 Minuten). ${id === "uebung" ? "Für Übungen und Missionen." : "Für die geführten Installationen."}` });
    if (v) it.push({ ok: hasSnap(id, base), opt: true, name: `Snapshot „${base}“`, info: hasSnap(id, base) ? "vorhanden" : "fehlt", fix: `VM-Zentrale → „📸 Als „${base}“ sichern“ – dann kannst du die VM jederzeit zurücksetzen.` });
  }
  if (env.platform === "win32") it.push({ ok: ["off", "ready", "starting"].includes(sb.state), opt: true, name: "Windows-Sandbox", info: { unavailable: "nicht aktiviert", off: "bereit", ready: "läuft", starting: "startet" }[sb.state] || "unbekannt",
    fix: "Nur Windows Pro/Enterprise: „Windows-Features aktivieren oder deaktivieren“ → „Windows-Sandbox“, dann neu starten. Nötig nur für die 🪟-Lektionen." });
  return it;
}
function renderCheck() {
  const it = checkItems();
  const can = ["🖥 Mini-Linux, 🔁 Training, 🏴 Wargame und 🎓 Prüfung"];
  if (vmEnv("uebung")?.vm) can.push("🧪 Übungs-VM: Übungen (②) und alle 🎯 Linux-Missionen");
  if (vmEnv("server")?.vm) can.push("🖥 Server-VM: Teil 2–8, geführte Installationen (③)", "⚡ PowerShell 7 (Windows-Kurs Teil 1, 2, 4)");
  if (["off", "ready", "starting"].includes(sb.state)) can.push("🪟 Windows-Sandbox (Windows-Kurs Teil 3)");
  $("#check-body").innerHTML = `<ul class="checks">${it.map((x) => `<li>${x.ok ? `<span class="ok">✓</span>` : x.opt ? `<span class="opt">!</span>` : `<span class="bad">✗</span>`}
      <b>${x.name}</b> <span class="muted">${escapeHtml(x.info)}</span>${x.ok ? "" : `<br><small>${x.fix}</small>`}</li>`).join("")}</ul>
    <div class="box info"><b>Damit kannst du nutzen:</b><ul>${can.map((c) => `<li>${c}</li>`).join("")}</ul></div>
    ${!STATIC && !VM_IDS.some((id) => vmEnv(id)?.vm) && env ? `<div class="btnrow"><button class="primary" data-check="vm">⚙ Zur VM-Zentrale</button></div>` : ""}`;
}
async function openCheck() {
  if (!$("#check-dialog").open) $("#check-dialog").showModal();
  $("#check-body").innerHTML = `<p class="muted">Prüfe deinen PC …</p>`;
  if (!STATIC) await Promise.all([refreshEnv(), refreshSandbox()]);
  renderCheck();
}
$("#check-close").addEventListener("click", () => $("#check-dialog").close());
$("#check-dialog").addEventListener("close", () => { if (!settings.checked) { settings.checked = 1; saveSettings(); } });
$("#check-body").addEventListener("click", (e) => { if (e.target.closest("[data-check='vm']")) { $("#check-dialog").close(); openVmCenter(); } });

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

/* ---------- Kurswahl: Linux oder Windows (PowerShell) ---------- */
function applyTrack() {
  const t = settings.track || "linux";
  document.body.dataset.track = t;
  $(".brand-name").textContent = "rootshell";
  document.title = t === "windows" ? "rootshell · Windows" : "rootshell · Linux";
  $("#btn-track").textContent = t === "windows" ? "🪟 Windows" : "🐧 Linux";
}
function setTrack(t) {
  progress.trackLesson ||= {};
  progress.trackLesson[settings.track || "linux"] = progress.lessonId;
  settings.track = t; saveSettings();
  const wanted = LESSONS.findIndex((l) => l.id === progress.trackLesson[t]);
  progress.lesson = wanted >= 0 ? wanted : trackIdx()[0];
  progress.lessonId = LESSONS[progress.lesson].id; saveProgress();
  currentCard = null; currentMission = null; missionMsg = null;
  applyTrack();
  if (t === "linux" && !vm.emulator) vmBoot();
  const m = t === "windows" ? "ps" : "browser";
  if (mode === m) renderTutor(); else setMode(m);
}
function openTrackDialog() { $("#track-dialog").showModal(); }
$("#btn-track").addEventListener("click", openTrackDialog);
$("#track-dialog").addEventListener("click", (e) => {
  const b = e.target.closest("[data-track]");
  if (!b) return;
  $("#track-dialog").close();
  setTrack(b.dataset.track);
  if (!settings.checked) setTimeout(openCheck, 400);   // beim allerersten Start: zeigen, was eingerichtet ist
});

/* ---------- Start ---------- */
// Direktlinks, z. B. ?track=linux&tab=wargame (praktisch für die Online-Demo und Screenshots)
const qTrack = PARAMS.get("track"), qTab = PARAMS.get("tab");
if (qTrack === "linux" || qTrack === "windows") settings.track = qTrack;
if (TABS.includes(qTab)) settings.tab = qTab;
if (!TABS.includes(settings.tab)) settings.tab = "lessons";
if (STATIC) {
  document.body.dataset.static = "1";
  $("#demo-badge").hidden = false;
}
if (progress.lessonId) { const i = LESSONS.findIndex((l) => l.id === progress.lessonId); if (i >= 0) progress.lesson = i; }
if (!(progress.lesson < LESSONS.length) || !trackIdx().includes(progress.lesson)) progress.lesson = trackIdx()[0];
progress.lessonId = LESSONS[progress.lesson].id;
applyTrack();
document.body.dataset.mode = mode;
if (settings.track === "windows") { setMode("ps"); }
else { bootBanner(); updateStatus(); renderTutor(); vmBoot(); }
refreshEnv();
refreshSandbox();
if (!settings.track) openTrackDialog();
setInterval(() => { if (isRemote() || $("#vm-dialog").open) refreshEnv(); }, 30000);
// Zurück im Fenster (z. B. nach Multipass) → sofort nachsehen statt bis zu 30 s zu warten
window.addEventListener("focus", () => { if (isRemote() && !remote().connected) refreshEnv(); });
