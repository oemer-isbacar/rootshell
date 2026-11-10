// rootshell – lokaler Server: liefert die App aus, verwaltet die Übungs-VM (Multipass)
// und leitet das Terminal per SSH weiter. Lauscht nur auf 127.0.0.1 – von außen nicht erreichbar.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { StringDecoder } = require("string_decoder");
const { WebSocketServer } = require("ws");
const vmSandbox = require("vm");
const { Client } = require("ssh2");
const vmctl = require("./vmctl");
const sandbox = require("./sandbox");
const MISSIONS = require("./missions");

const PORT = Number(process.env.PORT) || 8086;
const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm", ".bin": "application/octet-stream", ".json": "application/json",
  ".yaml": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
const PUBLIC = ["index.html", "app.js", "topics.js", "lessons.js", "lessons-ps.js", "lessons-win.js", "lessons-script.js", "lessons-sec.js", "lessons-net.js", "lessons-devops.js", "lessons-db.js", "sql-cases.js", "zip.js", "quiz.js", "wargame.js", "drills.js", "missions.js", "style.css", "fis-lab.yaml", "lib/", "vm/"];
const HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const ORIGINS = new Set([...HOSTS].map((h) => "http://" + h));

/* Lektionen serverseitig laden (wie im Browser, in Reihenfolge aus index.html) – nur um prep-Skripte
 * vordefinierter Übungen zu finden. Der Browser schickt nur die Lektions-ID, nie ein Skript. */
let lessonCache = null;
function lessons() {
  if (lessonCache) return lessonCache;
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  // alle Inhaltsdateien (Lektionsdateien hängen auch Trainingskarten an DRILLS an) – ohne Bibliotheken und app.js
  const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !s.startsWith("lib/") && s !== "app.js");
  const ctx = { window: {}, console };
  ctx.window.window = ctx.window;
  vmSandbox.createContext(ctx);
  for (const f of files) vmSandbox.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  return (lessonCache = ctx.window.LESSONS || []);
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = ""; req.on("data", (d) => { b += d; if (b.length > 1e5) req.destroy(); });
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}

async function api(req, res, p) {
  // Schutz: nur die eigene Seite darf die API nutzen (kein Zugriff von fremden Webseiten)
  if (req.headers["x-linuxlab"] !== "1" || (req.headers.origin && !ORIGINS.has(req.headers.origin))) return sendJson(res, 403, { error: "forbidden" });
  try {
    if (req.method === "GET" && p === "api/env") return sendJson(res, 200, await vmctl.env());
    if (req.method === "GET" && p.startsWith("api/jobs/")) {
      const j = vmctl.getJob(p.slice(9)); return j ? sendJson(res, 200, j) : sendJson(res, 404, { error: "unbekannter Job" });
    }
    if (req.method === "GET" && p === "api/sandbox") return sendJson(res, 200, await sandbox.status());
    if (req.method !== "POST") return sendJson(res, 405, { error: "method" });
    if (p === "api/sandbox/start") return sendJson(res, 200, await sandbox.start());
    if (p === "api/sandbox/stop") return sendJson(res, 200, await sandbox.stop());
    const body = await readBody(req);
    const m = p.match(/^api\/vm\/(\w+)$/);
    if (m && vmctl.actions[m[1]] && !["installMultipass", "enableHyperV"].includes(m[1])) return sendJson(res, 200, vmctl.actions[m[1]](body));
    if (p === "api/install/multipass") return sendJson(res, 200, vmctl.actions.installMultipass());
    if (p === "api/install/hyperv") return sendJson(res, 200, vmctl.actions.enableHyperV());
    if (p === "api/vm/prepare-ssh") {
      const prof = vmctl.profile(body.vm);
      const v = (await vmctl.env()).vms[prof.id].vm;
      if (!v || v.state !== "Running" || !v.ip) return sendJson(res, 409, { error: `Die ${prof.label} läuft nicht.` });
      const r = await vmctl.ensureKey(prof.id);
      return sendJson(res, 200, { ok: r.ok, vm: prof.id, host: v.ip, username: "ubuntu", pwsh: r.pwsh, error: r.ok ? undefined : r.stderr.slice(0, 300) });
    }
    if (p === "api/vm/prepare") {
      // Übung vorbereiten: Übungs-VM auf „basis“ zurücksetzen, dann das prep-Skript der Lektion ausführen
      const l = lessons().find((x) => x.id === body.lesson);
      if (!l || l.vm !== "uebung") return sendJson(res, 404, { error: "Keine Übung mit dieser ID." });
      return sendJson(res, 200, vmctl.prepareJob("Übung vorbereiten", l.prep || "", `„${l.title}“ wird vorbereitet …`));
    }
    const mm = p.match(/^api\/mission\/([\w-]+)\/(setup|verify)$/);
    if (mm) {
      const mission = MISSIONS.find((x) => x.id === mm[1]);
      if (!mission) return sendJson(res, 404, { error: "unbekannte Mission" });
      if (mission.target === "sandbox") {
        if (mm[2] === "setup") {
          return sendJson(res, 200, vmctl.newJob("Mission vorbereiten", [
            async (job) => {
              job.log += "\n▶ Szenario wird in der Windows-Sandbox vorbereitet …\n";
              const r = await sandbox.exec(mission.setup);
              job.log += r.output + "\n";
              return r.ok;
            },
            async (job) => { job.log += "\n✅ Bereit – leg los!\n"; return true; },
          ]));
        }
        const r = await sandbox.exec(mission.verify, 60000);
        return sendJson(res, 200, { ok: r.ok, output: r.output.slice(-2000) });
      }
      // Linux-Missionen laufen in der Übungs-VM – vorher zurück auf „basis“, damit dein Server unberührt bleibt
      if (mm[2] === "setup") return sendJson(res, 200, vmctl.prepareJob("Mission vorbereiten", mission.setup, "Szenario wird in der Übungs-VM vorbereitet …"));
      const r = await vmctl.execScript(mission.verify, 60000, "uebung");
      return sendJson(res, 200, { ok: r.ok, output: (r.stdout + r.stderr).trim().slice(-2000) });
    }
    return sendJson(res, 404, { error: "unbekannt" });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}

const server = http.createServer((req, res) => {
  if (!HOSTS.has(req.headers.host)) { res.writeHead(421); return res.end("Misdirected"); } // Schutz gegen DNS-Rebinding
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
  if (p.startsWith("api/")) return api(req, res, p);
  if (!PUBLIC.some((a) => (a.endsWith("/") ? p.startsWith(a) : p === a)) || p.includes("..")) {
    res.writeHead(404); return res.end("Not found");
  }
  const file = path.join(ROOT, p);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
});

const wss = new WebSocketServer({
  server, path: "/ssh",
  verifyClient: ({ origin, req }) => ORIGINS.has(origin) && HOSTS.has(req.headers.host),
});

wss.on("connection", (ws) => {
  const conn = new Client();
  let stream = null;
  const decoder = new StringDecoder("utf8");
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));

  ws.on("message", (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === "connect" && !stream && msg.target === "sandbox") {
      const dec = new StringDecoder("utf8");
      sandbox.shell(msg.cols || 80, msg.rows || 24,
        (d) => send({ type: "data", data: dec.write(d) }),
        () => { send({ type: "closed" }); ws.close(); })
        .then((sh) => {
          stream = { write: sh.write, setWindow: (rows, cols) => sh.resize(cols, rows), close: sh.close };
          send({ type: "ready" });
        })
        .catch((e) => { send({ type: "error", message: e.message }); ws.close(); });
      return;
    }
    if (msg.type === "connect" && !stream) {
      conn.on("ready", () => {
        const pty = { term: "xterm-256color", cols: msg.cols || 80, rows: msg.rows || 24 };
        // PowerShell-Modus: fester Befehl (der Browser wählt nur den Modus, nie den Befehl).
        // Vorschläge (graue Zukunftstexte) aus, damit die App die Eingabezeile sauber lesen kann.
        const open = msg.shell === "pwsh"
          ? (cb) => conn.exec("pwsh -NoLogo -NoExit -Command 'Set-PSReadLineOption -PredictionSource None; Set-Location ~'", { pty }, cb)
          : (cb) => conn.shell(pty, cb);
        open((err, s) => {
          if (err) { send({ type: "error", message: err.message }); return ws.close(); }
          stream = s;
          send({ type: "ready" });
          s.on("data", (d) => send({ type: "data", data: decoder.write(d) }));
          s.stderr.on("data", (d) => send({ type: "data", data: d.toString("utf8") }));
          s.on("close", () => { send({ type: "closed" }); conn.end(); ws.close(); });
        });
      });
      conn.on("error", (e) => { send({ type: "error", message: e.message }); ws.close(); });
      conn.on("keyboard-interactive", (_n, _i, _l, prompts, finish) => finish(prompts.map(() => msg.password || "")));
      const opts = { host: msg.host, port: Number(msg.port) || 22, username: msg.username, readyTimeout: 20000, keepaliveInterval: 20000 };
      if (msg.managed) opts.privateKey = vmctl.getKey().private;   // App-VM: Login per Schlüssel
      else { opts.password = msg.password; opts.tryKeyboard = true; }
      conn.connect(opts);
    } else if (msg.type === "data" && stream) {
      stream.write(msg.data);
    } else if (msg.type === "resize" && stream) {
      stream.setWindow(msg.rows, msg.cols, 0, 0);
    }
  });
  ws.on("close", () => { conn.end(); if (stream && stream.close) try { stream.close(); } catch {} });
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;
server.requestTimeout = 0; // lange Aktionen (Prüfskripte) nicht abbrechen

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  rootshell läuft:  http://localhost:${PORT}\n  (Fenster offen lassen – Strg+C beendet den Server)\n`);
});
