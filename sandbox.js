/* Steuerung der Windows-Sandbox: starten, Status, Befehle ausführen, Terminal öffnen, beenden.
 * In der Sandbox läuft sandbox/agent.ps1 (Logon-Befehl) mit dem Agenten aus sandbox/LabAgent.cs.
 */
const fs = require("fs");
const path = require("path");
const net = require("net");
const crypto = require("crypto");
const { spawn, execFile } = require("child_process");

const DATA = path.join(__dirname, "data");
const IN = path.join(DATA, "sandbox-in");    // in der Sandbox: C:\lab (schreibgeschützt)
const OUT = path.join(DATA, "sandbox-out");  // in der Sandbox: C:\labout (Rückkanal)
const WSB = path.join(DATA, "linux-lab.wsb");
const EXE = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsSandbox.exe");

let startedAt = 0;

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "")); } catch { return null; } };
const readText = (f) => { try { return fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "").trim(); } catch { return ""; } };
const token = () => readText(path.join(IN, "token.txt"));

function processes() {
  return new Promise((resolve) => {
    execFile("tasklist", ["/FO", "CSV", "/NH"], { windowsHide: true }, (err, stdout) => {
      if (err) return resolve([]);
      resolve(String(stdout).split(/\r?\n/).map((l) => (l.match(/^"([^"]+)"/) || [])[1]).filter((n) => n && /^WindowsSandbox/i.test(n)));
    });
  });
}

/* Eine Verbindung zum Agenten: Kopfzeile senden, Rohdaten zurück */
function connect(head, extra = "", timeout = 8000) {
  return new Promise((resolve, reject) => {
    const r = readJson(path.join(OUT, "ready.json"));
    if (!r || !r.ip) return reject(new Error("Die Sandbox ist noch nicht bereit."));
    const s = net.connect(r.port || 7777, r.ip);
    s.setTimeout(timeout, () => { s.destroy(); reject(new Error("Zeitüberschreitung beim Verbinden mit der Sandbox.")); });
    s.once("error", reject);
    s.once("connect", () => { s.setTimeout(0); s.removeListener("error", reject); s.write(`${token()} ${head}\n${extra}`); resolve(s); });
  });
}

function ping() {
  return connect("PING", "", 3000).then((s) => new Promise((res) => {
    let o = ""; s.on("data", (d) => (o += d)); s.on("close", () => res(o.startsWith("PONG"))); s.on("error", () => res(false));
  })).catch(() => false);
}

let cache = { t: 0, v: null };
async function status() {
  if (Date.now() - cache.t < 2000 && cache.v) return cache.v;
  const available = process.platform === "win32" && fs.existsSync(EXE);
  const procs = available ? await processes() : [];
  const running = procs.length > 0;
  const ready = readJson(path.join(OUT, "ready.json"));
  const error = readText(path.join(OUT, "error.txt"));
  let reachable = false;
  if (running && ready?.ip) reachable = await ping();
  const v = {
    available, running, ip: ready?.ip || null, reachable, error: error || null,
    state: !available ? "unavailable" : !running ? (Date.now() - startedAt < 20000 ? "starting" : "off") : reachable ? "ready" : "starting",
  };
  cache = { t: Date.now(), v };
  return v;
}

async function start() {
  const st = await status();
  if (!st.available) return { error: "Windows-Sandbox ist auf diesem PC nicht aktiviert." };
  if (st.running) return { ok: true, already: true };
  fs.mkdirSync(IN, { recursive: true });
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of ["agent.ps1", "LabAgent.cs"]) fs.copyFileSync(path.join(__dirname, "sandbox", f), path.join(IN, f));
  fs.writeFileSync(path.join(IN, "token.txt"), crypto.randomBytes(24).toString("hex"));
  fs.writeFileSync(WSB, `<Configuration>
  <VGpu>Disable</VGpu>
  <Networking>Enable</Networking>
  <MemoryInMB>3072</MemoryInMB>
  <MappedFolders>
    <MappedFolder><HostFolder>${IN}</HostFolder><SandboxFolder>C:\\lab</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>${OUT}</HostFolder><SandboxFolder>C:\\labout</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\\lab\\agent.ps1</Command></LogonCommand>
</Configuration>
`);
  const p = spawn(EXE, [WSB], { detached: true, stdio: "ignore", windowsHide: false });
  p.on("error", () => {});
  p.unref();
  startedAt = Date.now();
  cache.t = 0;
  return { ok: true };
}

/* Skript (PowerShell 5.1) in der Sandbox ausführen → { ok, code, output } */
async function exec(script, timeout = 300000) {
  const b64 = Buffer.from(script, "utf16le").toString("base64");
  const s = await connect("EXEC", b64 + "\n");
  return new Promise((resolve) => {
    let out = "";
    const timer = setTimeout(() => { s.destroy(); resolve({ ok: false, code: -1, output: out + "\n(Zeitüberschreitung)" }); }, timeout);
    s.on("data", (d) => (out += d.toString("utf8")));
    s.on("close", () => {
      clearTimeout(timer);
      const m = out.match(/\n__EXIT__=(-?\d+)\n?$/);
      const code = m ? +m[1] : -1;
      resolve({ ok: code === 0, code, output: out.replace(/\n__EXIT__=-?\d+\n?$/, "").replace(/\r/g, "").trim() });
    });
    s.on("error", () => {});
  });
}

/* Terminal: gibt ein Objekt mit write/resize/close zurück; Ausgabe kommt über onData */
async function shell(cols, rows, onData, onClose) {
  const s = await connect(`SHELL ${cols | 0 || 80} ${rows | 0 || 24}`);
  s.setNoDelay(true);
  s.on("data", onData);
  s.on("close", onClose);
  s.on("error", () => {});
  const frame = (type, buf) => { const h = Buffer.alloc(5); h[0] = type; h.writeUInt32BE(buf.length, 1); return Buffer.concat([h, buf]); };
  return {
    write: (str) => s.write(frame(0, Buffer.from(str, "utf8"))),
    resize: (c, r) => { const b = Buffer.alloc(4); b.writeUInt16BE(c, 0); b.writeUInt16BE(r, 2); s.write(frame(1, b)); },
    close: () => s.destroy(),
  };
}

/* Beenden: Windows in der Sandbox herunterfahren (schließt das Fenster), notfalls Prozesse beenden */
async function stop() {
  try { await exec("Stop-Computer -Force", 5000); } catch {}
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (!(await processes()).length) break;
  }
  const left = await processes();
  for (const n of left) execFile("taskkill", ["/F", "/IM", n], { windowsHide: true }, () => {});
  fs.rmSync(OUT, { recursive: true, force: true });
  cache.t = 0;
  return { ok: true };
}

module.exports = { status, start, stop, exec, shell };
