// VM-Steuerung für rootshell: Multipass, Hyper-V, SSH-Schlüssel, Hintergrund-Jobs
"use strict";
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { utils: sshUtils } = require("ssh2");

const VM = "fis-lab";
const DATA = path.join(__dirname, "data");
const KEY_FILE = path.join(DATA, "id_ed25519");
const PASSWORD = "linuxlab"; // Übungs-Passwort der Lab-VM (steht auch in fis-lab.yaml)
fs.mkdirSync(DATA, { recursive: true });

/* ---------- SSH-Schlüssel der App ---------- */
function getKey() {
  if (!fs.existsSync(KEY_FILE)) {
    const k = sshUtils.generateKeyPairSync("ed25519", { comment: "linux-lab" });
    fs.writeFileSync(KEY_FILE, k.private, { mode: 0o600 });
    fs.writeFileSync(KEY_FILE + ".pub", k.public.trim() + "\n");
  }
  return { private: fs.readFileSync(KEY_FILE, "utf8"), public: fs.readFileSync(KEY_FILE + ".pub", "utf8").trim() };
}

/* ---------- Multipass finden ---------- */
const MP_DEFAULT = "C:\\Program Files\\Multipass\\bin\\multipass.exe";
function mpPath() {
  if (process.platform === "win32" && fs.existsSync(MP_DEFAULT)) return MP_DEFAULT;
  return "multipass";
}
function run(cmd, args, { input, timeout = 60000 } = {}) {
  return new Promise((resolve) => {
    const p = execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, code: err ? err.code : 0, stdout: String(stdout), stderr: String(stderr) });
    });
    if (input != null) { p.stdin.end(input); }
  });
}
const mp = (args, opts) => run(mpPath(), args, opts);
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };

/* ---------- Umgebung prüfen ---------- */
const PS_ENV = `
$cs=Get-CimInstance Win32_ComputerSystem; $os=Get-CimInstance Win32_OperatingSystem
$p=Get-CimInstance Win32_Processor | Select-Object -First 1
$v=Get-Service vmms -ErrorAction SilentlyContinue; $m=Get-Service Multipass -ErrorAction SilentlyContinue
[pscustomobject]@{ hypervisor=[bool]$cs.HypervisorPresent; os=$os.Caption; virtFirmware=[bool]$p.VirtualizationFirmwareEnabled;
  vmms=$(if($v){$v.Status.ToString()}else{'missing'}); mpService=$(if($m){$m.Status.ToString()}else{'missing'});
  winget=[bool](Get-Command winget -ErrorAction SilentlyContinue); ramGB=[math]::Round($cs.TotalPhysicalMemory/1GB) } | ConvertTo-Json -Compress`;

let hostCache = null, hostCacheAt = 0, inflight = null, mpCache = null;
async function hostInfo() {
  // Windows/Hyper-V ändert sich selten → 2 Minuten zwischenspeichern (außer es fehlt noch etwas)
  if (hostCache && Date.now() - hostCacheAt < (hostCache.hyperv?.running ? 120000 : 10000)) return hostCache;
  const out = {};
  if (process.platform === "win32") {
    const r = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", PS_ENV], { timeout: 30000 });
    Object.assign(out, json(r.stdout.trim()) || {});
    const home = /home/i.test(out.os || "");
    out.hyperv = { supported: !home, enabled: out.vmms !== "missing", running: !!out.hypervisor, firmware: out.virtFirmware };
  }
  hostCache = out; hostCacheAt = Date.now();
  return out;
}
async function mpInfo() {
  if (mpCache?.installed) return mpCache;
  const v = await mp(["version"], { timeout: 15000 });
  mpCache = { installed: v.ok, version: (v.stdout.match(/multipass\s+(\S+)/) || [])[1] || null };
  return mpCache;
}
function env() {
  // gleichzeitige Anfragen teilen sich eine Abfrage
  if (!inflight) inflight = envNow().finally(() => { inflight = null; });
  return inflight;
}
async function envNow() {
  const [host, mpi] = await Promise.all([hostInfo(), mpInfo()]);
  const out = { platform: process.platform, vmName: VM, ...host, multipass: mpi, vm: null, snapshots: [] };
  if (mpi.installed) {
    const [info, s] = await Promise.all([
      mp(["info", VM, "--format", "json"], { timeout: 30000 }),
      mp(["list", "--snapshots", "--format", "json"], { timeout: 30000 }),
    ]);
    const i = json(info.stdout)?.info?.[VM];
    if (i) {
      out.vm = {
        state: i.state, ip: (i.ipv4 || [])[0] || null, release: i.release || i.image_release,
        cpus: +i.cpu_count || null, mem: i.memory, disk: Object.values(i.disks || {})[0] || null, load: i.load,
      };
      const snaps = json(s.stdout)?.info?.[VM] || {};
      out.snapshots = Object.keys(snaps).map((n) => ({ name: n, comment: snaps[n].comment || "" }));
    }
  }
  return out;
}

/* ---------- Jobs (lange Aktionen mit Live-Log) ---------- */
const jobs = new Map();
let busy = null;
function clean(s) {
  return s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/[\/\-\\|]?\x08/g, "").replace(/(?:[\/\-\\|] ?){3,}/g, "").replace(/\r/g, "\n").replace(/\n{2,}/g, "\n");
}
function newJob(title, steps) {
  if (busy && !jobs.get(busy)?.done) return { error: "Es läuft schon eine Aktion – bitte warten." };
  const job = { id: Math.random().toString(36).slice(2), title, log: "", progress: null, done: false, ok: null, started: Date.now() };
  jobs.set(job.id, job); busy = job.id;
  (async () => {
    try {
      for (const step of steps) {
        const res = await step(job);
        if (res === false) { job.ok = false; break; }
      }
      if (job.ok === null) job.ok = true;
    } catch (e) { job.log += "\nFehler: " + e.message; job.ok = false; }
    job.done = true;
  })();
  return { id: job.id };
}
function spawnStep(cmd, args, label, { input } = {}) {
  return (job) => new Promise((resolve) => {
    if (label) job.log += `\n▶ ${label}\n`;
    const p = spawn(cmd, args, { windowsHide: true });
    const on = (d) => {
      const t = clean(d.toString());
      const pct = [...t.matchAll(/(\d{1,3})%/g)].pop();
      if (pct) job.progress = +pct[1];
      job.log = (job.log + t.replace(/Retrieving image: \d+%/g, "")).replace(/[\/\-\\|]{3,}\s*/g, "").replace(/\n{2,}/g, "\n");
      if (job.log.length > 20000) job.log = job.log.slice(-20000);
    };
    p.stdout.on("data", on); p.stderr.on("data", on);
    if (input != null) p.stdin.end(input);
    p.on("error", (e) => { job.log += `\n${e.message}\n`; resolve(false); });
    p.on("close", (code) => { job.progress = null; resolve(code === 0 ? true : (job.log += `\n(Exit-Code ${code})\n`, false)); });
  });
}
const mpStep = (args, label, opts) => spawnStep(mpPath(), args, label, opts);
const getJob = (id) => jobs.get(id) || null;

/* ---------- Cloud-Init mit App-Schlüssel ---------- */
function cloudInit() {
  const key = getKey().public;
  const file = path.join(DATA, "cloud-init.yaml");
  fs.writeFileSync(file, `#cloud-config
hostname: ${VM}
ssh_pwauth: true
chpasswd:
  expire: false
  users:
    - name: ubuntu
      password: ${PASSWORD}
      type: text
ssh_authorized_keys:
  - ${key}
package_update: true
packages: [tree, curl, htop]
`);
  return file;
}

/* Schlüssel in eine bestehende VM eintragen (z. B. wenn sie von Hand angelegt wurde) */
async function ensureKey() {
  const key = getKey().public;
  const script = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && grep -qF '${key}' ~/.ssh/authorized_keys || echo '${key}' >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys; command -v pwsh >/dev/null && echo PWSH=1 || echo PWSH=0`;
  const r = await mp(["exec", VM, "--", "bash", "-c", script], { timeout: 30000 });
  r.pwsh = /PWSH=1/.test(r.stdout);
  return r;
}

/* Skript als root in der VM ausführen (nur für vordefinierte Missionen) */
function execScript(script, timeout = 600000) {
  const b64 = Buffer.from(script, "utf8").toString("base64");
  return mp(["exec", VM, "--", "sudo", "bash", "-c", `echo ${b64} | base64 -d | bash`], { timeout });
}
function scriptStep(script, label) {
  const b64 = Buffer.from(script, "utf8").toString("base64");
  return mpStep(["exec", VM, "--", "sudo", "bash", "-c", `echo ${b64} | base64 -d | bash`], label);
}

/* ---------- Aktionen ---------- */
const actions = {
  launch({ cpus = 2, mem = "2G", disk = "15G" } = {}) {
    return newJob("VM erstellen", [
      mpStep(["launch", "24.04", "--name", VM, "--cpus", String(cpus), "--memory", String(mem), "--disk", String(disk), "--cloud-init", cloudInit(), "--timeout", "1200"], "Ubuntu 24.04 herunterladen und VM starten (beim ersten Mal einige Minuten) …"),
      async (job) => { job.log += "\n▶ Sicherungspunkt „frisch“ anlegen …\n"; return true; },
      mpStep(["stop", VM]), mpStep(["snapshot", VM, "--name", "frisch", "--comment", "Direkt nach der Erstellung"]), mpStep(["start", VM]),
      async (job) => { job.log += "\n✅ Fertig! Die VM läuft.\n"; return true; },
    ]);
  },
  start() { return newJob("VM starten", [mpStep(["start", VM], "VM starten …")]); },
  stop() { return newJob("VM stoppen", [mpStep(["stop", VM], "VM herunterfahren …")]); },
  suspend() { return newJob("VM pausieren", [mpStep(["suspend", VM], "VM pausieren (Arbeitsspeicher wird gesichert) …")]); },
  delete() { return newJob("VM löschen", [mpStep(["delete", "--purge", VM], "VM und alle Snapshots löschen …")]); },
  snapshot({ name, comment = "" } = {}) {
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,30}$/.test(name || "")) return { error: "Name: nur Buchstaben, Zahlen und Bindestrich." };
    return newJob("Snapshot anlegen", [
      mpStep(["stop", VM], "VM kurz anhalten (Snapshots gehen nur im gestoppten Zustand) …"),
      mpStep(["snapshot", VM, "--name", name, "--comment", String(comment).slice(0, 100)], `Snapshot „${name}“ anlegen …`),
      mpStep(["start", VM], "VM wieder starten …"),
    ]);
  },
  restore({ name } = {}) {
    if (!/^[A-Za-z0-9-]+$/.test(name || "")) return { error: "Ungültiger Snapshot." };
    return newJob("Snapshot zurückspielen", [
      mpStep(["stop", VM], "VM anhalten …"),
      mpStep(["restore", "--destructive", `${VM}.${name}`], `Auf „${name}“ zurücksetzen …`),
      mpStep(["start", VM], "VM starten …"),
    ]);
  },
  deleteSnapshot({ name } = {}) {
    if (!/^[A-Za-z0-9-]+$/.test(name || "")) return { error: "Ungültiger Snapshot." };
    // Hyper-V gibt die Snapshot-Platte nur bei gestoppter VM frei → ggf. kurz anhalten und danach wieder starten
    let wasRunning = false;
    return newJob("Snapshot löschen", [
      async () => { wasRunning = json((await mp(["info", VM, "--format", "json"], { timeout: 30000 })).stdout)?.info?.[VM]?.state === "Running"; return true; },
      (job) => (wasRunning ? mpStep(["stop", VM], "VM kurz anhalten (sonst bleibt die Snapshot-Datei gesperrt) …")(job) : true),
      mpStep(["delete", "--purge", `${VM}.${name}`], `Snapshot „${name}“ löschen …`),
      (job) => (wasRunning ? mpStep(["start", VM], "VM wieder starten …")(job) : true),
    ]);
  },
  installPwsh() {
    return newJob("PowerShell installieren", [
      scriptStep("snap install powershell --classic 2>&1 | tail -3", "PowerShell 7 in der VM installieren (ca. 1 Minute) …"),
      async (job) => { job.log += "\n✅ PowerShell ist installiert.\n"; return true; },
    ]);
  },
  installMultipass() {
    return newJob("Multipass installieren", [
      spawnStep("winget", ["install", "-e", "--id", "Canonical.Multipass", "--accept-package-agreements", "--accept-source-agreements", "--silent"],
        "Multipass über winget installieren (Windows fragt evtl. nach Administratorrechten) …"),
      async (job) => { job.log += "\n✅ Installiert. Falls die Prüfung noch rot ist: kurz warten, der Multipass-Dienst startet gerade.\n"; return true; },
    ]);
  },
  enableHyperV() {
    const ps = "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-Command','Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -All -NoRestart; Read-Host \"Fertig - Enter druecken\"'";
    return newJob("Hyper-V aktivieren", [
      spawnStep("powershell.exe", ["-NoProfile", "-Command", ps], "Hyper-V aktivieren – bitte die Windows-Abfrage (UAC) bestätigen …"),
      async (job) => { job.log += "\n⚠️ Jetzt Windows neu starten, damit Hyper-V aktiv wird. Danach rootshell wieder öffnen.\n"; return true; },
    ]);
  },
};

module.exports = { VM, PASSWORD, env, actions, getJob, getKey, ensureKey, execScript, scriptStep, newJob, mp };
