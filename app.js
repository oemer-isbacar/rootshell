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
const KEYS = { progress: "linuxlab.progress.v1", ssh: "linuxlab.ssh.v1", drills: "linuxlab.drills.v1", missions: "linuxlab.missions.v1", settings: "linuxlab.settings.v1" };

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
      if (mode === "browser") { updateStatus(); setTimeout(() => term.focus(), 200); }
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
  connect(opts) {
    this.disconnect();
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
    };
  },
  disconnect() { if (this.ws) { this.ws.close(); this.ws = null; } this.connected = false; this.connecting = false; if (typeof updateStatus === "function") updateStatus(); },
}; }
const ssh = makeRemote("ssh");
const ps = makeRemote("ps", "pwsh");
const win = makeRemote("win");   // echte Windows PowerShell 5.1 in der Windows-Sandbox
const isRemote = () => mode === "ssh" || mode === "ps";
const remote = () => (mode === "ps" ? ps : mode === "win" ? win : ssh);
const vmMode = () => (settings.track === "windows" ? "ps" : "ssh");
function disconnectAll() { ssh.disconnect(); ps.disconnect(); }
let pwshInstalling = false;

/* ---------- Windows-Sandbox ---------- */
let sb = { state: "unknown" };   // unavailable | off | starting | ready
let sbTimer = null;
async function refreshSandbox() {
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

async function connectManaged({ quiet } = {}) {
  const R = mode === "ps" ? ps : ssh;
  if (R.connecting) return false;   // läuft schon
  R.connecting = true; updateStatus();
  const r = await api("vm/prepare-ssh", {});
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
    const ok = await startJob("vm/installPwsh");
    pwshInstalling = false;
    if (!ok) { if (mode === "ps") term.writeln("\x1b[31mInstallation fehlgeschlagen – Details in der ⚙ VM-Zentrale.\x1b[0m"); return false; }
    return connectManaged({ quiet });
  }
  if (mode === R.mode) { term.reset(); R.scroll = ""; }
  R.connect({ host: r.host, username: r.username, managed: true });
  return true;
}

/* ===== Gemeinsam: Befehle verfolgen ===== */
const backend = () => (mode === "browser" ? vm : mode === "ps" ? ps : mode === "win" ? win : ssh);

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
function vmState() { return env?.vm?.state || (env ? "none" : "unknown"); }
function vmIP() { return env?.vm?.ip || null; }

function updateStatus() {
  let cls = "", text = "";
  if (mode === "browser") {
    cls = vm.loggedIn ? "running" : "booting";
    text = vm.loggedIn ? "Mini-Linux läuft · du bist root" : "Mini-Linux startet …";
  } else if (mode === "win") {
    if (win.connected) { cls = "running"; text = "Windows-Sandbox · PowerShell 5.1"; }
    else {
      text = { unavailable: "Windows-Sandbox nicht aktiviert", off: "Sandbox ist aus", starting: "Sandbox startet …", stopping: "Sandbox wird beendet …", ready: win.connecting ? "Verbinde mit der Sandbox …" : "Sandbox läuft · nicht verbunden" }[sb.state] || "Windows-Sandbox";
      cls = sb.state === "starting" || sb.state === "stopping" || win.connecting ? "booting" : sb.state === "ready" ? "warn" : "";
    }
  } else if (job && !job.done) { cls = "booting"; text = job.title + " …"; }
  else if (remote().connected) { cls = "running"; text = `${mode === "ps" ? "PowerShell 7" : "Echte VM"} · ${remote().target}`; }
  else if (remote().connecting) { cls = "booting"; text = `Verbinde mit ${remote().target} …`; }
  else {
    const s = vmState();
    text = { Running: "VM läuft · nicht verbunden", Stopped: "VM ist aus", Suspended: "VM pausiert", Starting: "VM startet …", none: "Noch keine VM", unknown: "Echte VM" }[s] || `VM: ${s}`;
    cls = s === "Running" ? "warn" : "";
  }
  $("#vm-dot").className = "dot " + cls;
  $("#vm-text").textContent = text;
  const s = vmState();
  $("#btn-pause").hidden = s !== "Running";
  $("#btn-resume").hidden = !(s === "Suspended" || s === "Stopped");
  $("#btn-endday").hidden = !(s === "Running" || s === "Suspended" || sb.running);
  $("#btn-sb-start").hidden = !(sb.state === "off" || sb.state === "unknown");
  $("#btn-sb-stop").hidden = !(sb.running || sb.state === "ready");
  $("#btn-ssh").textContent = remote().connected ? "🔌 Trennen" : "🔌 Verbinden";
}

async function refreshEnv() {
  try { env = await api("env"); } catch { env = null; }
  if (env?.multipass?.installed && env?.hyperv?.running !== false) markEvent("env-ready");
  if (env?.vm) markEvent("vm-created");
  updateStatus();
  // VM läuft (z. B. außerhalb der App gestartet), aber keine Verbindung → selbst verbinden (höchstens alle 20 s)
  if (isRemote() && env?.vm?.state === "Running" && env.vm.ip && !remote().connected && !remote().connecting && !pwshInstalling
      && !(job && !job.done) && Date.now() - lastAutoConnect > 20000) {
    lastAutoConnect = Date.now();
    connectManaged({ quiet: true });
  }
  if ($("#vm-dialog").open) renderVmCenter();
  if (settings.tab === "missions") renderMissions();
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
  } else {
    const R = remote();
    if (R.connected) term.write(replayable(R.scroll));
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
        if (e?.vm?.state === "Running") connectManaged({ quiet: true });
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
    h += `<li>${ok(env.ramGB >= 8)} Arbeitsspeicher: ${env.ramGB || "?"} GB <small>(die VM nutzt 2 GB)</small></li>`;
  }
  h += `<li>${ok(mp.installed)} Multipass ${mp.installed ? escapeHtml(mp.version || "") : "nicht installiert"}
    ${!mp.installed ? (env.winget ? `<button data-vm="install">Multipass installieren</button>` : `<small>Download: multipass.run</small>`) : ""}</li></ul></section>`;

  const ready = mp.installed;
  const v = env.vm;
  h += `<section><h4>2 · Deine Übungs-VM <code>${escapeHtml(env.vmName)}</code></h4>`;
  if (!ready) h += `<p class="muted">Erst die Voraussetzungen erfüllen.</p>`;
  else if (!v) {
    h += `<p>Noch keine VM vorhanden. Erstellt wird Ubuntu 24.04 LTS mit 2 CPU-Kernen, 2 GB RAM und 15 GB Platte (wächst nur bei Bedarf).</p>
      <button class="primary" data-vm="launch">🚀 VM erstellen</button>`;
  } else {
    const stateTxt = { Running: "🟢 läuft", Stopped: "⚫ aus", Suspended: "⏸ pausiert", Starting: "🟡 startet", Restarting: "🟡 startet neu", Deleted: "🗑 gelöscht" }[v.state] || v.state;
    h += `<table class="vminfo"><tr><td>Zustand</td><td><b>${stateTxt}</b></td></tr>
      <tr><td>IP-Adresse</td><td>${v.ip ? `<code>${v.ip}</code>` : "–"}</td></tr>
      <tr><td>System</td><td>${escapeHtml(v.release || "")}</td></tr>
      ${v.mem ? `<tr><td>RAM</td><td>${fmtGB(v.mem.used)} von ${fmtGB(v.mem.total)}</td></tr>` : ""}
      ${v.disk ? `<tr><td>Platte</td><td>${fmtGB(v.disk.used)} von ${fmtGB(v.disk.total)}</td></tr>` : ""}</table>
      <div class="btnrow">
        ${v.state === "Running" ? `<button data-vm="connect" class="primary">🔌 Verbinden</button><button data-vm="suspend">☕ Pause</button><button data-vm="stop">🌙 Herunterfahren</button>`
          : `<button data-vm="start" class="primary">▶ ${v.state === "Suspended" ? "Fortsetzen" : "Starten"}</button>`}
      </div>`;
  }
  h += `</section>`;

  if (v) {
    h += `<section><h4>3 · Snapshots (Sicherungspunkte)</h4><ul class="snaps">`;
    for (const s of env.snapshots) {
      h += `<li><code>${escapeHtml(s.name)}</code> <small>${escapeHtml(s.comment)}</small>
        <button data-vm="restore" data-name="${escapeHtml(s.name)}">↺ zurückspielen</button>
        <button data-vm="delsnap" data-name="${escapeHtml(s.name)}" class="ghost">🗑</button></li>`;
    }
    if (!env.snapshots.length) h += `<li class="muted">Noch keine Snapshots.</li>`;
    h += `</ul><div class="btnrow"><input id="snap-name" placeholder="z. B. vor-lemp" maxlength="30"><button data-vm="snapshot">📸 Snapshot anlegen</button></div>
      <p class="muted small">Die VM wird dafür kurz angehalten und danach wieder gestartet.</p></section>`;
  }

  h += `<section><h4>4 · Ressourcen schonen</h4>
    <label class="inline">Automatisch pausieren nach <select id="idle-min">
      ${[0, 15, 30, 60, 120].map((n) => `<option value="${n}" ${settings.idleMin === n ? "selected" : ""}>${n ? n + " Minuten" : "nie"}</option>`).join("")}
    </select> ohne Eingabe</label>
    ${v ? `<p class="muted small">Fertig mit dem Kurs? Du kannst die VM behalten (gestoppt braucht sie keinen RAM) oder komplett löschen.</p>
    <button data-vm="delete" class="danger">🗑 VM löschen</button>` : ""}</section>`;

  h += `<section><h4>Andere Maschine (Proxmox, Server, …)</h4>
    <button data-vm="manual">Per IP + Passwort verbinden …</button></section>`;
  box.innerHTML = h;
  $("#idle-min").addEventListener("change", (e) => { settings.idleMin = +e.target.value; saveSettings(); toast(settings.idleMin ? `Auto-Pause nach ${settings.idleMin} Min.` : "Auto-Pause aus"); });
}

$("#vm-body").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-vm]");
  if (!b) return;
  const a = b.dataset.vm;
  if (a === "install") {
    if (!confirm("Multipass (von Canonical) jetzt über winget installieren?\nWindows fragt evtl. nach Administratorrechten.")) return;
    startJob("install/multipass");
  } else if (a === "hyperv") {
    if (!confirm("Hyper-V aktivieren?\n\nWindows fragt nach Administratorrechten. Danach ist ein NEUSTART nötig.")) return;
    startJob("install/hyperv");
  } else if (a === "launch") {
    startJob("vm/launch", {}, { after: async (ok) => { if (ok) { markEvent("vm-created"); setMode(vmMode()); await connectManaged(); } } });
  } else if (a === "start") {
    startJob("vm/start", {}, { after: async (ok) => { if (ok) { $("#vm-dialog").close(); setMode(vmMode()); await connectManaged(); } } });
  } else if (a === "connect") {
    $("#vm-dialog").close(); setMode(vmMode()); connectManaged();
  } else if (a === "suspend") { doPause(); }
  else if (a === "stop") { disconnectAll(); startJob("vm/stop"); }
  else if (a === "snapshot") {
    const name = ($("#snap-name").value || "").trim() || "punkt-" + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    disconnectAll();
    startJob("vm/snapshot", { name, comment: new Date().toLocaleString("de-DE") }, { after: (ok) => ok && isRemote() && connectManaged({ quiet: true }) });
  } else if (a === "restore") {
    if (!confirm(`VM auf „${b.dataset.name}“ zurücksetzen?\nAlles, was du seitdem geändert hast, ist danach weg.`)) return;
    disconnectAll();
    startJob("vm/restore", { name: b.dataset.name }, { after: (ok) => ok && isRemote() && connectManaged({ quiet: true }) });
  } else if (a === "delsnap") {
    if (!confirm(`Snapshot „${b.dataset.name}“ löschen?`)) return;
    startJob("vm/deleteSnapshot", { name: b.dataset.name });
  } else if (a === "delete") {
    if (!confirm("Die VM fis-lab wirklich LÖSCHEN?\nAlle Dateien, Dienste und Snapshots darin sind danach weg. (Du kannst jederzeit eine neue erstellen.)")) return;
    if (prompt('Zur Sicherheit bitte "löschen" eintippen:') !== "löschen") return;
    disconnectAll();
    startJob("vm/delete");
  } else if (a === "manual") {
    $("#vm-dialog").close(); openSshDialog();
  }
});

/* ---------- Pause / Fortsetzen / Feierabend ---------- */
async function doPause(auto) {
  disconnectAll();
  if (isRemote()) { term.writeln(`\r\n\x1b[33m☕ VM wird pausiert${auto ? " (keine Eingabe seit " + settings.idleMin + " Minuten)" : ""} …\x1b[0m`); }
  const ok = await startJob("vm/suspend");
  if (ok && isRemote()) term.writeln("\x1b[33m⏸ Pausiert. Weiter mit „▶ Fortsetzen“ oben.\x1b[0m");
}
$("#btn-pause").addEventListener("click", () => doPause());
$("#btn-resume").addEventListener("click", () => startJob("vm/start", {}, { after: (ok) => ok && connectManaged() }));
$("#btn-endday").addEventListener("click", () => $("#endday-dialog").showModal());
$("#endday-form").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "ok") return;
  const stopVm = $("#endday-vm").checked, saveMini = $("#endday-mini").checked;
  if (saveMini && vm.emulator) {
    try { await idbPut("snapshot", await vm.emulator.save_state()); } catch {}
  }
  if (sb.running) await stopSandbox(false);
  if (stopVm && (vmState() === "Running" || vmState() === "Suspended")) {
    disconnectAll();
    await startJob("vm/stop");
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
  if (vmState() === "Running") return connectManaged();
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
  $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === settings.tab));
  $$(".tabpane").forEach((p) => (p.hidden = p.dataset.pane !== settings.tab));
  if (settings.tab === "lessons") renderLesson();
  else if (settings.tab === "train") renderTraining();
  else renderMissions();
}
$$(".tabs button").forEach((b) => b.addEventListener("click", () => { settings.tab = b.dataset.tab; saveSettings(); renderTutor(); }));

const subIP = (html) => html.replace(/\{\{IP\}\}/g, vmIP() || "IP-DEINER-VM");

/* ---------- Lektionen ---------- */
const GROUPS = { browser: "Teil 1 · Grundlagen im Mini-Linux", ssh: "Teil 2 · Echte VM – Installationen & Dienste (FISI)", self: "Teil 3 · Selbst hosten",
  ps: "Teil 1 · PowerShell-Grundlagen", "ps-admin": "Teil 2 · Windows-Verwaltung", win: "Teil 3 · Echtes Windows (Sandbox)" };
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

function renderLesson(scrollToActive = false) {
  const lesson = LESSONS[progress.lesson];
  const done = doneSet(lesson.id);
  const active = lesson.steps.findIndex((_, i) => !done.has(i));
  const lmode = lesson.mode || "browser";
  let html = `<h2>${lesson.title}</h2>`;
  if (lmode !== mode) {
    html += lmode === "win"
      ? (mode === "win" ? "" : `<div class="box warn">Diese Lektion läuft in der <b>Windows-Sandbox</b> – einem echten Windows. <button data-mode="win">🪟 Zur Windows-Sandbox</button></div>`)
      : lmode === "ps"
      ? `<div class="box warn">Diese Lektion läuft in <b>PowerShell</b>. <button data-mode="ps">⚡ Zu PowerShell wechseln</button></div>`
      : lmode === "ssh"
      ? `<div class="box warn">Diese Lektion läuft auf der <b>echten VM</b> (Ubuntu), weil hier Software installiert wird. <button data-mode="ssh">🔌 Zur echten VM wechseln</button></div>`
      : `<div class="box warn">Diese Lektion ist fürs <b>Mini-Linux</b> gedacht (geht aber meist auch auf der VM). <button data-mode="browser">🖥 Zum Mini-Linux wechseln</button></div>`;
  }
  if (lmode === "win" && mode === "win" && !win.connected) {
    html += sb.state === "unavailable"
      ? `<div class="box warn">Die Windows-Sandbox ist auf diesem PC nicht aktiviert.</div>`
      : sb.state === "starting" ? `<div class="box tip">⏳ Die Sandbox startet gerade …</div>`
      : `<div class="box warn">Die Sandbox läuft noch nicht. <button data-action="sb-start" class="primary">▶ Sandbox starten</button></div>`;
  }
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
    html += `<div class="lesson-done">🎉 Lektion abgeschlossen!${progress.lesson < trackIdx().slice(-1)[0] ? " Weiter geht's mit der nächsten." : ""}<br><small>Neue Trainingskarten sind jetzt im Tab 🔁 Training freigeschaltet.</small></div>`;
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
// damit Log-Zeilen (journalctl, grep in Logs) nicht fälschlich als Fehler zählen.
const ERR_LINE_RE = /^(?:[^\s:]+:.*(?:No such file or directory|command not found|: not found|Permission denied|Keine Berechtigung|nicht gefunden|invalid option|unrecognized option|unknown option|ungültige Option|missing (?:file )?operand|fehlender Operand|Is a directory|Not a directory|cannot access|can't (?:open|create|remove|cd|access|stat)|syntax error|Syntaxfehler|applet not found|Usage: |usage: |is not recognized|Cannot find|does not exist|cannot be found|A parameter cannot be found|Cannot bind|Cannot convert|is denied|Could not find)|E: |ERROR|Failed to |Unit \S+ (?:could not be found|not found)|ParserError|InvalidOperation:|\s+\+ (?:CategoryInfo|FullyQualifiedErrorId)\s+:|\s+\| .*(?:is not recognized|Cannot find|does not exist|Unexpected token|Missing ))/;
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
  const md = e.target.closest("[data-mode]");
  if (md && !md.closest(".mode-switch")) { setMode(md.dataset.mode); return; }
  const act = e.target.closest("[data-action]");
  if (act?.dataset.action === "vm-center") { openVmCenter(); return; }
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
  const managed = onSb ? sb.state === "ready" : vmState() === "Running";
  let h = `<h2>🎯 Missionen</h2>
    <p class="intro">Echte Störfälle wie im Admin-Alltag. Die App baut den Fehler <b>unbemerkt</b> ein – du findest heraus, was los ist, und reparierst es. Ohne Schritt-für-Schritt-Anleitung.${settings.track === "windows" ? " Missionen mit 🪟 laufen in der Windows-Sandbox." : ""}</p>`;
  if (currentMission && !managed) h += onSb
    ? `<div class="box warn">Diese Mission läuft in der Windows-Sandbox – die muss laufen. <button data-action="sb-start">▶ Sandbox starten</button></div>`
    : `<div class="box warn">Diese Mission läuft auf der Übungs-VM – die muss laufen. <button data-action="vm-center">⚙ VM-Zentrale</button></div>`;
  else if (currentMission && mode !== want) h += `<div class="box warn">Wechsle ins passende Terminal. <button data-mode="${want}">${{ ps: "⚡ Zu PowerShell 7", win: "🪟 Zur Windows-Sandbox", ssh: "🔌 Zur echten VM" }[want]}</button></div>`;
  if (!currentMission) {
    const solved = trackMissions().filter((x) => mState(x.id).solved).length;
    h += `<p class="muted small">${solved} von ${trackMissions().length} gelöst · Tipp: Vor einer Mission einen Snapshot anlegen.</p><ul class="mlist">`;
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
        <button data-maction="verify" ${managed && s.started ? "" : "disabled"}>✓ Prüfen</button>
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
    const ok = await startJob(`mission/${mi.id}/setup`, {});
    if (ok) {
      s.started = true; s.hints = 0; saveMissions();
      missionMsg = { ok: true, text: "Mission vorbereitet. Viel Erfolg! 🕵️" };
      const want = mi.target === "sandbox" ? "win" : vmMode();
      if (mode !== want) setMode(want);
      if (!remote().connected) { if (want === "win") connectSandbox(); else await connectManaged({ quiet: true }); }
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
});

/* ---------- Start ---------- */
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
