// VM-Steuerung für rootshell: Multipass, Hyper-V, SSH-Schlüssel, Hintergrund-Jobs
// Zwei feste VMs: die Übungs-VM (Wegwerf, für Übungen und Missionen) und die Server-VM (bleibt, dein Server).
"use strict";
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { utils: sshUtils } = require("ssh2");

/* Nur diese beiden VMs verwaltet die App – andere Namen werden nie angenommen. */
const PROFILES = {
  server: { id: "server", name: "fis-lab", cpus: 2, mem: "2G", disk: "15G", base: "frisch", label: "Server-VM",
    baseComment: "Direkt nach der Erstellung" },
  uebung: { id: "uebung", name: "rs-uebung", cpus: 1, mem: "1G", disk: "8G", base: "basis", label: "Übungs-VM",
    baseComment: "Ausgangszustand für Übungen und Missionen" },
};
const VM = PROFILES.server.name;   // Kompatibilität: alter Name der einzigen VM
const DATA = path.join(__dirname, "data");
const KEY_FILE = path.join(DATA, "id_ed25519");
const PASSWORD = "linuxlab"; // Übungs-Passwort der Lab-VMs (steht auch in fis-lab.yaml)
fs.mkdirSync(DATA, { recursive: true });

/** Profil zu "uebung" | "server" (Standard: server). Unbekannte Werte → Fehler. */
function profile(vm) {
  const p = PROFILES[vm == null ? "server" : vm];
  if (!p) throw new Error("Unbekannte VM: " + String(vm).slice(0, 20));
  return p;
}
const other = (p) => (p.id === "server" ? PROFILES.uebung : PROFILES.server);

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
// Multipass ≥ 1.17 schreibt bei jedem Befehl eine Warnung zum veralteten Hyper-V-Treiber nach stderr
const MP_NOISE = /^.*(Hyper-V driver is deprecated|instances migrated|multipass set local\.driver=hcs).*$/gm;
const mpQuiet = (s) => s.replace(MP_NOISE, "").replace(/\r/g, "").replace(/\n{2,}/g, "\n").trim();
const mp = (args, opts) => run(mpPath(), args, opts).then((r) => ({ ...r, stderr: mpQuiet(r.stderr) }));
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
/* Zustand einer VM aus "multipass info" (null = gibt es nicht) */
function vmInfo(i) {
  if (!i) return null;
  return {
    state: i.state, ip: (i.ipv4 || [])[0] || null, release: i.release || i.image_release,
    cpus: +i.cpu_count || null, mem: i.memory, disk: Object.values(i.disks || {})[0] || null, load: i.load,
  };
}
async function envNow() {
  const [host, mpi] = await Promise.all([hostInfo(), mpInfo()]);
  const vms = {};
  for (const p of Object.values(PROFILES)) vms[p.id] = { id: p.id, name: p.name, label: p.label, base: p.base, vm: null, snapshots: [] };
  if (mpi.installed) {
    const [list, s] = await Promise.all([
      mp(["list", "--format", "json"], { timeout: 30000 }),
      mp(["list", "--snapshots", "--format", "json"], { timeout: 30000 }),
    ]);
    const names = new Set((json(list.stdout)?.list || []).map((x) => x.name));
    const snaps = json(s.stdout)?.info || {};
    await Promise.all(Object.values(PROFILES).filter((p) => names.has(p.name)).map(async (p) => {
      const info = await mp(["info", p.name, "--format", "json"], { timeout: 30000 });
      vms[p.id].vm = vmInfo(json(info.stdout)?.info?.[p.name]);
      const sn = snaps[p.name] || {};
      vms[p.id].snapshots = Object.keys(sn).map((n) => ({ name: n, comment: sn[n].comment || "" }));
    }));
  }
  // vm / snapshots / vmName: Spiegel der Server-VM für ältere Stellen in der App
  // freier RAM ändert sich ständig → bei jeder Abfrage frisch (ohne PowerShell, sofort)
  return { platform: process.platform, ...host, ramFreeGB: Math.round(os.freemem() / 1073741824 * 10) / 10, multipass: mpi, vms,
    vmName: VM, vm: vms.server.vm, snapshots: vms.server.snapshots };
}
async function stateOf(p) {
  return json((await mp(["info", p.name, "--format", "json"], { timeout: 30000 })).stdout)?.info?.[p.name]?.state || null;
}
async function hasSnapshot(p, name) {
  const s = json((await mp(["list", "--snapshots", "--format", "json"], { timeout: 30000 })).stdout)?.info?.[p.name] || {};
  return Object.prototype.hasOwnProperty.call(s, name);
}

/* ---------- Jobs (lange Aktionen mit Live-Log) ---------- */
const jobs = new Map();
let busy = null;
function clean(s) {
  s = s.replace(MP_NOISE, "");   // Hyper-V-Warnung von Multipass ≥ 1.17 – im Log nur Lärm
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
    p.on("close", (code) => {
      job.progress = null;
      if (code === 0) return resolve(true);
      job.log += `\n(Exit-Code ${code})\n`;
      if (/OutOfMemory|nicht gen.gend Arbeitsspeicher|not enough memory|insufficient memory/i.test(job.log))
        job.log += `\n💡 Windows hat gerade nicht genug freien Arbeitsspeicher für die VM. Schließe Programme, die viel RAM brauchen (z. B. Browser-Tabs), oder pausiere die andere VM – und versuche es dann noch einmal.\n`;
      resolve(false);
    });
  });
}
const mpStep = (args, label, opts) => spawnStep(mpPath(), args, label, opts);
const getJob = (id) => jobs.get(id) || null;
const logStep = (text) => async (job) => { job.log += text; return true; };

/* Es läuft immer nur eine VM: die andere vorher pausieren (falls sie läuft) */
function pauseOtherStep(p) {
  const o = other(p);
  return async (job) => (await stateOf(o) === "Running"
    ? mpStep(["suspend", o.name], `${o.label} pausieren (es läuft immer nur eine VM) …`)(job)
    : true);
}
/* VM anhalten, egal ob sie läuft, pausiert oder schon aus ist */
function stopStep(p, label, { force = false } = {}) {
  return async (job) => {
    const st = await stateOf(p);
    if (st === "Stopped") return true;
    // Pausierte VMs lassen sich nur hart ausschalten; für die Wegwerf-VM vor einem Restore unbedenklich
    const hard = force || st === "Suspended";
    return mpStep(["stop", ...(hard ? ["--force"] : []), p.name], label || `${p.label} anhalten …`)(job);
  };
}

/* ---------- Cloud-Init mit App-Schlüssel ---------- */
function cloudInit(p) {
  const key = getKey().public;
  const file = path.join(DATA, `cloud-init-${p.id}.yaml`);
  fs.writeFileSync(file, `#cloud-config
hostname: ${p.name}
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
async function ensureKey(vm) {
  const p = profile(vm);
  const key = getKey().public;
  const script = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && grep -qF '${key}' ~/.ssh/authorized_keys || echo '${key}' >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys; command -v pwsh >/dev/null && echo PWSH=1 || echo PWSH=0`;
  const r = await mp(["exec", p.name, "--", "bash", "-c", script], { timeout: 30000 });
  r.pwsh = /PWSH=1/.test(r.stdout);
  return r;
}

/* Skript als root in der VM ausführen (nur vordefinierte Skripte aus Missionen/Lektionen) */
const rootArgs = (p, script) => ["exec", p.name, "--", "sudo", "bash", "-c", `echo ${Buffer.from(script, "utf8").toString("base64")} | base64 -d | bash`];
function execScript(script, timeout = 600000, vm) {
  return mp(rootArgs(profile(vm), script), { timeout });
}
function scriptStep(script, label, vm) {
  return mpStep(rootArgs(profile(vm), script), label);
}

/* Übungs-VM auf ihren Basis-Snapshot zurücksetzen und starten (legt den Snapshot an, falls er fehlt) */
function resetBaseSteps(vm = "uebung") {
  const p = profile(vm);
  let missing = false;
  return [
    async () => { missing = !(await hasSnapshot(p, p.base)); return true; },
    pauseOtherStep(p),
    stopStep(p, `${p.label} anhalten …`, { force: p.id === "uebung" }),
    async (job) => (missing
      ? mpStep(["snapshot", p.name, "--name", p.base, "--comment", p.baseComment], `Snapshot „${p.base}“ fehlt – wird jetzt angelegt …`)(job)
      : mpStep(["restore", "--destructive", `${p.name}.${p.base}`], `Auf „${p.base}“ zurücksetzen …`)(job)),
    mpStep(["start", p.name], `${p.label} starten …`),
  ];
}
/* Für Übungen und Missionen: zurücksetzen, dann ein vordefiniertes Skript als root ausführen */
function prepareJob(title, script, label, vm = "uebung") {
  const steps = resetBaseSteps(vm);
  if (script) steps.push(scriptStep(script, label || "Übung wird vorbereitet …", vm));
  steps.push(logStep("\n✅ Bereit – leg los!\n"));
  return newJob(title, steps);
}

/* ---------- Aktionen (vom Browser aufrufbar; vm = "uebung" | "server") ---------- */
const actions = {
  launch({ vm } = {}) {
    const p = profile(vm);
    return newJob(`${p.label} erstellen`, [
      pauseOtherStep(p),
      mpStep(["launch", "24.04", "--name", p.name, "--cpus", String(p.cpus), "--memory", p.mem, "--disk", p.disk, "--cloud-init", cloudInit(p), "--timeout", "1200"],
        `Ubuntu 24.04 herunterladen und ${p.label} starten (beim ersten Mal einige Minuten) …`),
      // Übungs-VM: PowerShell 7 gleich in den Basis-Snapshot – sonst installiert jede PowerShell-Übung es nach dem Zurücksetzen neu
      ...(p.id === "uebung" ? [scriptStep("snap install powershell --classic 2>&1 | tail -1", "PowerShell 7 für die Windows-Übungen installieren (ca. 1 Minute) …", p.id)] : []),
      logStep(`\n▶ Sicherungspunkt „${p.base}“ anlegen …\n`),
      mpStep(["stop", p.name]), mpStep(["snapshot", p.name, "--name", p.base, "--comment", p.baseComment]), mpStep(["start", p.name]),
      logStep(`\n✅ Fertig! Die ${p.label} läuft.\n`),
    ]);
  },
  start({ vm } = {}) { const p = profile(vm); return newJob(`${p.label} starten`, [pauseOtherStep(p), mpStep(["start", p.name], `${p.label} starten …`)]); },
  stop({ vm } = {}) { const p = profile(vm); return newJob(`${p.label} stoppen`, [stopStep(p, `${p.label} herunterfahren …`)]); },
  suspend({ vm } = {}) { const p = profile(vm); return newJob(`${p.label} pausieren`, [mpStep(["suspend", p.name], `${p.label} pausieren (Arbeitsspeicher wird gesichert) …`)]); },
  delete({ vm } = {}) { const p = profile(vm); return newJob(`${p.label} löschen`, [mpStep(["delete", "--purge", p.name], `${p.label} und alle Snapshots löschen …`)]); },
  resetBase({ vm = "uebung" } = {}) { const p = profile(vm); return newJob(`${p.label} zurücksetzen`, [...resetBaseSteps(vm), logStep(`\n✅ ${p.label} ist wieder im Zustand „${p.base}“.\n`)]); },
  snapshot({ vm, name, comment = "" } = {}) {
    const p = profile(vm);
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,30}$/.test(name || "")) return { error: "Name: nur Buchstaben, Zahlen und Bindestrich." };
    return newJob("Snapshot anlegen", [
      stopStep(p, `${p.label} kurz anhalten (Snapshots gehen nur im gestoppten Zustand) …`),
      mpStep(["snapshot", p.name, "--name", name, "--comment", String(comment).slice(0, 100)], `Snapshot „${name}“ anlegen …`),
      mpStep(["start", p.name], `${p.label} wieder starten …`),
    ]);
  },
  restore({ vm, name } = {}) {
    const p = profile(vm);
    if (!/^[A-Za-z0-9-]+$/.test(name || "")) return { error: "Ungültiger Snapshot." };
    return newJob("Snapshot zurückspielen", [
      pauseOtherStep(p),
      stopStep(p, `${p.label} anhalten …`),
      mpStep(["restore", "--destructive", `${p.name}.${name}`], `Auf „${name}“ zurücksetzen …`),
      mpStep(["start", p.name], `${p.label} starten …`),
    ]);
  },
  deleteSnapshot({ vm, name } = {}) {
    const p = profile(vm);
    if (!/^[A-Za-z0-9-]+$/.test(name || "")) return { error: "Ungültiger Snapshot." };
    // Hyper-V gibt die Snapshot-Platte nur bei gestoppter VM frei → ggf. kurz anhalten und danach wieder starten
    let wasRunning = false;
    return newJob("Snapshot löschen", [
      async () => { wasRunning = (await stateOf(p)) === "Running"; return true; },
      (job) => (wasRunning ? mpStep(["stop", p.name], `${p.label} kurz anhalten (sonst bleibt die Snapshot-Datei gesperrt) …`)(job) : true),
      mpStep(["delete", "--purge", `${p.name}.${name}`], `Snapshot „${name}“ löschen …`),
      (job) => (wasRunning ? mpStep(["start", p.name], `${p.label} wieder starten …`)(job) : true),
    ]);
  },
  installPwsh({ vm } = {}) {
    return newJob("PowerShell installieren", [
      scriptStep("snap install powershell --classic 2>&1 | tail -3", "PowerShell 7 in der VM installieren (ca. 1 Minute) …", vm),
      logStep("\n✅ PowerShell ist installiert.\n"),
    ]);
  },
  installMultipass() {
    return newJob("Multipass installieren", [
      spawnStep("winget", ["install", "-e", "--id", "Canonical.Multipass", "--accept-package-agreements", "--accept-source-agreements", "--silent"],
        "Multipass über winget installieren (Windows fragt evtl. nach Administratorrechten) …"),
      logStep("\n✅ Installiert. Falls die Prüfung noch rot ist: kurz warten, der Multipass-Dienst startet gerade.\n"),
    ]);
  },
  enableHyperV() {
    const ps = "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-Command','Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -All -NoRestart; Read-Host \"Fertig - Enter druecken\"'";
    return newJob("Hyper-V aktivieren", [
      spawnStep("powershell.exe", ["-NoProfile", "-Command", ps], "Hyper-V aktivieren – bitte die Windows-Abfrage (UAC) bestätigen …"),
      logStep("\n⚠️ Jetzt Windows neu starten, damit Hyper-V aktiv wird. Danach rootshell wieder öffnen.\n"),
    ]);
  },
};

module.exports = { VM, PROFILES, profile, PASSWORD, env, actions, getJob, getKey, ensureKey, execScript, scriptStep,
  newJob, mp, prepareJob, resetBaseSteps };
